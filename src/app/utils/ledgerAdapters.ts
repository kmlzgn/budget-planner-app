import { Account, Debt, Deposit, FundTransaction, Transaction } from '../types';

// Normalized ledger event model (forward-looking):
// - direction indicates sign; amount is always non-negative.
// - amountSemantics clarifies what the amount represents (base currency, account currency, units, or nominal balance).
// - sourceType/sourceId preserve the original record for a safe, gradual migration.
export type LedgerSourceType =
  | 'transaction'
  | 'fund-transaction'
  | 'deposit'
  | 'debt'
  | 'account'
  | 'adjustment'
  | 'transfer-derived';

export type LedgerDirection = 'inflow' | 'outflow' | 'transfer' | 'valuation';
export type LedgerAmountSemantics = 'base' | 'account' | 'units' | 'nominal';

export interface LedgerEvent {
  id: string;
  date: string;
  sourceType: LedgerSourceType;
  sourceId?: string;
  direction: LedgerDirection;
  amount: number;
  amountSemantics: LedgerAmountSemantics;
  currency?: string;
  accountId?: string;
  counterpartyAccountId?: string;
  categoryId?: string;
  description?: string;
  assetClass?: 'fund' | 'deposit' | 'commodity' | 'cash' | 'other';
  units?: number;
  price?: number;
  metadata?: Record<string, unknown>;
}

export const normalizeLedgerAmount = (amount: number | undefined) => Math.abs(amount ?? 0);

export const getSignedAmount = (direction: LedgerDirection, amount: number) => {
  if (direction === 'inflow') return amount;
  if (direction === 'outflow') return -amount;
  return 0;
};

export const isIncomeTransaction = (transaction: Transaction) => transaction.type === 'income';
export const isExpenseTransaction = (transaction: Transaction) => transaction.type === 'expense';
export const isFundBuy = (transaction: FundTransaction) => transaction.type === 'buy';
export const isFundSell = (transaction: FundTransaction) => transaction.type === 'sell';

export const toLedgerEventFromTransaction = (transaction: Transaction): LedgerEvent => {
  const amount = normalizeLedgerAmount(transaction.baseAmount ?? transaction.amount);
  return {
    id: `txn:${transaction.id}`,
    date: transaction.date,
    sourceType: 'transaction',
    sourceId: transaction.id,
    direction: isIncomeTransaction(transaction) ? 'inflow' : 'outflow',
    amount,
    amountSemantics: 'base',
    currency: transaction.accountCurrency,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    description: transaction.description,
    metadata: {
      transactionKind: transaction.transactionKind ?? 'standard',
      fxRateToBase: transaction.fxRateToBase,
      accountAmount: transaction.accountAmount,
      baseAmount: transaction.baseAmount,
    },
  };
};

export const toLedgerEventFromFundTransaction = (transaction: FundTransaction): LedgerEvent => {
  const amount = normalizeLedgerAmount(transaction.amount);
  return {
    id: `fund:${transaction.id}`,
    date: transaction.date,
    sourceType: 'fund-transaction',
    sourceId: transaction.id,
    direction: isFundBuy(transaction) ? 'outflow' : 'inflow',
    amount,
    amountSemantics: 'base',
    accountId: transaction.accountId,
    assetClass: 'fund',
    units: transaction.units,
    price: transaction.price,
    description: transaction.fund,
    metadata: {
      spender: transaction.spender,
      cashTransactionId: transaction.cashTransactionId,
    },
  };
};

export const toLedgerEventFromDeposit = (deposit: Deposit): LedgerEvent => ({
  id: `dep:${deposit.id}`,
  date: deposit.startDate,
  sourceType: 'deposit',
  sourceId: deposit.id,
  direction: 'outflow',
  amount: normalizeLedgerAmount(deposit.principal),
  amountSemantics: 'nominal',
  assetClass: 'deposit',
  description: deposit.institution ?? deposit.owner ?? 'Deposit',
  metadata: {
    maturityDate: deposit.maturityDate,
    grossRate: deposit.grossRate,
    netInterest: deposit.netInterest,
    status: deposit.status,
  },
});

export const toLedgerEventFromDebt = (debt: Debt): LedgerEvent => ({
  id: `debt:${debt.id}`,
  date: debt.installmentStartDate ?? new Date().toISOString().slice(0, 10),
  sourceType: 'debt',
  sourceId: debt.id,
  direction: 'valuation',
  amount: normalizeLedgerAmount(debt.currentBalance),
  amountSemantics: 'nominal',
  assetClass: 'other',
  description: debt.name,
  accountId: debt.accountId,
  metadata: {
    totalAmount: debt.totalAmount,
    interestRate: debt.interestRate,
    minimumPayment: debt.minimumPayment,
  },
});

export const toLedgerEventFromAccount = (account: Account): LedgerEvent => ({
  id: `acct:${account.id}`,
  date: new Date().toISOString().slice(0, 10),
  sourceType: 'account',
  sourceId: account.id,
  direction: 'valuation',
  amount: normalizeLedgerAmount(account.currentBalance),
  amountSemantics: 'nominal',
  currency: account.currency,
  accountId: account.id,
  assetClass: account.isAsset ? 'cash' : 'other',
  description: account.name,
  metadata: {
    type: account.type,
    openingBalance: account.openingBalance,
    isAsset: account.isAsset,
  },
});

export const toLedgerEventFromAccountBalance = (
  account: Account,
  balance: number,
  date: string = new Date().toISOString().slice(0, 10)
): LedgerEvent => ({
  id: `acct:${account.id}`,
  date,
  sourceType: 'account',
  sourceId: account.id,
  direction: 'valuation',
  amount: normalizeLedgerAmount(balance),
  amountSemantics: 'nominal',
  currency: account.currency,
  accountId: account.id,
  assetClass: account.isAsset ? 'cash' : 'other',
  description: account.name,
  metadata: {
    type: account.type,
    openingBalance: account.openingBalance,
    isAsset: account.isAsset,
  },
});
