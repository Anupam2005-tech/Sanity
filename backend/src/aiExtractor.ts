import { GoogleGenerativeAI } from '@google/generative-ai';
import { CRMRecord } from 'shared/types';
import dotenv from 'dotenv';
import { callOpenRouter } from './ai/openRouter';
import { SYSTEM_PROMPT, parseCleanJson } from './ai/shared';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({ 
  model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
  }
});

async function callGemini(batch: { rowIndex: number; data: any }[]): Promise<{
  records: { rowIndex: number; record: Partial<CRMRecord> }[];
  skipped: { rowIndex: number; reason: string }[];
}> {
  const prompt = `${SYSTEM_PROMPT}\n\nInput Batch:\n${JSON.stringify(batch, null, 2)}`;
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const parsed = parseCleanJson(responseText);
  return {
    records: Array.isArray(parsed.records) ? parsed.records : [],
    skipped: Array.isArray(parsed.skipped) ? parsed.skipped : []
  };
}

const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

export async function callAI(batch: { rowIndex: number; data: any }[]): Promise<{
  records: { rowIndex: number; record: Partial<CRMRecord> }[];
  skipped: { rowIndex: number; reason: string }[];
}> {
  try {
    if (provider === 'openrouter') {
      return await callOpenRouter(batch);
    }
    return await callGemini(batch);
  } catch (error: any) {
    if (error.status === 429) {
      const enhancedError = new Error(error.message);
      enhancedError.name = 'RateLimitError';
      throw enhancedError;
    }
    if (error.message?.includes('token') || error.name === 'TokenLimitError') {
      const enhancedError = new Error(error.message);
      enhancedError.name = 'TokenLimitError';
      throw enhancedError;
    }
    throw error;
  }
}
