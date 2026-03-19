import { describe, expect, it } from 'vitest';
import { getDerivedTransferEvents } from '../ledgerSelectors';
import { Transaction } from '../../types';

const makeBaseTransaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 't1',
  date: '2026-01-10',
  amount: 120,
  categoryId: 'c1',
  description: 'Payment',
  type: 'expense',
  ...overrides,
});

describe('getDerivedTransferEvents', () => {
  it('derives a transfer event for credit-card payments with both accounts', () => {
    const tx = makeBaseTransaction({
      transactionKind: 'credit-card-payment',
      paymentAccountId: 'checking-1',
      creditCardAccountId: 'cc-1',
      baseAmount: 120,
    });

    const events = getDerivedTransferEvents([tx]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'transfer:t1',
      sourceType: 'transfer-derived',
      direction: 'transfer',
      amount: 120,
      accountId: 'checking-1',
      counterpartyAccountId: 'cc-1',
    });
  });

  it('derives a transfer event for explicit account-to-account transfers', () => {
    const tx = makeBaseTransaction({
      transactionKind: 'standard',
      accountId: 'savings-1',
      paymentAccountId: 'checking-1',
      baseAmount: 250,
    });

    const events = getDerivedTransferEvents([tx]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'transfer:t1',
      sourceType: 'transfer-derived',
      direction: 'transfer',
      amount: 250,
      accountId: 'checking-1',
      counterpartyAccountId: 'savings-1',
    });
  });

  it('skips transactions without explicit credit-card payment markers', () => {
    const tx = makeBaseTransaction({});
    const events = getDerivedTransferEvents([tx]);
    expect(events).toEqual([]);
  });

  it('skips credit-card payments missing either account id', () => {
    const missingSource = makeBaseTransaction({
      transactionKind: 'credit-card-payment',
      creditCardAccountId: 'cc-1',
    });
    const missingDest = makeBaseTransaction({
      transactionKind: 'credit-card-payment',
      paymentAccountId: 'checking-1',
    });

    const events = getDerivedTransferEvents([missingSource, missingDest]);
    expect(events).toEqual([]);
  });

  it('skips account transfers without both account ids or with same account', () => {
    const missingCounterparty = makeBaseTransaction({
      transactionKind: 'standard',
      paymentAccountId: 'checking-1',
    });
    const sameAccount = makeBaseTransaction({
      transactionKind: 'standard',
      paymentAccountId: 'checking-1',
      accountId: 'checking-1',
    });

    const events = getDerivedTransferEvents([missingCounterparty, sameAccount]);
    expect(events).toEqual([]);
  });
});
