import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsStep } from '../app/components/ResultsStep';
import { ImportStatusResponse } from 'shared/types';

describe('ResultsStep', () => {
  const mockResult: ImportStatusResponse = {
    id: 'test-id',
    filename: 'test.csv',
    status: 'completed',
    totalRows: 3,
    batchesCompleted: 1,
    batchesTotal: 1,
    records: [
      { name: 'Alice', email: 'alice@test.com', country_code: '+1', mobile_without_country_code: '1234567890' },
      { name: 'Bob', email: 'bob@test.com' },
    ],
    skipped: [
      { index: 2, reason: 'Missing both email and mobile number', rawRow: { name: 'Charlie' } },
    ],
  };

  it('renders imported count', () => {
    render(<ResultsStep result={mockResult} onReset={vi.fn()} />);
    expect(screen.getByText('2 Imported')).toBeDefined();
  });

  it('renders skipped count when there are skipped records', () => {
    render(<ResultsStep result={mockResult} onReset={vi.fn()} />);
    expect(screen.getByText('1 Skipped')).toBeDefined();
  });

  it('renders Start New Import button', () => {
    render(<ResultsStep result={mockResult} onReset={vi.fn()} />);
    expect(screen.getByText('Start New Import')).toBeDefined();
  });

  it('renders skipped records section header with reason', () => {
    render(<ResultsStep result={mockResult} onReset={vi.fn()} />);
    expect(screen.getByText(/Skipped Records \(1\)/)).toBeDefined();
    fireEvent.click(screen.getByText(/Skipped Records \(1\)/));
    expect(screen.getByText('Missing both email and mobile number')).toBeDefined();
  });

  it('does not render skipped section when no skipped records', () => {
    const noSkipResult = { ...mockResult, skipped: [], records: mockResult.records!.slice(0, 1) };
    render(<ResultsStep result={noSkipResult} onReset={vi.fn()} />);
    expect(screen.queryByText(/Skipped Records/)).toBeNull();
  });

  it('renders Successfully Imported Records heading when records exist', () => {
    render(<ResultsStep result={mockResult} onReset={vi.fn()} />);
    expect(screen.getByText('Successfully Imported Records')).toBeDefined();
  });
});
