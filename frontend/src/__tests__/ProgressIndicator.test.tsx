import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressIndicator } from '../app/components/ProgressIndicator';

describe('ProgressIndicator', () => {
  it('renders all 4 step labels', () => {
    render(<ProgressIndicator currentStep={1} />);
    expect(screen.getByText('Upload')).toBeDefined();
    expect(screen.getByText('Preview')).toBeDefined();
    expect(screen.getByText('Confirm')).toBeDefined();
    expect(screen.getByText('Results')).toBeDefined();
  });

  it('renders step numbers 2, 3, 4 when on step 1', () => {
    render(<ProgressIndicator currentStep={1} />);
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });
});
