import { describe, expect, it } from 'vitest';
import { getTransferAwareMonthlyOutflowSummary } from '../financeSummaries';
import { BudgetState, Transaction } from '../../types';

const baseState: BudgetState = {
  schemaVersion: 9,
  settings: {
    currency: '$',
    startMonth: 0,
    startYear: 2026,
    budgetMethod: 'zero-based',
    familyMembers: [],
    language: 'en',
    owners: [],
  },
  categories: [],
  recurringTransactions: [],
  transactions: [],
  fundTransactions: [],
  fundHoldingsMeta: [],
  marketData: { fxRates: [], commodities: [] },
  deposits: [],
  wealthSnapshots: [],
  accounts: [],
  debts: [],
  savingsGoals: [],
};

const makeTransaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 't1',
  date: '2026-01-10',
  amount: 100,
  categoryId: 'c1',
  description: 'Test',
  type: 'expense',
  ...overrides,
});

describe('getTransferAwareMonthlyOutflowSummary', () => {
  it('returns empty-state defaults', () => {
    const result = getTransferAwareMonthlyOutflowSummary(baseState, 2026, 0);
    expect(result).toMatchObject({
      outflowExTransfers: 0,
      transferAwareBalance: 0,
      hasDerivedTransfers: false,
      excludedTransferCount: 0,
      showTransferAwareDetail: false,
    });
  });

  it('counts normal outflows when no derived transfers exist', () => {
    const state: BudgetState = {
      ...baseState,
      transactions: [
        makeTransaction({ id: 't1', amount: 120, type: 'expense', date: '2026-01-05' }),
      ],
    };
    const result = getTransferAwareMonthlyOutflowSummary(state, 2026, 0);
    expect(result.outflowExTransfers).toBe(120);
    expect(result.transferAwareBalance).toBe(-120);
    expect(result.hasDerivedTransfers).toBe(false);
    expect(result.excludedTransferCount).toBe(0);
    expect(result.showTransferAwareDetail).toBe(false);
  });

  it('excludes explicit credit-card payment outflows and derived transfer events', () => {
    const state: BudgetState = {
      ...baseState,
      transactions: [
        makeTransaction({
          id: 'cc1',
          amount: 200,
          baseAmount: 200,
          transactionKind: 'credit-card-payment',
          paymentAccountId: 'checking-1',
          creditCardAccountId: 'cc-1',
          date: '2026-01-08',
        }),
      ],
    };
    const result = getTransferAwareMonthlyOutflowSummary(state, 2026, 0);
    expect(result.outflowExTransfers).toBe(0);
    expect(result.transferAwareBalance).toBe(0);
    expect(result.hasDerivedTransfers).toBe(true);
    expect(result.excludedTransferCount).toBe(1);
    expect(result.showTransferAwareDetail).toBe(false);
  });

  it('limits calculations to the target month', () => {
    const state: BudgetState = {
      ...baseState,
      transactions: [
        makeTransaction({ id: 'jan', amount: 50, date: '2026-01-03' }),
        makeTransaction({ id: 'feb', amount: 70, date: '2026-02-10' }),
      ],
    };
    const janResult = getTransferAwareMonthlyOutflowSummary(state, 2026, 0);
    const febResult = getTransferAwareMonthlyOutflowSummary(state, 2026, 1);
    expect(janResult.outflowExTransfers).toBe(50);
    expect(febResult.outflowExTransfers).toBe(70);
  });

  it('shows transfer-aware detail only when derived transfers exist and outflow is present', () => {
    const state: BudgetState = {
      ...baseState,
      transactions: [
        makeTransaction({ id: 'spend', amount: 80, date: '2026-01-07' }),
        makeTransaction({
          id: 'cc1',
          amount: 200,
          baseAmount: 200,
          transactionKind: 'credit-card-payment',
          paymentAccountId: 'checking-1',
          creditCardAccountId: 'cc-1',
          date: '2026-01-08',
        }),
      ],
    };
    const result = getTransferAwareMonthlyOutflowSummary(state, 2026, 0);
    expect(result.hasDerivedTransfers).toBe(true);
    expect(result.outflowExTransfers).toBe(80);
    expect(result.transferAwareBalance).toBe(-80);
    expect(result.excludedTransferCount).toBe(1);
    expect(result.showTransferAwareDetail).toBe(true);
  });
});
