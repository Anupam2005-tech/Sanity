import { CRMRecord } from 'shared/types';
import { SYSTEM_PROMPT, parseCleanJson } from './shared';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

interface OpenRouterChoice {
  message: {
    content: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}

let activeModels: string[] = [];
let lastFetch = 0;
const CACHE_TTL = 300000; // 5 minutes cache
const modelsWithoutJsonMode = new Set<string>();

async function ensureModelsLoaded(apiKey: string): Promise<void> {
  if (activeModels.length > 0 && Date.now() - lastFetch < CACHE_TTL) {
    return;
  }

  try {
    const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (response.ok) {
      const data: any = await response.json();
      const freeModels = (data.data || [])
        .filter((m: any) => {
          const p = m.pricing || {};
          return parseFloat(p.prompt || '1') === 0 && parseFloat(p.completion || '1') === 0;
        })
        .map((m: any) => m.id);

      if (freeModels.length > 0) {
        activeModels = freeModels;
        lastFetch = Date.now();
        return;
      }
    }
  } catch {
    // Ignore and fall back
  }

  if (activeModels.length === 0) {
    activeModels = [
      'mistralai/mistral-7b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'google/gemma-2-2b-it:free',
    ];
  }
}

async function tryModel(
  model: string,
  batch: { rowIndex: number; data: any }[],
  apiKey: string,
): Promise<{
  records: { rowIndex: number; record: Partial<CRMRecord> }[];
  skipped: { rowIndex: number; reason: string }[];
}> {
  const body: any = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Input Batch:\n${JSON.stringify(batch, null, 2)}` },
    ],
  };

  if (!modelsWithoutJsonMode.has(model)) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'GrowEasy CSV Importer',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const errorTextLower = errorText.toLowerCase();

    // Catch errors relating to response_format or json_object support (case-insensitive, handles space/underscore variations)
    const isResponseFormatError = response.status === 400 && (
      errorTextLower.includes('response_format') ||
      errorTextLower.includes('response format') ||
      errorTextLower.includes('json_object') ||
      errorTextLower.includes('json mode') ||
      errorTextLower.includes('structured_outputs') ||
      errorTextLower.includes('invalid_request_body')
    );

    if (isResponseFormatError && !modelsWithoutJsonMode.has(model)) {
      modelsWithoutJsonMode.add(model);
      delete body.response_format;

      const retryResponse = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'GrowEasy CSV Importer',
        },
        body: JSON.stringify(body),
      });

      if (retryResponse.ok) {
        const data: OpenRouterResponse = await retryResponse.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response');
        const parsed = parseCleanJson(content);
        return {
          records: Array.isArray(parsed.records) ? parsed.records : [],
          skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
        };
      }

      const retryError = await retryResponse.text().catch(() => '');
      const error = new Error(`OpenRouter ${model} error (${retryResponse.status}): ${retryError}`);
      if (retryResponse.status === 429) error.name = 'RateLimitError';
      else if (retryResponse.status === 413) error.name = 'TokenLimitError';
      throw error;
    }

    const error = new Error(`OpenRouter ${model} error (${response.status}): ${errorText}`);
    if (response.status === 429) error.name = 'RateLimitError';
    else if (response.status === 413) error.name = 'TokenLimitError';
    throw error;
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response');

  const parsed = parseCleanJson(content);
  return {
    records: Array.isArray(parsed.records) ? parsed.records : [],
    skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
  };
}

export async function callOpenRouter(batch: { rowIndex: number; data: any }[]): Promise<{
  records: { rowIndex: number; record: Partial<CRMRecord> }[];
  skipped: { rowIndex: number; reason: string }[];
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENROUTER_API_KEY is not set');
    error.name = 'ConfigError';
    throw error;
  }

  await ensureModelsLoaded(apiKey);

  let lastError: any = null;
  const modelsToTry = [...activeModels];
  const maxAttempts = Math.min(modelsToTry.length, 5);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentModel = modelsToTry[attempt];
    try {
      const result = await tryModel(currentModel, batch, apiKey);

      // On success, move this model to the front of activeModels
      const indexInActive = activeModels.indexOf(currentModel);
      if (indexInActive > 0) {
        activeModels.splice(indexInActive, 1);
        activeModels.unshift(currentModel);
      }
      return result;
    } catch (error: any) {
      lastError = error;
      if (error.name === 'TokenLimitError') throw error;
      console.error(`Free model ${currentModel} failed:`, error.message?.slice(0, 120));

      // On failure, move this model to the back of activeModels so we don't try it first next time
      const indexInActive = activeModels.indexOf(currentModel);
      if (indexInActive !== -1) {
        activeModels.splice(indexInActive, 1);
        activeModels.push(currentModel);
      }
    }
  }

  throw lastError || new Error('No OpenRouter free model succeeded');
}