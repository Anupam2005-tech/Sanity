import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewTable } from '../app/components/PreviewTable';

describe('PreviewTable', () => {
  const mockHeaders = ['name', 'email', 'phone'];
  const mockRows = [
    { name: 'Alice', email: 'alice@test.com', phone: '123' },
    { name: 'Bob', email: 'bob@test.com', phone: '456' },
  ];

  it('renders row count and column count', () => {
    render(<PreviewTable headers={mockHeaders} rows={mockRows} onConfirm={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText(/2 rows and 3 columns detected/)).toBeDefined();
  });

  it('renders filename when provided', () => {
    render(<PreviewTable headers={mockHeaders} rows={mockRows} onConfirm={vi.fn()} onReset={vi.fn()} filename="test.csv" />);
    expect(screen.getByText('test.csv')).toBeDefined();
  });

  it('renders Previous and Confirm Import buttons', () => {
    render(<PreviewTable headers={mockHeaders} rows={mockRows} onConfirm={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('Previous')).toBeDefined();
    expect(screen.getByText('Confirm Import')).toBeDefined();
  });

  it('renders column headers in the schema section', () => {
    render(<PreviewTable headers={mockHeaders} rows={mockRows} onConfirm={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('name')).toBeDefined();
    expect(screen.getByText('email')).toBeDefined();
    expect(screen.getByText('phone')).toBeDefined();
  });

  it('shows large file warning when rows > 1000', () => {
    const manyRows = Array.from({ length: 1001 }, (_, i) => ({ id: i }));
    render(<PreviewTable headers={['id']} rows={manyRows} onConfirm={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText(/processing may take longer/)).toBeDefined();
  });
});
