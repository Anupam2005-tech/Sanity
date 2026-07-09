import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { UploadStep } from '../app/components/UploadStep';

describe('UploadStep', () => {
  it('renders the upload zone with heading and description', () => {
    render(<UploadStep onUploadSuccess={vi.fn()} />);
    expect(screen.getByText('Import your leads')).toBeDefined();
    expect(screen.getByText(/Upload a CSV file/)).toBeDefined();
    expect(screen.getByText('Select File')).toBeDefined();
  });

  it('renders a hidden file input with csv accept attribute', () => {
    const { container } = render(<UploadStep onUploadSuccess={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.accept).toBe('.csv,text/csv');
    expect(input.className).toContain('hidden');
  });

  it('renders the drag-and-drop zone', () => {
    render(<UploadStep onUploadSuccess={vi.fn()} />);
    expect(screen.getByText('Click or drag file to this area to upload')).toBeDefined();
    expect(screen.getByText(/Support for a single or bulk upload/)).toBeDefined();
  });
});
