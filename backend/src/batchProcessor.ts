import { db } from './db/client';
import { callAI } from './aiExtractor';
import { CRMRecord } from 'shared/types';

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts: number, baseDelayMs: number): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= maxAttempts) throw error;
      if (error.name === 'TokenLimitError') throw error; // token error handled outside by halving

      if (error.name === 'RateLimitError') {
        const delay = Math.max(baseDelayMs * Math.pow(3, attempt - 1), 15000);
        console.log(`Rate limited (attempt ${attempt}), retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

const VALID_CRM_STATUS = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'];
const VALID_DATA_SOURCE = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];

export async function processImport(importId: string, onProgress?: (completed: number, total: number) => void): Promise<{ records: any[], skipped: any[] }> {
  try {
    const importRow = db.prepare(`SELECT * FROM imports WHERE id = ?`).get(importId) as any;
    if (!importRow) throw new Error('Import not found');

    const rawRecords = db.prepare(`SELECT * FROM import_records WHERE import_id = ? ORDER BY row_index`).all(importId) as any[];
    
    const rowsToProcess = rawRecords.map(r => ({
      rowIndex: r.row_index,
      data: JSON.parse(r.raw_row_json)
    }));

    // Task 4.2: Read AI_BATCH_SIZE
    let batchSize = parseInt(process.env.AI_BATCH_SIZE || '20', 10);
    if (isNaN(batchSize) || batchSize < 5) batchSize = 5;
    if (batchSize > 50) batchSize = 50;

    let chunks = chunkArray(rowsToProcess, batchSize);
    
    db.prepare(`UPDATE imports SET batches_total = ? WHERE id = ?`).run(chunks.length, importId);

    const finalRecords: any[] = [];
    const finalSkipped: any[] = [];
    
    let batchesCompleted = 0;

    // Task 4.3: sequential batch iteration
    for (let i = 0; i < chunks.length; i++) {
      let currentBatch = chunks[i];
      let processedSuccessfully = false;
      let tokenErrorHit = false;

      try {
        const result = await withRetry(() => callAI(currentBatch), 3, 1000);
        processBatchResult(currentBatch, result, finalRecords, finalSkipped);
        processedSuccessfully = true;
      } catch (error: any) {
        if (error.name === 'TokenLimitError') {
          tokenErrorHit = true;
        } else {
          // Task 4.6: total batch failure
          console.error('Batch failed after retries', error);
          currentBatch.forEach(row => {
            finalSkipped.push({
              rowIndex: row.rowIndex,
              reason: 'AI processing failed after retries'
            });
          });
          processedSuccessfully = true;
        }
      }

      // Task 4.5: Halve the batch and retry
      if (tokenErrorHit && !processedSuccessfully) {
        console.log('Token limit hit. Halving batch size...');
        const half = Math.ceil(currentBatch.length / 2);
        const subBatch1 = currentBatch.slice(0, half);
        const subBatch2 = currentBatch.slice(half);

        for (const subBatch of [subBatch1, subBatch2]) {
          try {
            const result = await withRetry(() => callAI(subBatch), 3, 1000);
            processBatchResult(subBatch, result, finalRecords, finalSkipped);
          } catch (subError) {
             console.error('Sub-batch failed', subError);
             subBatch.forEach(row => {
               finalSkipped.push({ rowIndex: row.rowIndex, reason: 'AI processing failed on sub-batch' });
             });
          }
        }
      }

      batchesCompleted++;
      db.prepare(`UPDATE imports SET batches_completed = ? WHERE id = ?`).run(batchesCompleted, importId);
      if (onProgress) onProgress(batchesCompleted, chunks.length);
    }

    // Task 6.6: Persist final aggregated rows
    const updateSuccess = db.prepare(`
      UPDATE import_records SET 
        status = 'success',
        created_at_field = ?, name = ?, email = ?, country_code = ?,
        mobile_without_country_code = ?, company = ?, city = ?, state = ?,
        country = ?, lead_owner = ?, crm_status = ?, crm_note = ?,
        data_source = ?, possession_time = ?, description = ?
      WHERE import_id = ? AND row_index = ?
    `);

    const updateSkipped = db.prepare(`
      UPDATE import_records SET 
        status = 'skipped',
        skip_reason = ?
      WHERE import_id = ? AND row_index = ?
    `);

    db.transaction(() => {
      for (const rec of finalRecords) {
        updateSuccess.run(
          rec.record.created_at || null, rec.record.name || null, rec.record.email || null,
          rec.record.country_code || null, rec.record.mobile_without_country_code || null,
          rec.record.company || null, rec.record.city || null, rec.record.state || null,
          rec.record.country || null, rec.record.lead_owner || null, rec.record.crm_status || null,
          rec.record.crm_note || null, rec.record.data_source || null, rec.record.possession_time || null,
          rec.record.description || null,
          importId, rec.rowIndex
        );
      }
      for (const skip of finalSkipped) {
        updateSkipped.run(skip.reason, importId, skip.rowIndex);
      }
      db.prepare(`UPDATE imports SET status = 'completed' WHERE id = ?`).run(importId);
    })();
    
    return { records: finalRecords, skipped: finalSkipped };

  } catch (error) {
    console.error('Process import fatal error:', error);
    db.prepare(`UPDATE imports SET status = 'failed' WHERE id = ?`).run(importId);
    throw error;
  }
}

export function isValidDate(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (value.trim() === '') return false;
  const d = new Date(value);
  return d.toString() !== 'Invalid Date' && !isNaN(d.getTime());
}

export function hasEmailOrMobile(record: Partial<CRMRecord>): boolean {
  const email = record.email?.trim();
  const mobile = record.mobile_without_country_code?.trim();
  return !!(email || mobile);
}

export function processBatchResult(
  batch: { rowIndex: number, data: any }[], 
  result: { records: { rowIndex: number, record: Partial<CRMRecord> }[], skipped: { rowIndex: number, reason: string }[] },
  finalRecords: any[],
  finalSkipped: any[]
) {
  const processedRecords = result.records || [];
  const processedSkipped = result.skipped || [];

  for (const rec of processedRecords) {
    if (rec.record.crm_status && !VALID_CRM_STATUS.includes(rec.record.crm_status)) {
      rec.record.crm_status = null;
    }
    if (rec.record.data_source && !VALID_DATA_SOURCE.includes(rec.record.data_source)) {
      rec.record.data_source = null;
    }
    if (rec.record.created_at && !isValidDate(rec.record.created_at)) {
      rec.record.created_at = null;
    }
    if (!hasEmailOrMobile(rec.record)) {
      processedSkipped.push({
        rowIndex: rec.rowIndex,
        reason: 'Missing both email and mobile number'
      });
      continue;
    }
  }

  const validRecords = processedRecords.filter(r => {
    const wasSkipped = processedSkipped.some(s => s.rowIndex === r.rowIndex);
    const hasEmail = r.record.email?.trim();
    const hasMobile = r.record.mobile_without_country_code?.trim();
    if (!hasEmail && !hasMobile) {
      if (!wasSkipped) {
        processedSkipped.push({
          rowIndex: r.rowIndex,
          reason: 'Missing both email and mobile number'
        });
      }
      return false;
    }
    return !wasSkipped;
  });

  const accountedRowIndices = new Set([
    ...validRecords.map(r => r.rowIndex),
    ...processedSkipped.map(s => s.rowIndex)
  ]);

  const missingRows = batch.filter(row => !accountedRowIndices.has(row.rowIndex));
  for (const row of missingRows) {
    processedSkipped.push({
      rowIndex: row.rowIndex,
      reason: 'Row missing from AI response'
    });
  }

  finalRecords.push(...validRecords);
  finalSkipped.push(...processedSkipped);
}
