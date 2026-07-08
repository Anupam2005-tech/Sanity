import express from 'express';
import cors from 'cors';
import { db, initDB } from './db/client';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { ImportCreateRequest, ImportCreateResponse, ImportStatusResponse } from 'shared/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Task 3.1 & 3.6: Middleware (cors, express.json with 10mb limit)
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize DB schema on startup
initDB();

// Task 3.2: Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Task 3.3: POST /api/imports
app.post('/api/imports', (req, res) => {
  try {
    const { rows, filename } = req.body as ImportCreateRequest;
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided' });
    }
    
    if (rows.length > 5000) {
      return res.status(413).json({ error: 'Row limit exceeded (max 5000)' });
    }

    const importId = crypto.randomUUID();
    
    // Use a transaction to insert the import and its raw rows
    const insertImport = db.prepare(`
      INSERT INTO imports (id, filename, total_rows, status)
      VALUES (?, ?, ?, 'pending')
    `);

    const insertRecord = db.prepare(`
      INSERT INTO import_records (import_id, row_index, status, skip_reason, raw_row_json)
      VALUES (?, ?, 'pending', NULL, ?)
    `);

    const transaction = db.transaction(() => {
      insertImport.run(importId, filename || null, rows.length);
      for (let i = 0; i < rows.length; i++) {
        insertRecord.run(importId, i, JSON.stringify(rows[i]));
      }
    });

    transaction();

    const response: ImportCreateResponse = {
      importId,
      totalRows: rows.length
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating import:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Task 3.4: GET /api/imports/:id
app.get('/api/imports/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const importRow = db.prepare(`SELECT * FROM imports WHERE id = ?`).get(id) as any;
    if (!importRow) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const response: ImportStatusResponse = {
      id: importRow.id,
      filename: importRow.filename,
      status: importRow.status,
      totalRows: importRow.total_rows,
      batchesCompleted: importRow.batches_completed,
      batchesTotal: importRow.batches_total
    };

    if (importRow.status === 'completed') {
      const records = db.prepare(`SELECT * FROM import_records WHERE import_id = ? ORDER BY row_index`).all(id) as any[];
      response.records = records.filter(r => r.status === 'success').map(r => ({
        created_at: r.created_at_field,
        name: r.name,
        email: r.email,
        country_code: r.country_code,
        mobile_without_country_code: r.mobile_without_country_code,
        company: r.company,
        city: r.city,
        state: r.state,
        country: r.country,
        lead_owner: r.lead_owner,
        crm_status: r.crm_status,
        crm_note: r.crm_note,
        data_source: r.data_source,
        possession_time: r.possession_time,
        description: r.description
      }));
      response.skipped = records.filter(r => r.status === 'skipped').map(r => ({
        index: r.row_index,
        reason: r.skip_reason,
        rawRow: JSON.parse(r.raw_row_json)
      }));
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching import:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

import { processImport } from './batchProcessor';

// Task 12.3: SSE streaming endpoint
app.get('/api/imports/:id/stream', (req, res) => {
  const { id } = req.params;

  const importRow = db.prepare(`SELECT * FROM imports WHERE id = ?`).get(id) as any;
  if (!importRow) {
    res.status(404).json({ error: 'Import not found' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send initial status
  res.write(`data: ${JSON.stringify({ type: 'status', status: importRow.status, batchesCompleted: importRow.batches_completed, batchesTotal: importRow.batches_total })}\n\n`);

  // Poll DB for progress updates
  const pollInterval = setInterval(() => {
    try {
      const row = db.prepare(`SELECT * FROM imports WHERE id = ?`).get(id) as any;
      if (!row) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Import not found' })}\n\n`);
        res.end();
        clearInterval(pollInterval);
        return;
      }

      if (row.status === 'processing') {
        res.write(`data: ${JSON.stringify({ type: 'progress', batchesCompleted: row.batches_completed, batchesTotal: row.batches_total })}\n\n`);
      } else if (row.status === 'completed') {
        const records = db.prepare(`SELECT * FROM import_records WHERE import_id = ? ORDER BY row_index`).all(id) as any[];
        const result = {
          id: row.id,
          filename: row.filename,
          status: 'completed',
          totalRows: row.total_rows,
          batchesCompleted: row.batches_completed,
          batchesTotal: row.batches_total,
          records: records.filter(r => r.status === 'success').map(r => ({
            created_at: r.created_at_field,
            name: r.name,
            email: r.email,
            country_code: r.country_code,
            mobile_without_country_code: r.mobile_without_country_code,
            company: r.company,
            city: r.city,
            state: r.state,
            country: r.country,
            lead_owner: r.lead_owner,
            crm_status: r.crm_status,
            crm_note: r.crm_note,
            data_source: r.data_source,
            possession_time: r.possession_time,
            description: r.description
          })),
          skipped: records.filter(r => r.status === 'skipped').map(r => ({
            index: r.row_index,
            reason: r.skip_reason,
            rawRow: JSON.parse(r.raw_row_json)
          }))
        };
        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();
        clearInterval(pollInterval);
      } else if (row.status === 'failed') {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Import processing failed' })}\n\n`);
        res.end();
        clearInterval(pollInterval);
      }
    } catch (err) {
      // ignore polling errors
    }
  }, 500);

  req.on('close', () => {
    clearInterval(pollInterval);
  });
});

// Task 3.5 & 6.7: POST /api/imports/:id/process
app.post('/api/imports/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    const importRow = db.prepare(`SELECT * FROM imports WHERE id = ?`).get(id) as any;
    
    if (!importRow) {
      return res.status(404).json({ error: 'Import not found' });
    }
    
    if (importRow.status === 'processing' || importRow.status === 'completed') {
      return res.status(400).json({ error: `Import is already ${importRow.status}` });
    }

    // Mark as processing
    db.prepare(`UPDATE imports SET status = 'processing' WHERE id = ?`).run(id);

    const { records, skipped } = await processImport(id);

    // Map records to expected response format
    const formattedRecords = records.map(rec => rec.record);
    
    res.status(200).json({ 
      importId: id,
      records: formattedRecords,
      skipped,
      totalImported: records.length,
      totalSkipped: skipped.length
    });
  } catch (error) {
    console.error('Error starting processing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
