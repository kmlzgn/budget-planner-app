import { Account, BudgetState, Debt, Deposit, FundTransaction, Transaction, WealthSnapshot } from '../types';
import {
  LedgerDirection,
  LedgerEvent,
  LedgerSourceType,
  toLedgerEventFromAccount,
  toLedgerEventFromAccountBalance,
  toLedgerEventFromDebt,
  toLedgerEventFromDeposit,
  toLedgerEventFromFundTransaction,
  toLedgerEventFromTransaction,
} from './ledgerAdapters';
import { getDerivedAccountBalances } from './accountBalanceSelectors';

// Read-only, derived ledger timeline for analytics.
// Assumptions:
// - Dates are ISO-like strings and sort lexicographically.
// - Accounts/Debts are treated as point-in-time valuations (date = today).
// - Wealth snapshots are mapped as valuation events (sourceType: 'adjustment').
const getSortableDate = (value?: string) => value ?? '';

const compareLedgerEvents = (a: LedgerEvent, b: LedgerEvent) => {
  const dateA = getSortableDate(a.date);
  const dateB = getSortableDate(b.date);
  if (dateA !== dateB) return dateA > dateB ? -1 : 1;
  if (a.sourceType !== b.sourceType) return a.sourceType.localeCompare(b.sourceType);
  return a.id.localeCompare(b.id);
};

const toLedgerEventFromWealthSnapshot = (snapshot: WealthSnapshot): LedgerEvent => ({
  id: `snapshot:${snapshot.id}`,
  date: snapshot.date,
  sourceType: 'adjustment',
  sourceId: snapshot.id,
  direction: 'valuation',
  amount: Math.abs(snapshot.netWealth ?? 0),
  amountSemantics: 'nominal',
  assetClass: 'other',
  description: 'Wealth snapshot',
  metadata: {
    totalAssets: snapshot.totalAssets,
    totalDebts: snapshot.totalDebts,
    netWealth: snapshot.netWealth,
  },
});

const toLedgerEvents = <T>(
  items: T[] | undefined,
  mapper: (item: T) => LedgerEvent
) => (Array.isArray(items) ? items.map(mapper) : []);

export interface LedgerSelectorInput {
  transactions?: Transaction[];
  fundTransactions?: FundTransaction[];
  deposits?: Deposit[];
  debts?: Debt[];
  accounts?: Account[];
  wealthSnapshots?: WealthSnapshot[];
}

export const getAllLedgerEvents = (input: LedgerSelectorInput | BudgetState): LedgerEvent[] => {
  const source = 'settings' in input ? input : (input as LedgerSelectorInput);
  const accountBalances = 'settings' in input ? getDerivedAccountBalances(input) : undefined;
  const events = [
    ...toLedgerEvents(source.transactions, toLedgerEventFromTransaction),
    ...toLedgerEvents(source.fundTransactions, toLedgerEventFromFundTransaction),
    ...toLedgerEvents(source.deposits, toLedgerEventFromDeposit),
    ...toLedgerEvents(source.debts, toLedgerEventFromDebt),
    ...(accountBalances
      ? toLedgerEvents(source.accounts, account =>
          toLedgerEventFromAccountBalance(account, accountBalances.get(account.id) ?? account.openingBalance ?? 0)
        )
      : toLedgerEvents(source.accounts, toLedgerEventFromAccount)),
    ...toLedgerEvents(source.wealthSnapshots, toLedgerEventFromWealthSnapshot),
  ];
  return events.sort(compareLedgerEvents);
};

export const getLedgerEventsByType = (
  events: LedgerEvent[],
  sourceType: LedgerSourceType
) => events.filter(event => event.sourceType === sourceType);

export const getLedgerEventsByDirection = (
  events: LedgerEvent[],
  direction: LedgerDirection
) => events.filter(event => event.direction === direction);

export interface LedgerDateRange {
  start?: string;
  end?: string;
}

export const getLedgerEventsForDateRange = (
  events: LedgerEvent[],
  range: LedgerDateRange
) => {
  const start = getSortableDate(range.start);
  const end = getSortableDate(range.end);
  return events.filter(event => {
    const date = getSortableDate(event.date);
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });
};

// Derived transfer pairing (read-only, additive).
// Matching assumptions (precision over recall):
// - Credit-card payments require explicit transactionKind and both account ids.
// - Account-to-account transfers require explicit paymentAccountId + accountId
//   and a standard transactionKind. No fuzzy category/name inference.
// - Uses the transaction date and base amount; no inference across unrelated events.
export const getDerivedTransferEvents = (
  transactions: Transaction[] | undefined
): LedgerEvent[] => {
  if (!Array.isArray(transactions)) return [];
  return transactions
    .map(transaction => {
      const isCreditCardPayment =
        transaction.transactionKind === 'credit-card-payment' &&
        Boolean(transaction.paymentAccountId) &&
        Boolean(transaction.creditCardAccountId);
      const isAccountTransfer =
        transaction.transactionKind === 'standard' &&
        Boolean(transaction.paymentAccountId) &&
        Boolean(transaction.accountId) &&
        transaction.paymentAccountId !== transaction.accountId &&
        !transaction.creditCardAccountId;

      if (!isCreditCardPayment && !isAccountTransfer) return null;

      return {
        id: `transfer:${transaction.id}`,
        date: transaction.date,
        sourceType: 'transfer-derived',
        sourceId: transaction.id,
        direction: 'transfer',
        amount: Math.abs(transaction.baseAmount ?? transaction.amount ?? 0),
        amountSemantics: 'base',
        accountId: transaction.paymentAccountId,
        counterpartyAccountId: isCreditCardPayment
          ? transaction.creditCardAccountId
          : transaction.accountId,
        description: transaction.description,
        metadata: {
          transactionKind: transaction.transactionKind,
          transferType: isCreditCardPayment ? 'credit-card-payment' : 'account-transfer',
        },
      } satisfies LedgerEvent;
    })
    .filter((event): event is LedgerEvent => Boolean(event));
};

export const getAllLedgerEventsWithTransfers = (
  input: LedgerSelectorInput | BudgetState
): LedgerEvent[] => {
  const baseEvents = getAllLedgerEvents(input);
  const source = 'settings' in input ? input : (input as LedgerSelectorInput);
  const transferEvents = getDerivedTransferEvents(source.transactions);
  return [...baseEvents, ...transferEvents].sort(compareLedgerEvents);
};
