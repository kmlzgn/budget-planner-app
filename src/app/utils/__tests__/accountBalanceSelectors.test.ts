import { describe, expect, it } from 'vitest';
import { getDerivedAccountBalances } from '../accountBalanceSelectors';
import { Account, BudgetState, Transaction } from '../../types';

const buildState = (overrides: Partial<BudgetState>): BudgetState => ({
  schemaVersion: 1,
  settings: {
    currency: 'USD',
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

describe('getDerivedAccountBalances', () => {
  it('derives balances for checking, FX, commodities, and pension accounts', () => {
    const accounts: Account[] = [
      {
        id: 'checking',
        name: 'Checking',
        type: 'checking',
        openingBalance: 1000,
        currentBalance: 1000,
        isAsset: true,
      },
      {
        id: 'fx',
        name: 'EUR Checking',
        type: 'checking',
        openingBalance: 100,
        currentBalance: 100,
        isAsset: true,
        currency: 'EUR',
        isForeignCurrency: true,
      },
      {
        id: 'gold',
        name: 'Gold Vault',
        type: 'commodities',
        openingBalance: 0,
        currentBalance: 0,
        isAsset: true,
        commodityName: 'Gold',
        commodityUnits: 2,
        commodityValuationMode: 'auto',
      },
      {
        id: 'pension',
        name: 'Pension',
        type: 'pension',
        openingBalance: 0,
        currentBalance: 0,
        isAsset: true,
        pensionFundValue: 500,
        governmentContribution: 50,
      },
      {
        id: 'retirement',
        name: 'Retirement',
        type: 'retirement',
        openingBalance: 0,
        currentBalance: 0,
        isAsset: true,
        pensionFundValue: 200,
        governmentContribution: 20,
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 't1',
        date: '2026-01-02',
        amount: 200,
        accountAmount: 200,
        categoryId: 'c1',
        accountId: 'checking',
        description: 'Paycheck',
        type: 'income',
      },
      {
        id: 't2',
        date: '2026-01-03',
        amount: 50,
        accountAmount: 50,
        categoryId: 'c1',
        accountId: 'checking',
        description: 'Groceries',
        type: 'expense',
      },
      {
        id: 't3',
        date: '2026-01-05',
        amount: 12,
        accountAmount: 10,
        categoryId: 'c1',
        accountId: 'fx',
        description: 'EUR deposit',
        type: 'income',
      },
    ];

    const state = buildState({
      accounts,
      transactions,
      marketData: {
        fxRates: [],
        commodities: [{ commodity: 'Gold', price: 50, mode: 'manual' }],
      },
    });

    const balances = getDerivedAccountBalances(state, new Date('2026-01-10'));

    expect(balances.get('checking')).toBe(1150);
    expect(balances.get('fx')).toBe(110);
    expect(balances.get('gold')).toBe(100);
    expect(balances.get('pension')).toBe(550);
    expect(balances.get('retirement')).toBe(220);
  });
});
