import React from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProgressIndicatorProps {
  currentStep: number;
}

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Preview' },
  { id: 3, label: 'Confirm' },
  { id: 4, label: 'Results' },
];

export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  return (
    <div className="w-full py-4 sm:py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Circles + connecting lines */}
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            return (
              <React.Fragment key={step.id}>
                <motion.div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isCompleted
                      ? 'bg-sky-500 text-white'
                      : isActive
                        ? 'bg-white border-2 border-sky-500 text-sky-500'
                        : 'bg-white border-2 border-gray-300 text-gray-400'
                  }`}
                  initial={false}
                  animate={{ scale: isActive ? 1.15 : 1 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : step.id}
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-800 rounded-full mx-1 relative overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 bg-sky-500 rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: currentStep > step.id ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Labels - justify-between with equal-width items matches flex-1 circle spacing */}
        <div className="flex justify-between mt-2">
          {STEPS.map((step) => (
            <span
              key={step.id}
              className={`text-[9px] sm:text-[10px] font-semibold text-center w-7 sm:w-8 ${
                currentStep === step.id ? 'text-sky-500' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
