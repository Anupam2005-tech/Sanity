'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ImportStatusResponse } from 'shared/types';
import { Loader2, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmStepProps {
  filename: string;
  totalRows: number;
  rows: any[];
  onSuccess: (result: ImportStatusResponse) => void;
  onPrevious: () => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const STATUS_TEXTS = [
  'Brewing ideas...',
  'Extracting insights...',
  'Processing data...',
  'Brainstorming leads...',
  'Mapping columns...',
  'Analyzing patterns...',
  'Crunching numbers...',
  'Finalizing results...',
];

export function ConfirmStep({ filename, totalRows, rows, onSuccess, onPrevious }: ConfirmStepProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [displayPercent, setDisplayPercent] = useState<number>(0);

  const isMounted = useRef(true);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      xhrRef.current?.abort();
    };
  }, []);

  // Animated progress bar — base percentage + smooth drift towards next cap
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      interval = setInterval(() => {
        setDisplayPercent(prev => {
          if (!progress) {
            // Initial startup drift towards 5%
            const target = 5;
            if (prev >= target) return prev;
            return prev + (target - prev) * 0.08;
          }
          const basePct = (progress.completed / progress.total) * 100;
          if (prev < basePct) {
            return basePct;
          }
          const targetPct = progress.completed === progress.total
            ? 100
            : ((progress.completed + 1) / progress.total) * 100;
          const cap = basePct + (targetPct - basePct) * 0.95;
          if (prev >= cap) return prev;

          const remaining = cap - prev;
          return prev + Math.max(0.1, remaining * 0.05);
        });
      }, 300);
    } else {
      setDisplayPercent(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isProcessing, progress]);

  // Rotate status texts every 3s
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => setStatusIndex(prev => (prev + 1) % STATUS_TEXTS.length), 3000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleStart = async () => {
    setError(null);
    setIsProcessing(true);
    const estimatedTotal = Math.ceil(totalRows / 20) || 1;
    setProgress({ completed: 0, total: estimatedTotal });

    // Use XHR to stream the SSE response from POST /api/process
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', `${BACKEND_URL}/api/process`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let buffer = '';

    xhr.onprogress = () => {
      // Parse any new complete SSE lines from the response text
      const newText = xhr.responseText.slice(buffer.length);
      buffer = xhr.responseText;

      for (const line of newText.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        try {
          const data = JSON.parse(trimmed.slice(5).trim());
          if (!isMounted.current) return;

          if (data.type === 'progress') {
            setProgress({ completed: data.batchesCompleted, total: data.batchesTotal });
            const pct = Math.round((data.batchesCompleted / data.batchesTotal) * 100);
            setDisplayPercent(prev => Math.max(prev, pct));
          } else if (data.type === 'complete') {
            const total = data.result.batchesTotal || estimatedTotal;
            setProgress({ completed: total, total });
            setDisplayPercent(100);
            toast.success('AI Import completed successfully!');
            setTimeout(() => {
              if (isMounted.current) {
                xhr.abort();
                onSuccess(data.result);
              }
            }, 600);
          } else if (data.type === 'error') {
            throw new Error(data.message || 'Processing failed');
          }
        } catch (err: any) {
          if (isMounted.current) {
            setError(err.message || 'Processing failed');
            toast.error(err.message || 'Processing failed');
            setIsProcessing(false);
          }
        }
      }
    };

    xhr.onerror = () => {
      if (isMounted.current) {
        setError('Network error — could not reach the server.');
        toast.error('Network error — could not reach the server.');
        setIsProcessing(false);
      }
    };

    xhr.send(JSON.stringify({ rows, filename }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-lg mx-auto py-6 sm:py-12 px-4 flex flex-col items-center"
    >
      <div className="bg-card border rounded-xl p-5 sm:p-8 w-full shadow-sm">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-6">Ready to Import</h2>

        <div className="space-y-2 sm:space-y-4 mb-6 sm:mb-8 text-sm">
          <div className="flex justify-between py-3 border-b">
            <span className="text-muted-foreground">File</span>
            <span className="font-medium truncate max-w-[150px] sm:max-w-[240px]" title={filename}>{filename || 'Unknown'}</span>
          </div>
          <div className="flex justify-between py-3 border-b">
            <span className="text-muted-foreground">Total Rows</span>
            <span className="font-medium">{totalRows}</span>
          </div>
        </div>

        {isProcessing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-4 space-y-4 w-full"
          >
            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-muted-foreground" />

            <div className="text-center h-16 flex flex-col items-center justify-center w-full">
              <AnimatePresence mode="wait">
                <motion.p
                  key={statusIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="font-medium text-base sm:text-lg"
                >
                  {STATUS_TEXTS[statusIndex]}
                </motion.p>
              </AnimatePresence>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {progress && progress.total > 0
                  ? `Processing batch ${progress.completed} of ${progress.total}...`
                  : 'Starting AI analysis...'}
              </p>
            </div>

            <div className="w-full bg-muted rounded-full h-2.5 mt-4 overflow-hidden">
              <motion.div
                className="bg-foreground h-2.5 rounded-full"
                initial={false}
                animate={{ width: `${displayPercent}%` }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        ) : (
          <div className="flex justify-end gap-2">
            <button
              onClick={onPrevious}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all"
            >
              Previous
            </button>
            <motion.button
              onClick={handleStart}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-1 border border-input bg-background text-foreground py-1.5 px-3 rounded-md text-xs font-semibold hover:bg-muted transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              {error ? 'Try Again' : 'Start AI Import'}
            </motion.button>
          </div>
        )}

        {error && !isProcessing && (
          <p className="text-xs text-red-500 mt-4 text-center">{error}</p>
        )}
      </div>
    </motion.div>
  );
}
