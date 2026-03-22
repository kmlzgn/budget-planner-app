import { describe, expect, it } from 'vitest';
import { buildDebtInstallments, calculateInstallmentAmount } from '../budgetCalculations';
import { TransactionFrequency } from '../../types';

describe('calculateInstallmentAmount', () => {
  it('handles zero or negative inputs', () => {
    expect(calculateInstallmentAmount(0, 2, 12)).toBe(0);
    expect(calculateInstallmentAmount(1000, 2, 0)).toBe(0);
  });

  it('falls back to simple division when rate is zero', () => {
    expect(calculateInstallmentAmount(1200, 0, 12)).toBeCloseTo(100, 6);
  });
});

describe('buildDebtInstallments', () => {
  it('builds monthly installments with stable due dates', () => {
    const installments = buildDebtInstallments('2026-01-01', 3, 250, 'monthly' as TransactionFrequency);
    expect(installments).toHaveLength(3);
    expect(installments[0].dueDate).toBe('2026-01-01');
    expect(installments[1].dueDate).toBe('2026-02-01');
    expect(installments[2].dueDate).toBe('2026-03-01');
  });

  it('returns empty when inputs are invalid', () => {
    expect(buildDebtInstallments(undefined, 3, 250, 'monthly')).toEqual([]);
    expect(buildDebtInstallments('2026-01-01', 0, 250, 'monthly')).toEqual([]);
  });
});
