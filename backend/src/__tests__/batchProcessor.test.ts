import { describe, it, expect, vi } from 'vitest';
import { chunkArray, withRetry, processBatchResult, isValidDate, hasEmailOrMobile } from '../batchProcessor';

describe('chunkArray', () => {
  it('splits array into chunks of given size', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    expect(chunkArray(arr, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('returns empty array for empty input', () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it('returns single chunk if size >= array length', () => {
    const arr = [1, 2, 3];
    expect(chunkArray(arr, 10)).toEqual([[1, 2, 3]]);
  });

  it('handles size of 1', () => {
    const arr = [1, 2, 3];
    expect(chunkArray(arr, 1)).toEqual([[1], [2], [3]]);
  });
});

describe('withRetry', () => {
  it('resolves on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, 3, 5)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, 3, 5)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent fail'));
    await expect(withRetry(fn, 3, 5)).rejects.toThrow('persistent fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws TokenLimitError immediately without retrying', async () => {
    const err = new Error('token limit exceeded');
    err.name = 'TokenLimitError';
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 3, 5)).rejects.toThrow('token limit exceeded');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('isValidDate', () => {
  it('returns true for valid dates', () => {
    expect(isValidDate('2026-05-13 14:20:48')).toBe(true);
    expect(isValidDate('2026-01-01')).toBe(true);
    expect(isValidDate('2026-05-13T14:20:48Z')).toBe(true);
  });

  it('returns true for null or undefined', () => {
    expect(isValidDate(null)).toBe(true);
    expect(isValidDate(undefined)).toBe(true);
  });

  it('returns false for invalid dates', () => {
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('hasEmailOrMobile', () => {
  it('returns true if email exists', () => {
    expect(hasEmailOrMobile({ email: 'test@example.com' })).toBe(true);
  });

  it('returns true if mobile exists', () => {
    expect(hasEmailOrMobile({ mobile_without_country_code: '9876543210' })).toBe(true);
  });

  it('returns false if neither exists', () => {
    expect(hasEmailOrMobile({ name: 'John' })).toBe(false);
  });

  it('returns false if both are empty strings', () => {
    expect(hasEmailOrMobile({ email: '', mobile_without_country_code: '' })).toBe(false);
  });

  it('ignores whitespace-only values', () => {
    expect(hasEmailOrMobile({ email: '  ' })).toBe(false);
  });
});

describe('processBatchResult', () => {
  it('processes valid records and skips missing rows', () => {
    const batch = [
      { rowIndex: 0, data: { name: 'John' } },
      { rowIndex: 1, data: { name: 'Jane' } },
    ];
    const result = {
      records: [
        { rowIndex: 0, record: { name: 'John', email: 'john@test.com', mobile_without_country_code: '123' } },
      ],
      skipped: [],
    };
    const finalRecords: any[] = [];
    const finalSkipped: any[] = [];

    processBatchResult(batch, result, finalRecords, finalSkipped);

    expect(finalRecords).toHaveLength(1);
    expect(finalRecords[0].record.name).toBe('John');
    expect(finalSkipped).toHaveLength(1);
    expect(finalSkipped[0].reason).toBe('Row missing from AI response');
  });

  it('blanks invalid crm_status and data_source', () => {
    const batch = [{ rowIndex: 0, data: { name: 'John' } }];
    const result = {
      records: [
        {
          rowIndex: 0,
          record: {
            name: 'John',
            email: 'john@test.com',
            mobile_without_country_code: '123',
            crm_status: 'INVALID_STATUS',
            data_source: 'invalid_source',
          },
        },
      ],
      skipped: [],
    };
    const finalRecords: any[] = [];
    const finalSkipped: any[] = [];

    processBatchResult(batch, result, finalRecords, finalSkipped);

    expect(finalRecords[0].record.crm_status).toBeNull();
    expect(finalRecords[0].record.data_source).toBeNull();
  });

  it('skips records with neither email nor mobile', () => {
    const batch = [{ rowIndex: 0, data: { name: 'John' } }];
    const result = {
      records: [
        { rowIndex: 0, record: { name: 'John' } },
      ],
      skipped: [],
    };
    const finalRecords: any[] = [];
    const finalSkipped: any[] = [];

    processBatchResult(batch, result, finalRecords, finalSkipped);

    expect(finalRecords).toHaveLength(0);
    expect(finalSkipped).toHaveLength(1);
    expect(finalSkipped[0].reason).toBe('Missing both email and mobile number');
  });

  it('merges skipped from AI response', () => {
    const batch = [{ rowIndex: 0, data: { name: 'John' } }];
    const result = {
      records: [],
      skipped: [{ rowIndex: 0, reason: 'Already skipped by AI' }],
    };
    const finalRecords: any[] = [];
    const finalSkipped: any[] = [];

    processBatchResult(batch, result, finalRecords, finalSkipped);

    expect(finalRecords).toHaveLength(0);
    expect(finalSkipped).toHaveLength(1);
    expect(finalSkipped[0].reason).toBe('Already skipped by AI');
  });

  it('blanks invalid created_at date', () => {
    const batch = [{ rowIndex: 0, data: { name: 'John' } }];
    const result = {
      records: [
        {
          rowIndex: 0,
          record: {
            name: 'John',
            email: 'john@test.com',
            mobile_without_country_code: '123',
            created_at: 'not-a-date',
          },
        },
      ],
      skipped: [],
    };
    const finalRecords: any[] = [];
    const finalSkipped: any[] = [];

    processBatchResult(batch, result, finalRecords, finalSkipped);

    expect(finalRecords[0].record.created_at).toBeNull();
  });
});
