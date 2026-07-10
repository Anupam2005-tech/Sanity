'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertCircle, Eye, FileSpreadsheet, X, ArrowRight, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HoverTooltip } from './HoverTooltip';

interface PreviewTableProps {
  headers: string[];
  rows: any[];
  onConfirm: () => void;
  onReset: () => void;
  filename?: string;
}

export function PreviewTable({ headers, rows, onConfirm, onReset, filename }: PreviewTableProps) {
  const [isOpen, setIsOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto flex flex-col space-y-4 sm:space-y-6 px-4"
    >
      {rows.length > 1000 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="w-full flex items-center gap-3 p-4 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Large file — processing may take longer.</p>
        </motion.div>
      )}

      <div className="border border-border rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="p-2 text-muted-foreground rounded-lg flex items-center justify-center shrink-0 hidden sm:flex">
          <Upload className="w-5 h-5" />
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1 min-w-0 w-full">
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              CSV Loaded
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight truncate w-full" title={filename}>
            {filename || 'Uploaded File'}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {rows.length.toLocaleString()} rows and {headers.length} columns detected.
          </p>
        </div>

        <div className="shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setIsOpen(true)}
            title="Preview Data"
            className="w-full sm:w-auto p-2.5 sm:p-2 rounded-lg text-muted-foreground hover:bg-muted transition-all flex items-center justify-center gap-2 border border-input text-xs font-medium"
          >
            <Eye className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">Preview Data</span>
          </button>
        </div>
      </div>

      <div className="border border-border/50 rounded-xl p-3 space-y-2">
        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Detected Columns ({headers.length})
        </h3>
        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
          {headers.map((header, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-md border border-border text-foreground font-medium"
            >
              {header}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onReset}
          className="px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all"
        >
          Previous
        </button>
        <button
          onClick={onConfirm}
          className="px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-muted transition-all flex items-center gap-1"
        >
          Confirm Import
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-md"
          >
            <motion.div
              key="modal-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full bg-card shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b px-4 py-3 bg-white/80 gap-4">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
                    <span className="truncate flex-1 pr-1">{filename || 'CSV Data Preview'}</span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Showing {rows.length.toLocaleString()} rows × {headers.length} columns
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Single scroll container for both axes — keeps header/rows aligned */}
              <div className="flex-1 overflow-hidden">
                <div
                  ref={parentRef}
                  className="w-full h-full overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  <table className="text-sm text-left" style={{ minWidth: 'max-content', width: '100%' }}>
                    <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-muted-foreground font-semibold shadow-sm">
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 text-center border-r border-border/50 bg-muted/95" style={{ width: '64px', minWidth: '64px' }}>#</th>
                        {headers.map((header, i) => (
                          <th key={i} className="px-4 py-3 whitespace-nowrap text-left" style={{ minWidth: '150px' }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody
                      style={{
                        display: 'block',
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        position: 'relative',
                      }}
                    >
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const rowData = rows[virtualRow.index];
                        return (
                          <tr
                            key={virtualRow.index}
                            className="absolute top-0 left-0 flex border-b border-border/50 hover:bg-muted/30 transition-colors"
                            style={{
                              width: '100%',
                              minWidth: 'max-content',
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <td
                              className="flex items-center justify-center shrink-0 text-muted-foreground bg-muted/10 border-r border-border/50 text-xs"
                              style={{ width: '64px', minWidth: '64px' }}
                            >
                              {virtualRow.index + 1}
                            </td>
                            {headers.map((header, i) => {
                              const cellVal = rowData[header];
                              const cellStr = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';
                              return (
                                <td key={i} className="px-4 py-2 truncate whitespace-nowrap flex items-center text-xs sm:text-sm" style={{ minWidth: '150px', width: '150px' }}>
                                  {cellStr ? <HoverTooltip content={cellStr}>{cellStr}</HoverTooltip> : <span className="text-muted-foreground/50">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t px-4 py-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onConfirm();
                  }}
                  className="px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-muted transition-all flex items-center gap-1"
                >
                  Confirm Import
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
