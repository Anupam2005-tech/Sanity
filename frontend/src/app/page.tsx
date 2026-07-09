'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ProgressIndicator } from './components/ProgressIndicator';
import { UploadStep } from './components/UploadStep';
import { PreviewTable } from './components/PreviewTable';
import { ConfirmStep } from './components/ConfirmStep';
import { ResultsStep } from './components/ResultsStep';
import { ImportStatusResponse } from 'shared/types';

const stepVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.2, ease: 'easeIn' } },
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  const [result, setResult] = useState<ImportStatusResponse | null>(null);

  const handleUploadSuccess = (f: File, h: string[], r: any[]) => {
    setFile(f);
    setHeaders(h);
    setRows(r);
    setCurrentStep(2);
  };

  const handleReset = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setResult(null);
    setCurrentStep(1);
  };

  const handleConfirm = () => {
    setCurrentStep(3);
  };

  const handleProcessSuccess = (res: ImportStatusResponse) => {
    setResult(res);
    setCurrentStep(4);
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  return (
    <div className="w-full flex flex-col items-center">
      <ProgressIndicator currentStep={currentStep} />

      <div className="w-full mt-6">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <UploadStep onUploadSuccess={handleUploadSuccess} />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <PreviewTable
                headers={headers}
                rows={rows}
                onConfirm={handleConfirm}
                onReset={handlePrevious}
                filename={file?.name}
              />
            </motion.div>
          )}

          {currentStep === 3 && file && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ConfirmStep
                filename={file.name}
                totalRows={rows.length}
                rows={rows}
                onSuccess={handleProcessSuccess}
                onPrevious={handlePrevious}
              />
            </motion.div>
          )}

          {currentStep === 4 && result && (
            <motion.div
              key="step4"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ResultsStep
                result={result}
                onReset={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
