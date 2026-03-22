import { describe, expect, it } from 'vitest';
import { formatCurrency, parseLocalizedNumber, formatLocalizedNumberInput } from '../formatting';

describe('formatCurrency', () => {
  it('uses decimals below the hide threshold', () => {
    expect(formatCurrency(999.5, '$', 'en-US')).toBe('$ 999.50');
  });

  it('hides decimals at or above the default threshold', () => {
    expect(formatCurrency(1000, '$', 'en-US')).toBe('$ 1,000');
  });

  it('respects custom hideDecimalsThreshold', () => {
    expect(formatCurrency(1000, '$', 'en-US', { hideDecimalsThreshold: Infinity })).toBe('$ 1,000.00');
  });
});

describe('parseLocalizedNumber', () => {
  it('parses Turkish decimal input correctly', () => {
    expect(parseLocalizedNumber('0,99', 'tr-TR')).toBeCloseTo(0.99, 6);
    expect(parseLocalizedNumber('1.000,50', 'tr-TR')).toBeCloseTo(1000.5, 6);
  });

  it('parses US decimal input correctly', () => {
    expect(parseLocalizedNumber('1,234.56', 'en-US')).toBeCloseTo(1234.56, 6);
  });
});

describe('formatLocalizedNumberInput', () => {
  it('preserves grouping while typing in Turkish locale', () => {
    expect(formatLocalizedNumberInput('1000', 'tr-TR')).toBe('1.000');
  });
});
