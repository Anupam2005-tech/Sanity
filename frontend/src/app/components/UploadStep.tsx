'use client';

import React, { useCallback, useState, useRef } from 'react';
import Papa from 'papaparse';
import { UploadCloud, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface UploadStepProps {
  onUploadSuccess: (file: File, headers: string[], rows: any[]) => void;
}

export function UploadStep({ onUploadSuccess }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const handleFile = (file: File) => {
    setError(null);

    if (file.size > MAX_FILE_SIZE) {
      const errMsg = `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`;
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      const errMsg = 'Only CSV files are supported.';
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    let headers: string[] = [];
    const rows: any[] = [];
    let isFirstRow = true;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      step: (results, parser) => {
        if (results.errors.length > 0) {
          const errMsg = `Parse error: ${results.errors[0].message}`;
          setError(errMsg);
          toast.error(errMsg);
          parser.abort();
          return;
        }

        if (isFirstRow) {
          headers = results.meta.fields || [];
          isFirstRow = false;
        }

        rows.push(results.data);
      },
      complete: () => {
        if (rows.length === 0) {
          const errMsg = 'The CSV file contains no data rows.';
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        toast.success(`Successfully parsed ${rows.length} rows!`);
        onUploadSuccess(file, headers, rows);
      },
      error: (err) => {
        const errMsg = `Failed to parse CSV: ${err.message}`;
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full flex flex-col items-center justify-center py-6 sm:py-12 px-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="text-center mb-6 sm:mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Import your leads</h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto px-4">
          Upload a CSV file and let our AI map it to the GrowEasy CRM.
        </p>
      </motion.div>

      <motion.div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`w-full max-w-xl border-2 border-dashed rounded-xl p-6 sm:p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-border bg-muted scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-border hover:bg-muted/50'
        }`}
      >
        <motion.div
          animate={isDragging ? { y: [-4, 4, -4], transition: { duration: 1, repeat: Infinity } } : {}}
          className="p-2 sm:p-3 rounded-full mb-3 sm:mb-4"
        >
          <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
        </motion.div>
        <h3 className="text-base sm:text-lg font-semibold mb-1 text-center px-2">Click or drag file to this area to upload</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mb-6 text-center px-4 max-w-sm">
          Support for a single or bulk upload. Maximum size is 10MB.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="border border-input bg-background text-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-muted transition-colors"
        >
          Select File
        </motion.button>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 w-full max-w-xl flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}
    </motion.div>
  );
}
