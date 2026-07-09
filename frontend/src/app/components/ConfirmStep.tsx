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
  const [progress, setProgress] = useState<{ completed: number, total: number } | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [displayPercent, setDisplayPercent] = useState<number>(0);

  const isMounted = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      eventSourceRef.current?.close();
    };
  }, []);

  // Simulated progress to make the progress bar fill up continuously and smoothly
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setDisplayPercent(0);
      interval = setInterval(() => {
        setDisplayPercent((prev) => {
          if (prev >= 92) return prev;
          // Decelerate the increment as it gets closer to 92%
          const remaining = 92 - prev;
          const increment = Math.max(1, Math.ceil(remaining * 0.08));
          return prev + increment;
        });
      }, 350);
    } else {
      setDisplayPercent(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  // Rotate status texts every 3s during processing
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_TEXTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleStart = async () => {
    setError(null);
    setIsProcessing(true);
    // Initialize progress immediately using estimated batch count
    const estimatedTotal = Math.ceil(totalRows / 20) || 1;
    setProgress({ completed: 0, total: estimatedTotal });

    try {
      const createRes = await fetch(`${BACKEND_URL}/api/imports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, filename })
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${createRes.status}`);
      }

      const { importId } = await createRes.json();

      // Connect to SSE stream for real-time progress
      const eventSource = new EventSource(`${BACKEND_URL}/api/imports/${importId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (!isMounted.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'progress') {
            setProgress({ completed: data.batchesCompleted, total: data.batchesTotal });
            const actualPercent = Math.round((data.batchesCompleted / data.batchesTotal) * 100);
            setDisplayPercent((prev) => Math.max(prev, actualPercent));
          } else if (data.type === 'complete') {
            const total = data.result.batchesTotal || Math.ceil(totalRows / 20) || 1;
            setProgress({ completed: total, total });
            setDisplayPercent(100);
            toast.success('AI Import completed successfully!');
            setTimeout(() => {
              if (isMounted.current) {
                eventSource.close();
                onSuccess(data.result);
              }
            }, 600);
          } else if (data.type === 'error') {
            eventSource.close();
            throw new Error(data.message);
          }
        } catch (err: any) {
          eventSource.close();
          if (isMounted.current) {
            setError(err.message || 'Processing failed');
            toast.error(err.message || 'Processing failed');
            setIsProcessing(false);
          }
        }
      };

      eventSource.onerror = () => {
        // The stream will close when processing completes; don't treat as error
        // because onmessage with 'complete' type already handles success
      };

      // Also fire the process endpoint to start processing
      fetch(`${BACKEND_URL}/api/imports/${importId}/process`, {
        method: 'POST'
      }).catch(() => {
        // Ignore — the SSE stream will report the final result or error
      });

    } catch (err: any) {
      if (isMounted.current) {
        const errMsg = err.message || 'An unexpected error occurred.';
        setError(errMsg);
        toast.error(errMsg);
        setIsProcessing(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-lg mx-auto py-12 flex flex-col items-center"
    >
      <div className="bg-card border rounded-xl p-8 w-full shadow-sm">
        <h2 className="text-2xl font-bold text-center mb-6">Ready to Import</h2>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between py-3 border-b">
            <span className="text-muted-foreground">File</span>
            <span className="font-medium truncate max-w-[200px]">{filename || 'Unknown'}</span>
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
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />

            <div className="text-center h-16 flex flex-col items-center justify-center w-full">
              <AnimatePresence mode="wait">
                <motion.p
                  key={statusIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="font-medium text-lg"
                >
                  {STATUS_TEXTS[statusIndex]}
                </motion.p>
              </AnimatePresence>
              <p className="text-sm text-muted-foreground mt-1">
                {progress && progress.total > 0
                  ? `Processing batch ${progress.completed} of ${progress.total}...`
                  : 'Starting AI analysis...'}
              </p>
            </div>

            {isProcessing && (
              <div className="w-full bg-muted rounded-full h-2.5 mt-4 overflow-hidden">
                <motion.div
                  className="bg-foreground h-2.5 rounded-full"
                  initial={false}
                  animate={{ width: `${displayPercent}%` }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </div>
            )}
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
      </div>
    </motion.div>
  );
}
