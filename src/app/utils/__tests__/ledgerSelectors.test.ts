import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllLedgerEvents,
  getLedgerEventsByDirection,
  getLedgerEventsByType,
  getLedgerEventsForDateRange,
} from '../ledgerSelectors';
import { Account, Debt, Deposit, FundTransaction, Transaction, WealthSnapshot } from '../../types';

const fixedNow = new Date('2026-01-15T08:00:00.000Z');

const transaction: Transaction = {
  id: 't1',
  date: '2026-01-10',
  amount: 120,
  categoryId: 'c1',
  description: 'Salary',
  type: 'income',
};

const fundTransaction: FundTransaction = {
  id: 'f1',
  assetClass: 'fund',
  date: '2026-01-08',
  fund: 'Index Fund',
  units: 2,
  price: 50,
  amount: 100,
  type: 'buy',
};

const deposit: Deposit = {
  id: 'd1',
  principal: 500,
  termDays: 30,
  grossRate: 12,
  withholdingTaxRate: 10,
  startDate: '2026-01-05',
  maturityDate: '2026-02-04',
  grossInterest: 0,
  withholdingTaxAmount: 0,
  netInterest: 0,
  maturityValue: 0,
  daysRemaining: 0,
  status: 'active',
};

const debt: Debt = {
  id: 'debt1',
  name: 'Car Loan',
  totalAmount: 10000,
  currentBalance: 8000,
  interestRate: 7.5,
  minimumPayment: 220,
};

const account: Account = {
  id: 'a1',
  name: 'Checking',
  type: 'checking',
  openingBalance: 0,
  currentBalance: 1500,
  isAsset: true,
};

const snapshot: WealthSnapshot = {
  id: 's1',
  date: '2026-01-12',
  totalAssets: 3000,
  totalDebts: 1000,
  netWealth: 2000,
  cash: 1000,
  funds: 1000,
  deposits: 500,
  gold: 0,
  blockedAssets: 0,
  otherAssets: 500,
};

describe('ledgerSelectors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns deterministic sorted events with mixed source types', () => {
    const events = getAllLedgerEvents({
      transactions: [transaction],
      fundTransactions: [fundTransaction],
      deposits: [deposit],
      debts: [debt],
      accounts: [account],
      wealthSnapshots: [snapshot],
    });

    const ids = events.map(event => event.id);
    expect(ids).toEqual([
      'acct:a1',
      'debt:debt1',
      'snapshot:s1',
      'txn:t1',
      'fund:f1',
      'dep:d1',
    ]);

    const accountEvent = events.find(event => event.id === 'acct:a1');
    const debtEvent = events.find(event => event.id === 'debt:debt1');
    const snapshotEvent = events.find(event => event.id === 'snapshot:s1');
    expect(accountEvent?.direction).toBe('valuation');
    expect(debtEvent?.direction).toBe('valuation');
    expect(snapshotEvent?.sourceType).toBe('adjustment');
  });

  it('handles missing arrays safely', () => {
    const events = getAllLedgerEvents({});
    expect(events).toEqual([]);
  });

  it('filters events by source type', () => {
    const events = getAllLedgerEvents({
      transactions: [transaction],
      fundTransactions: [fundTransaction],
    });
    const filtered = getLedgerEventsByType(events, 'transaction');
    expect(filtered.map(event => event.id)).toEqual(['txn:t1']);
  });

  it('filters events by direction', () => {
    const events = getAllLedgerEvents({
      transactions: [transaction],
      fundTransactions: [fundTransaction],
    });
    const inflows = getLedgerEventsByDirection(events, 'inflow');
    const outflows = getLedgerEventsByDirection(events, 'outflow');
    expect(inflows.map(event => event.id)).toEqual(['txn:t1']);
    expect(outflows.map(event => event.id)).toEqual(['fund:f1']);
  });

  it('filters events by date range inclusively', () => {
    const events = getAllLedgerEvents({
      transactions: [transaction],
      fundTransactions: [fundTransaction],
      deposits: [deposit],
      wealthSnapshots: [snapshot],
    });

    const filtered = getLedgerEventsForDateRange(events, {
      start: '2026-01-08',
      end: '2026-01-12',
    });

    expect(filtered.map(event => event.id)).toEqual([
      'snapshot:s1',
      'txn:t1',
      'fund:f1',
    ]);
  });
});
