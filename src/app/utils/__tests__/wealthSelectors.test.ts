import { describe, expect, it } from 'vitest';
import { getWealthTotals } from '../wealthSelectors';
import { Account, BudgetState, Debt, FundHoldingMeta, FundTransaction, Transaction } from '../../types';

const buildState = (overrides: Partial<BudgetState>): BudgetState => ({
  schemaVersion: 1,
  settings: {
    currency: '$',
    startMonth: 0,
    startYear: 2026,
    budgetMethod: 'zero-based',
    familyMembers: [],
    language: 'en',
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
  ...overrides,
});

describe('getWealthTotals', () => {
  it('computes net worth from cash, funds, and debts', () => {
    const accounts: Account[] = [
      {
        id: 'cash',
        name: 'Cash',
        type: 'checking',
        openingBalance: 100,
        currentBalance: 100,
        isAsset: true,
      },
    ];
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        date: '2026-01-10',
        amount: 20,
        categoryId: 'c1',
        accountId: 'cash',
        description: 'Groceries',
        type: 'expense',
      },
    ];
    const fundTransactions: FundTransaction[] = [
      {
        id: 'f1',
        assetClass: 'fund',
        date: '2026-01-05',
        fund: 'Alpha',
        units: 10,
        price: 5,
        amount: 50,
        type: 'buy',
      },
    ];
    const fundHoldingsMeta: FundHoldingMeta[] = [
      { fund: 'Alpha', currentPrice: 6, withholdingTaxRate: 0 },
    ];
    const debts: Debt[] = [
      {
        id: 'd1',
        name: 'Loan',
        totalAmount: 200,
        currentBalance: 200,
        interestRate: 10,
        minimumPayment: 20,
      },
    ];

    const state = buildState({
      accounts,
      transactions,
      fundTransactions,
      fundHoldingsMeta,
      debts,
    });

    const totals = getWealthTotals(state, new Date('2026-01-15'));
    expect(totals.cashTotal).toBe(80);
    expect(totals.fundAssetsTotal).toBe(60);
    expect(totals.fundCostBasisTotal).toBe(50);
    expect(totals.totalAssets).toBe(140);
    expect(totals.totalLiabilities).toBe(200);
    expect(totals.netWorth).toBe(-60);
  });
});
