'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ImportStatusResponse } from 'shared/types';
import {
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Download, Eye, X, FileJson, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface ResultsStepProps {
  result: ImportStatusResponse;
  onReset: () => void;
}

const CRM_FIELDS = [
  'created_at', 'name', 'email', 'country_code', 'mobile_without_country_code',
  'company', 'city', 'state', 'country', 'lead_owner', 'crm_status',
  'crm_note', 'data_source', 'possession_time', 'description'
];

const CRM_FIELD_LABELS: Record<string, string> = {
  created_at: 'Created At',
  name: 'Name',
  email: 'Email',
  country_code: 'Code',
  mobile_without_country_code: 'Mobile',
  company: 'Company',
  city: 'City',
  state: 'State',
  country: 'Country',
  lead_owner: 'Lead Owner',
  crm_status: 'Status',
  crm_note: 'Notes',
  data_source: 'Source',
  possession_time: 'Possession',
  description: 'Description',
};

// Min-width per field (px) — wider for text-heavy columns
const FIELD_WIDTHS: Record<string, number> = {
  created_at: 160,
  name: 150,
  email: 200,
  country_code: 80,
  mobile_without_country_code: 140,
  company: 150,
  city: 110,
  state: 110,
  country: 110,
  lead_owner: 170,
  crm_status: 160,
  crm_note: 220,
  data_source: 150,
  possession_time: 140,
  description: 200,
};

const STATUS_BADGES: Record<string, string> = {
  GOOD_LEAD_FOLLOW_UP: 'bg-accent/15 text-accent',
  DID_NOT_CONNECT: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  BAD_LEAD: 'bg-red-500/15 text-red-600 dark:text-red-400',
  SALE_DONE: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
};

function cellValue(val: any, field: string) {
  if (val === undefined || val === null || val === '') return null;
  if (field === 'crm_status') {
    const badgeClass = STATUS_BADGES[String(val)] || 'bg-gray-500/15 text-gray-600';
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${badgeClass}`}>
        {String(val).replace(/_/g, ' ')}
      </span>
    );
  }
  return String(val);
}

function formatDateTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
    }
  } catch {}
  return dateStr;
}

// ── Download helpers ────────────────────────────────────────────────
function exportToCSV(records: any[], filename: string) {
  const csvRows: string[] = [];
  csvRows.push(CRM_FIELDS.map(f => `"${CRM_FIELD_LABELS[f] || f}"`).join(','));
  for (const rec of records) {
    const row = CRM_FIELDS.map(f => {
      const val = (rec as any)[f];
      if (val === undefined || val === null || val === '') return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
    csvRows.push(row);
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, resolveFilename(filename, 'csv'));
  toast.success('CSV downloaded successfully!');
}

function exportToJSON(records: any[], filename: string) {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, resolveFilename(filename, 'json'));
  toast.success('JSON downloaded successfully!');
}

function resolveFilename(name: string, ext: 'csv' | 'json') {
  const base = name.replace(/\.(csv|json)$/i, '');
  return `${base}_results.${ext}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

import { HoverTooltip, CRM_FIELD_DESCRIPTIONS } from './HoverTooltip';

// ── Download Dropdown ───────────────────────────────────────────────
function DownloadDropdown({ records, filename }: { records: any[]; filename: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-muted transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Download
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-1.5 w-44 rounded-md border border-input bg-card shadow-lg z-20 overflow-hidden"
          >
            <button
              onClick={() => { exportToCSV(records, filename); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs hover:bg-muted transition-colors text-left"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              Download as CSV
            </button>
            <button
              onClick={() => { exportToJSON(records, filename); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs hover:bg-muted transition-colors text-left border-t border-border/50"
            >
              <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
              Download as JSON
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Preview Modal ───────────────────────────────────────────────────
function PreviewModal({ records, onClose }: { records: any[]; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative w-full h-full bg-card flex flex-col overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/50">
              Hover over any cell to see the full value
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable table — single container so header & body scroll together horizontally */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <table
            className="text-sm text-left border-collapse"
            style={{ minWidth: 'max-content', width: '100%' }}
          >
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-muted-foreground font-semibold shadow-sm">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-center border-r border-border/50 bg-muted/95" style={{ minWidth: 52, width: 52 }}>#</th>
                {CRM_FIELDS.map((field) => (
                  <th
                    key={field}
                    className="px-4 py-3 whitespace-nowrap text-left"
                    style={{ minWidth: FIELD_WIDTHS[field] || 130 }}
                  >
                    <HoverTooltip content={CRM_FIELD_DESCRIPTIONS[field] || ''}>
                      {CRM_FIELD_LABELS[field] || field}
                    </HoverTooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((rowData, i) => (
                <tr
                  key={i}
                  className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                >
                  <td
                    className="px-4 py-2.5 text-center text-muted-foreground bg-muted/10 border-r border-border/50 text-xs"
                    style={{ minWidth: 52, width: 52 }}
                  >
                    {i + 1}
                  </td>
                  {CRM_FIELDS.map((field) => {
                    const val = (rowData as any)[field];
                    const rendered = cellValue(val, field);
                    const rawStr = val != null && val !== '' ? String(val) : '';
                    const displayVal = field === 'created_at' && rawStr ? formatDateTime(rawStr) : rawStr;
                    return (
                      <td
                        key={field}
                        className="px-4 py-2.5 whitespace-nowrap"
                        style={{ minWidth: FIELD_WIDTHS[field] || 130, maxWidth: FIELD_WIDTHS[field] ? FIELD_WIDTHS[field] * 1.5 : 220 }}
                      >
                        {rendered !== null ? (
                          field === 'created_at' ? (
                            <HoverTooltip content={rawStr}>{displayVal}</HoverTooltip>
                          ) : (
                            <HoverTooltip content={rawStr}>
                              <span className="block truncate">{rendered}</span>
                            </HoverTooltip>
                          )
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── ResultsStep ─────────────────────────────────────────────────────
export function ResultsStep({ result, onReset }: ResultsStepProps) {
  const [showSkipped, setShowSkipped] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const records = result.records || [];
  const skipped = result.skipped || [];
  const INITIAL_DISPLAY = 6;
  const hasMore = records.length > INITIAL_DISPLAY;

  useEffect(() => {
    if (records.length > 0 && skipped.length > 0) {
      toast.success(`Import complete: ${records.length} imported, ${skipped.length} skipped.`);
    } else if (records.length > 0) {
      toast.success(`Successfully imported all ${records.length} leads!`);
    } else if (skipped.length > 0) {
      toast.error(`All ${skipped.length} records were skipped.`);
    }
  }, [records.length, skipped.length]);

  const filename = result.filename || 'import';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full flex flex-col space-y-6"
      >
        {/* Summary Banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="w-full flex items-center justify-between p-4 bg-card border rounded-lg shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-foreground bg-muted px-3 py-1.5 rounded-md font-medium border border-border">
              <CheckCircle2 className="w-5 h-5" />
              <span>{records.length} Imported</span>
            </div>
            {skipped.length > 0 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-md font-medium">
                <AlertTriangle className="w-5 h-5" />
                <span>{skipped.length} Skipped</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {records.length > 0 && (
              <>
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center justify-center p-2 rounded-md text-xs font-medium border border-input bg-background hover:bg-muted transition-colors"
                  title="Preview all records"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <DownloadDropdown records={records} filename={filename} />
              </>
            )}
            <button
              onClick={onReset}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Start New Import
            </button>
          </div>
        </motion.div>

        {/* Results Table */}
        {records.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="border rounded-md overflow-hidden bg-card shadow-sm"
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground">Successfully Imported Records</h3>
              <span className="text-xs text-muted-foreground">
                {hasMore
                  ? `Showing ${INITIAL_DISPLAY} of ${records.length} records`
                  : `${records.length} record${records.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {/* Inline preview table */}
            <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <table className="text-sm text-left border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
                <thead className="bg-muted/80 text-muted-foreground font-semibold">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-center border-r border-border/50 bg-muted/80" style={{ minWidth: 52, width: 52 }}>#</th>
                    {CRM_FIELDS.map((field) => (
                      <th
                        key={field}
                        className="px-4 py-3 whitespace-nowrap text-left"
                        style={{ minWidth: FIELD_WIDTHS[field] || 130 }}
                      >
                        <HoverTooltip content={CRM_FIELD_DESCRIPTIONS[field] || ''}>
                          {CRM_FIELD_LABELS[field] || field}
                        </HoverTooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, INITIAL_DISPLAY).map((rowData, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td
                        className="px-4 py-2.5 text-center text-muted-foreground bg-muted/10 border-r border-border/50 text-xs"
                        style={{ minWidth: 52, width: 52 }}
                      >
                        {i + 1}
                      </td>
                      {CRM_FIELDS.map((field) => {
                        const val = (rowData as any)[field];
                        const rendered = cellValue(val, field);
                        const rawStr = val != null && val !== '' ? String(val) : '';
                        const displayVal = field === 'created_at' && rawStr ? formatDateTime(rawStr) : rawStr;
                        return (
                          <td
                            key={field}
                            className="px-4 py-2.5 whitespace-nowrap"
                            style={{
                              minWidth: FIELD_WIDTHS[field] || 130,
                              maxWidth: FIELD_WIDTHS[field] ? FIELD_WIDTHS[field] * 1.5 : 220
                            }}
                          >
                            {rendered !== null ? (
                              field === 'created_at' ? (
                                <HoverTooltip content={rawStr}>{displayVal}</HoverTooltip>
                              ) : (
                                <HoverTooltip content={rawStr}>
                                  <span className="block truncate">{rendered}</span>
                                </HoverTooltip>
                              )
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-center bg-muted/10">
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View all {records.length} records
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Collapsible Skipped Records */}
        {skipped.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="border rounded-md overflow-hidden bg-card shadow-sm border-amber-500/20"
          >
            <button
              onClick={() => setShowSkipped(!showSkipped)}
              className="w-full p-4 flex items-center justify-between bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
            >
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-semibold">
                <AlertTriangle className="w-5 h-5" />
                <h3>Skipped Records ({skipped.length})</h3>
              </div>
              {showSkipped
                ? <ChevronUp className="w-5 h-5 text-amber-600" />
                : <ChevronDown className="w-5 h-5 text-amber-600" />}
            </button>

            <AnimatePresence initial={false}>
              {showSkipped && (
                <motion.div
                  key="skipped-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="w-full overflow-x-auto max-h-[400px] overflow-y-auto border-t border-amber-500/20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <table className="w-full text-sm text-left border-collapse" style={{ minWidth: 600 }}>
                      <thead className="sticky top-0 z-10 bg-amber-500/10 text-amber-700 dark:text-amber-500 font-semibold">
                        <tr>
                          <th className="px-4 py-3 border-b border-amber-500/20 text-center" style={{ width: 64 }}>Row</th>
                          <th className="px-4 py-3 border-b border-amber-500/20" style={{ width: 280 }}>Reason</th>
                          <th className="px-4 py-3 border-b border-amber-500/20">Raw Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skipped.map((skip, i) => (
                          <motion.tr
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            className="border-b border-border/50 hover:bg-muted/30"
                          >
                            <td className="px-4 py-3 text-center text-muted-foreground bg-muted/10">{skip.index + 1}</td>
                            <td className="px-4 py-3 font-medium text-amber-600">{skip.reason}</td>
                            <td className="px-4 py-3">
                              {skip.rawRow && typeof skip.rawRow === 'object' ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(skip.rawRow).map(([key, val]) => (
                                    <span
                                      key={key}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/40 text-xs text-muted-foreground"
                                    >
                                      <span className="font-semibold text-foreground/70">{key}:</span>
                                      <span className="truncate max-w-[200px]" title={String(val)}>{String(val)}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <PreviewModal records={records} onClose={() => setShowPreview(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
