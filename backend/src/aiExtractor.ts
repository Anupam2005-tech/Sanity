import { GoogleGenerativeAI } from '@google/generative-ai';
import { CRMRecord } from 'shared/types';
import dotenv from 'dotenv';
import { callOpenRouter } from './ai/openRouter';
import { SYSTEM_PROMPT, parseCleanJson } from './ai/shared';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.warn('[AI] GEMINI_API_KEY is not set — Gemini calls will fail and fall back to OpenRouter.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  generationConfig: {
    responseMimeType: 'application/json',
  },
});

async function callGemini(batch: { rowIndex: number; data: any }[]): Promise<{
  records: { rowIndex: number; record: Partial<CRMRecord> }[];
  skipped: { rowIndex: number; reason: string }[];
}> {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('GEMINI_API_KEY is not set');
    error.name = 'ConfigError';
    throw error;
  }

  const prompt = `${SYSTEM_PROMPT}\n\nInput Batch:\n${JSON.stringify(batch, null, 2)}`;
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const parsed = parseCleanJson(responseText);
  return {
    records: Array.isArray(parsed.records) ? parsed.records : [],
    skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
  };
}

export async function callAI(batch: { rowIndex: number; data: any }[]): Promise<{
  records: { rowIndex: number; record: Partial<CRMRecord> }[];
  skipped: { rowIndex: number; reason: string }[];
}> {
  console.log(`[AI] Attempting extraction with Gemini...`);
  try {
    return await callGemini(batch);
  } catch (geminiError: any) {
    console.warn(`[AI] Gemini failed: ${geminiError.message || geminiError}. Falling back to OpenRouter...`);
    try {
      return await callOpenRouter(batch);
    } catch (orError: any) {
      console.error(`[AI] OpenRouter fallback also failed: ${orError.message || orError}`);

      // Bubble up the appropriate error name/types
      if (orError.status === 429 || orError.name === 'RateLimitError') {
        const enhancedError = new Error(orError.message);
        enhancedError.name = 'RateLimitError';
        throw enhancedError;
      }
      if (orError.name === 'TokenLimitError' || orError.message?.includes('token')) {
        const enhancedError = new Error(orError.message);
        enhancedError.name = 'TokenLimitError';
        throw enhancedError;
      }
      if (orError.name === 'ConfigError') {
        const enhancedError = new Error(orError.message);
        enhancedError.name = 'ConfigError';
        throw enhancedError;
      }
      throw orError;
    }
  }
}