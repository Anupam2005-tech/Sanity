import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Task 2.4: Configure SQLite file path via environment variable
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../../data/sanity.db');

// Ensure the directory exists
const dir = path.dirname(SQLITE_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(SQLITE_PATH);

// Task 2.1 and 2.2: Init schema
export function initDB() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      filename TEXT,
      total_rows INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      batches_completed INTEGER DEFAULT 0,
      batches_total INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS import_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'skipped')),
      skip_reason TEXT,
      created_at_field TEXT,
      name TEXT,
      email TEXT,
      country_code TEXT,
      mobile_without_country_code TEXT,
      company TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      lead_owner TEXT,
      crm_status TEXT,
      crm_note TEXT,
      data_source TEXT,
      possession_time TEXT,
      description TEXT,
      raw_row_json TEXT NOT NULL,
      FOREIGN KEY (import_id) REFERENCES imports(id)
    );
  `);

  // Task 2.3: Sweep stuck imports on startup
  // If status is 'processing' and older than 15 minutes, mark as 'failed'
  const sweepStmt = db.prepare(`
    UPDATE imports 
    SET status = 'failed' 
    WHERE status = 'processing' 
      AND created_at < datetime('now', '-15 minutes')
  `);
  const result = sweepStmt.run();
  if (result.changes > 0) {
    console.log(`Swept ${result.changes} stuck imports to failed status on startup.`);
  }
}
