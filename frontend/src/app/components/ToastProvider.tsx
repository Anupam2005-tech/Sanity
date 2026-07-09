'use client';

import React from 'react';
import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        style: {
          color: '#fff',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          padding: '0.75rem 1rem',
        },
        success: {
          style: {
            background: '#16a34a',
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#16a34a',
          },
        },
        error: {
          style: {
            background: '#dc2626',
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#dc2626',
          },
        },
      }}
    />
  );
}
