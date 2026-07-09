import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { callAI } from './aiExtractor';
import { CRMRecord } from 'shared/types';

dotenv.config();

const app = express();
const rawPort = process.env.PORT || '3001';
const PORT = parseInt(rawPort, 10);
if (isNaN(PORT)) {
  console.error(`[FATAL] PORT env var is not a valid number: "${rawPort}". Set PORT to a number (e.g. 3001) in your environment.`);
  process.exit(1);
}



const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── In-memory helpers ─────────────────────────────────────────────

const VALID_CRM_STATUS = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'];
const VALID_DATA_SOURCE = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, maxAttempts: number, baseDelayMs: number): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= maxAttempts) throw error;
      if (error.name === 'TokenLimitError') throw error;
      const delay = error.name === 'RateLimitError'
        ? Math.max(baseDelayMs * Math.pow(3, attempt - 1), 15000)
        : baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed (${error.name || 'Error'}), retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

function sanitiseRecord(rec: Partial<CRMRecord>, importTimestamp: string): Partial<CRMRecord> {
  // Always stamp with current import time
  rec.created_at = importTimestamp;
  if (rec.crm_status && !VALID_CRM_STATUS.includes(rec.crm_status)) rec.crm_status = null as any;
  if (rec.data_source && !VALID_DATA_SOURCE.includes(rec.data_source)) rec.data_source = null as any;
  return rec;
}

function hasEmailOrMobile(rec: Partial<CRMRecord>): boolean {
  return !!(rec.email?.trim() || rec.mobile_without_country_code?.trim());
}

// ── SSE streaming process endpoint ───────────────────────────────
//
// POST /api/process
// Body: { rows: object[], filename: string }
// Streams SSE events: progress | complete | error
//
app.post('/api/process', async (req, res) => {
  const { rows, filename } = req.body as { rows: any[]; filename: string };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No rows provided' });
    return;
  }
  if (rows.length > 5000) {
    res.status(413).json({ error: 'Row limit exceeded (max 5000)' });
    return;
  }

  // Switch to SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  let batchSize = parseInt(process.env.AI_BATCH_SIZE || '20', 10);
  if (isNaN(batchSize) || batchSize < 5) batchSize = 5;
  if (batchSize > 50) batchSize = 50;

  const rowsWithIndex = rows.map((data, i) => ({ rowIndex: i, data }));
  const chunks = chunkArray(rowsWithIndex, batchSize);
  const importTimestamp = new Date().toISOString();

  const finalRecords: any[] = [];
  const finalSkipped: any[] = [];

  send({ type: 'progress', batchesCompleted: 0, batchesTotal: chunks.length });

  try {
    for (let i = 0; i < chunks.length; i++) {
      let currentBatch = chunks[i];
      let tokenErrorHit = false;
      let processedSuccessfully = false;

      try {
        const result = await withRetry(() => callAI(currentBatch), 3, 1000);
        processBatch(currentBatch, result, importTimestamp, finalRecords, finalSkipped);
        processedSuccessfully = true;
      } catch (error: any) {
        if (error.name === 'TokenLimitError') {
          tokenErrorHit = true;
        } else {
          console.error('Batch failed after retries', error);
          currentBatch.forEach(row => finalSkipped.push({ index: row.rowIndex, reason: 'AI processing failed after retries' }));
          processedSuccessfully = true;
        }
      }

      // Halve batch on token limit
      if (tokenErrorHit && !processedSuccessfully) {
        const half = Math.ceil(currentBatch.length / 2);
        for (const subBatch of [currentBatch.slice(0, half), currentBatch.slice(half)]) {
          try {
            const result = await withRetry(() => callAI(subBatch), 3, 1000);
            processBatch(subBatch, result, importTimestamp, finalRecords, finalSkipped);
          } catch {
            subBatch.forEach(row => finalSkipped.push({ index: row.rowIndex, reason: 'AI processing failed on sub-batch' }));
          }
        }
      }

      send({ type: 'progress', batchesCompleted: i + 1, batchesTotal: chunks.length });
    }

    const result = {
      id: 'in-memory',
      filename: filename || 'import',
      status: 'completed',
      totalRows: rows.length,
      batchesCompleted: chunks.length,
      batchesTotal: chunks.length,
      records: finalRecords.map(r => r.record),
      skipped: finalSkipped,
    };

    send({ type: 'complete', result });
  } catch (err: any) {
    console.error('Fatal processing error:', err);
    send({ type: 'error', message: err.message || 'Processing failed' });
  } finally {
    res.end();
  }
});

// ── Batch result processor (pure, no DB) ─────────────────────────
function processBatch(
  batch: { rowIndex: number; data: any }[],
  result: { records: { rowIndex: number; record: Partial<CRMRecord> }[]; skipped: { rowIndex: number; reason: string }[] },
  importTimestamp: string,
  finalRecords: any[],
  finalSkipped: any[]
) {
  const processedRecords = result.records || [];
  const processedSkipped: any[] = [...(result.skipped || [])];

  for (const rec of processedRecords) {
    sanitiseRecord(rec.record, importTimestamp);
    if (!hasEmailOrMobile(rec.record)) {
      processedSkipped.push({ index: rec.rowIndex, reason: 'Missing both email and mobile number' });
    }
  }

  const skippedIndices = new Set(processedSkipped.map((s: any) => s.rowIndex ?? s.index));

  const validRecords = processedRecords.filter(r => {
    if (skippedIndices.has(r.rowIndex)) return false;
    if (!hasEmailOrMobile(r.record)) {
      processedSkipped.push({ index: r.rowIndex, reason: 'Missing both email and mobile number' });
      return false;
    }
    return true;
  });

  // Account for rows the AI missed entirely
  const accountedIndices = new Set([
    ...validRecords.map(r => r.rowIndex),
    ...processedSkipped.map((s: any) => s.rowIndex ?? s.index),
  ]);
  batch.filter(row => !accountedIndices.has(row.rowIndex)).forEach(row =>
    processedSkipped.push({ index: row.rowIndex, reason: 'Row missing from AI response' })
  );

  finalRecords.push(...validRecords);
  finalSkipped.push(...processedSkipped.map((s: any) => ({
    index: s.rowIndex ?? s.index,
    reason: s.reason,
  })));
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT} (stateless, no DB)`);
});
