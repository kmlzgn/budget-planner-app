import { describe, expect, it } from 'vitest';
import { formatCurrency } from '../formatting';

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
