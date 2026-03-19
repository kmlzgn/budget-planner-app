import { describe, expect, it } from 'vitest';
import { calculateDebtPayoffTimeline, getDebtPayoffOrder } from '../budgetCalculations';
import { getDebtDecisionSummary } from '../debtSummaries';
import { Debt } from '../../types';

const debt = (id: string, balance: number, rate: number, min: number): Debt => ({
  id,
  name: id,
  totalAmount: balance,
  currentBalance: balance,
  interestRate: rate,
  minimumPayment: min,
});

describe('debt calculations', () => {
  it('orders debts by balance for snowball and by rate for avalanche', () => {
    const debts = [
      debt('a', 500, 5, 25),
      debt('b', 1200, 18, 30),
      debt('c', 800, 12, 20),
    ];
    expect(getDebtPayoffOrder(debts, 'snowball').map(d => d.id)).toEqual(['a', 'c', 'b']);
    expect(getDebtPayoffOrder(debts, 'avalanche').map(d => d.id)).toEqual(['b', 'c', 'a']);
  });

  it('flags non-paying debts with a 999-month horizon', () => {
    const timeline = calculateDebtPayoffTimeline([debt('a', 1000, 12, 5)], 'snowball', 0);
    expect(timeline[0].monthsToPayoff).toBe(999);
  });

  it('summarizes extra payment impact safely', () => {
    const debts = [debt('a', 1000, 12, 100)];
    const summary = getDebtDecisionSummary(debts, 'snowball', 50);
    expect(summary.totalDebt).toBe(1000);
    expect(summary.totalMinimumPayments).toBe(100);
    expect(summary.monthsSaved).toBeGreaterThanOrEqual(0);
    expect(summary.interestSaved).toBeGreaterThanOrEqual(0);
  });
});
