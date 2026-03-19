import { BudgetState, Debt, RecurringTransaction, Transaction, WealthSnapshot } from '../types';
import { calculateActualForMonth, calculateRecurringForMonth } from './budgetCalculations';
import { getAllLedgerEventsWithTransfers, getLedgerEventsForDateRange } from './ledgerSelectors';
import { getWealthTotals, WealthTotals } from './wealthSelectors';

export type CashFlowSummary = {
  plannedIncome: number;
  plannedExpenses: number;
  plannedBalance: number;
  actualIncome: number;
  actualExpenses: number;
  actualBalance: number;
};

export const getMonthlyCashFlowSummary = (
  transactions: Transaction[],
  recurringTransactions: RecurringTransaction[],
  year: number,
  month: number
): CashFlowSummary => {
  const plannedIncome = calculateRecurringForMonth(recurringTransactions, year, month, 'income');
  const plannedExpenses = calculateRecurringForMonth(recurringTransactions, year, month, 'expense');
  const actualIncome = calculateActualForMonth(transactions, year, month, 'income');
  const actualExpenses = calculateActualForMonth(transactions, year, month, 'expense');

  return {
    plannedIncome,
    plannedExpenses,
    plannedBalance: plannedIncome - plannedExpenses,
    actualIncome,
    actualExpenses,
    actualBalance: actualIncome - actualExpenses,
  };
};

export type DebtSummary = {
  totalDebt: number;
  minimumPayments: number;
  debtCount: number;
  debtRatio: number | null;
};

export const getDebtSummary = (debts: Debt[], monthlyIncome?: number): DebtSummary => {
  const totalDebt = debts.reduce((sum, debt) => sum + Math.abs(debt.currentBalance || 0), 0);
  const minimumPayments = debts.reduce((sum, debt) => sum + (debt.minimumPayment || 0), 0);
  const debtRatio = monthlyIncome && monthlyIncome > 0 ? (minimumPayments / monthlyIncome) * 100 : null;

  return {
    totalDebt,
    minimumPayments,
    debtCount: debts.length,
    debtRatio,
  };
};

export type PortfolioAllocationItem = {
  key: 'cash' | 'funds' | 'deposits' | 'gold' | 'blocked' | 'other';
  name: string;
  value: number;
  color: string;
};

const allocationColors: Record<PortfolioAllocationItem['key'], string> = {
  cash: '#10b981',
  funds: '#6366f1',
  deposits: '#0ea5e9',
  gold: '#f59e0b',
  blocked: '#94a3b8',
  other: '#64748b',
};

export const getPortfolioAllocation = (
  wealthTotals: WealthTotals,
  labels: Record<PortfolioAllocationItem['key'], string>
): PortfolioAllocationItem[] => {
  const allocation: PortfolioAllocationItem[] = [
    { key: 'cash', name: labels.cash, value: wealthTotals.cashTotal, color: allocationColors.cash },
    { key: 'funds', name: labels.funds, value: wealthTotals.fundAssetsTotal, color: allocationColors.funds },
    { key: 'deposits', name: labels.deposits, value: wealthTotals.depositsTotal, color: allocationColors.deposits },
    { key: 'gold', name: labels.gold, value: wealthTotals.goldTotal, color: allocationColors.gold },
    { key: 'blocked', name: labels.blocked, value: wealthTotals.blockedAssetsTotal, color: allocationColors.blocked },
    { key: 'other', name: labels.other, value: wealthTotals.otherAssetsTotal, color: allocationColors.other },
  ];

  return allocation.filter(item => item.value > 0);
};

export type SnapshotChangeSummary = {
  lastSnapshot?: WealthSnapshot;
  prevSnapshot?: WealthSnapshot;
  hasChange: boolean;
  change: number;
  changePct: number;
};

export const getSnapshotChangeSummary = (snapshots: WealthSnapshot[]): SnapshotChangeSummary => {
  const snapshotsSorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const lastSnapshot = snapshotsSorted[snapshotsSorted.length - 1];
  const prevSnapshot = snapshotsSorted[snapshotsSorted.length - 2];
  const hasChange = snapshotsSorted.length >= 2 && Boolean(lastSnapshot && prevSnapshot);
  const change = hasChange && lastSnapshot && prevSnapshot ? lastSnapshot.netWealth - prevSnapshot.netWealth : 0;
  const changePct = hasChange && prevSnapshot?.netWealth
    ? (change / prevSnapshot.netWealth) * 100
    : 0;

  return { lastSnapshot, prevSnapshot, hasChange, change, changePct };
};

export const getNetWorthSummary = (state: BudgetState, today: Date) => getWealthTotals(state, today);

export type TransferAwareOutflowSummary = {
  outflowExTransfers: number;
  transferAwareBalance: number;
  hasDerivedTransfers: boolean;
  excludedTransferCount: number;
  showTransferAwareDetail: boolean;
};

export const getTransferAwareMonthlyOutflowSummary = (
  state: BudgetState,
  year: number,
  month: number
): TransferAwareOutflowSummary => {
  const monthStartStr = new Date(year, month, 1).toISOString().slice(0, 10);
  const monthEndStr = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const ledgerEvents = getAllLedgerEventsWithTransfers(state);
  const monthLedgerEvents = getLedgerEventsForDateRange(ledgerEvents, {
    start: monthStartStr,
    end: monthEndStr,
  });

  let excludedTransferCount = 0;
  const outflowExTransfers = monthLedgerEvents.reduce((sum, event) => {
    if (event.direction !== 'outflow') return sum;
    if (event.sourceType === 'transfer-derived') {
      excludedTransferCount += 1;
      return sum;
    }
    if (event.sourceType === 'transaction'
      && typeof event.metadata === 'object'
      && event.metadata
      && (event.metadata as { transactionKind?: string }).transactionKind === 'credit-card-payment') {
      excludedTransferCount += 1;
      return sum;
    }
    return sum + event.amount;
  }, 0);

  const transferAwareBalance = monthLedgerEvents.reduce((sum, event) => {
    if (event.direction === 'inflow') return sum + event.amount;
    if (event.direction !== 'outflow') return sum;
    // Ignore explicit credit-card payment outflows to reduce internal-transfer noise.
    if (event.sourceType === 'transaction'
      && typeof event.metadata === 'object'
      && event.metadata
      && (event.metadata as { transactionKind?: string }).transactionKind === 'credit-card-payment') {
      return sum;
    }
    return sum - event.amount;
  }, 0);

  const hasDerivedTransfers = monthLedgerEvents.some(event => event.sourceType === 'transfer-derived');
  const showTransferAwareDetail = hasDerivedTransfers && outflowExTransfers > 0;

  return {
    outflowExTransfers,
    transferAwareBalance,
    hasDerivedTransfers,
    excludedTransferCount,
    showTransferAwareDetail,
  };
};
