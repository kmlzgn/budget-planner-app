import { Transaction, RecurringTransaction, TransactionFrequency, Debt, DebtStrategy, Category, DebtInstallment, Account } from '../types';
import { startOfMonth, endOfMonth, isWithinInterval, addDays, addWeeks, addMonths, addQuarters, addYears, isBefore, isAfter, parseISO, format, getDaysInMonth } from 'date-fns';
import { generateId } from './id';

// Calculate occurrences of a recurring transaction within a date range
export const getRecurringTransactionOccurrences = (
  recurring: RecurringTransaction,
  startDate: Date,
  endDate: Date
): number => {
  if (!recurring.isActive) return 0;

  const transactionStart = parseISO(recurring.startDate);
  const transactionEnd = recurring.endDate ? parseISO(recurring.endDate) : endDate;

  // If transaction hasn't started yet or has ended
  if (isAfter(transactionStart, endDate) || isBefore(transactionEnd, startDate)) {
    return 0;
  }

  const effectiveStart = isAfter(transactionStart, startDate) ? transactionStart : startDate;
  const effectiveEnd = isBefore(transactionEnd, endDate) ? transactionEnd : endDate;

  let count = 0;
  let currentDate = effectiveStart;

  while (isBefore(currentDate, effectiveEnd) || currentDate.getTime() === effectiveEnd.getTime()) {
    count++;

    switch (recurring.frequency) {
      case 'once':
        return 1;
      case 'weekly':
        currentDate = addWeeks(currentDate, 1);
        break;
      case 'bi-weekly':
        currentDate = addWeeks(currentDate, 2);
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, 1);
        break;
      case 'quarterly':
        currentDate = addQuarters(currentDate, 1);
        break;
      case 'annually':
        currentDate = addYears(currentDate, 1);
        break;
    }

    if (count > 1000) break; // Safety limit
  }

  return count;
};

// Calculate total from recurring transactions for a month
export const calculateRecurringForMonth = (
  recurringTransactions: RecurringTransaction[],
  year: number,
  month: number,
  type: 'income' | 'expense'
): number => {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(new Date(year, month, 1));

  return recurringTransactions
    .filter(rt => rt.type === type && rt.isActive)
    .reduce((total, rt) => {
      const occurrences = getRecurringTransactionOccurrences(rt, monthStart, monthEnd);
      return total + (rt.amount * occurrences);
    }, 0);
};

// Calculate total from actual transactions for a month
export const calculateActualForMonth = (
  transactions: Transaction[],
  year: number,
  month: number,
  type: 'income' | 'expense'
): number => {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(new Date(year, month, 1));

  return transactions
    .filter(t => {
      const transDate = parseISO(t.date);
      return t.type === type &&
        t.transactionKind !== 'credit-card-payment' &&
        isWithinInterval(transDate, { start: monthStart, end: monthEnd });
    })
    .reduce((total, t) => total + t.amount, 0);
};

// Calculate by category for a month
export const calculateByCategoryForMonth = (
  transactions: Transaction[],
  recurringTransactions: RecurringTransaction[],
  year: number,
  month: number,
  categoryId: string
): { planned: number; actual: number } => {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(new Date(year, month, 1));

  const planned = recurringTransactions
    .filter(rt => rt.categoryId === categoryId && rt.isActive)
    .reduce((total, rt) => {
      const occurrences = getRecurringTransactionOccurrences(rt, monthStart, monthEnd);
      return total + (rt.amount * occurrences);
    }, 0);

  const actual = transactions
    .filter(t => {
      const transDate = parseISO(t.date);
      return t.transactionKind !== 'credit-card-payment' &&
        t.categoryId === categoryId &&
        isWithinInterval(transDate, { start: monthStart, end: monthEnd });
    })
    .reduce((total, t) => total + t.amount, 0);

  return { planned, actual };
};

// Calculate 50/30/20 breakdown
export const calculate503020 = (transactions: Transaction[], categories: Category[]) => {
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  
  let needs = 0;
  let wants = 0;
  let savings = 0;

  transactions.forEach(t => {
    if (t.type === 'expense' && t.transactionKind !== 'credit-card-payment') {
      const category = categoryMap.get(t.categoryId);
      if (category) {
        if (category.classification === 'needs') {
          needs += t.amount;
        } else if (category.classification === 'savings') {
          savings += t.amount;
        } else {
          wants += t.amount;
        }
      }
    }
  });

  const total = needs + wants + savings;

  return {
    needs,
    wants,
    savings,
    needsPercent: total > 0 ? (needs / total) * 100 : 0,
    wantsPercent: total > 0 ? (wants / total) * 100 : 0,
    savingsPercent: total > 0 ? (savings / total) * 100 : 0,
  };
};

// Calculate net worth
export const calculateAccountBalancesFromTransactions = (
  accounts: Account[],
  transactions: Transaction[],
  today: Date = new Date()
) => {
  const balances = new Map<string, number>();
  const accountById = new Map(accounts.map(account => [account.id, account]));
  accounts.forEach(account => {
    balances.set(account.id, account.openingBalance);
  });

  transactions.forEach(transaction => {
    if (transaction.transactionKind === 'credit-card-payment') {
      const paymentAccountId = transaction.paymentAccountId ?? transaction.accountId;
      if (!paymentAccountId) return;
      const current = balances.get(paymentAccountId);
      if (current === undefined) return;
      const accountAmount = Number.isFinite(transaction.accountAmount) ? (transaction.accountAmount as number) : transaction.amount;
      balances.set(paymentAccountId, current - accountAmount);
      return;
    }

    if (!transaction.accountId) return;
    const account = accountById.get(transaction.accountId);
    if (!account || account.type === 'credit-card') return;
    const current = balances.get(transaction.accountId);
    if (current === undefined) return;
    const accountAmount = Number.isFinite(transaction.accountAmount) ? (transaction.accountAmount as number) : transaction.amount;
    const delta = transaction.type === 'income' ? accountAmount : -accountAmount;
    balances.set(transaction.accountId, current + delta);
  });

  accounts
    .filter(account => account.type === 'credit-card')
    .forEach(card => {
      const summary = getCreditCardCycleSummary(card, transactions, today);
      const base = card.openingBalance ?? 0;
      balances.set(card.id, base + (summary?.unpaidStatementBalance ?? 0));
    });

  return balances;
};

const clampDay = (value: number | undefined, fallback: number) => {
  const num = Number.isFinite(value) ? Math.trunc(value as number) : fallback;
  return Math.min(31, Math.max(1, num));
};

const getStatementDateForMonth = (year: number, month: number, statementDay: number) => {
  const safeDay = Math.min(statementDay, getDaysInMonth(new Date(year, month, 1)));
  return new Date(year, month, safeDay);
};

const getLastStatementDate = (today: Date, statementDay: number) => {
  const year = today.getFullYear();
  const month = today.getMonth();
  const thisMonthStatement = getStatementDateForMonth(year, month, statementDay);
  if (today.getDate() >= statementDay) return thisMonthStatement;
  const prev = addMonths(thisMonthStatement, -1);
  return getStatementDateForMonth(prev.getFullYear(), prev.getMonth(), statementDay);
};

const getDueDateForStatement = (statementDate: Date, statementDay: number, dueDay: number) => {
  const base = dueDay <= statementDay ? addMonths(statementDate, 1) : statementDate;
  return getStatementDateForMonth(base.getFullYear(), base.getMonth(), dueDay);
};

export type CreditCardCycleSummary = {
  statementDate: string;
  dueDate: string;
  statementBalance: number;
  unpaidStatementBalance: number;
  unbilledSpending: number;
  totalExposure: number;
  paidAmount: number;
};

export const getCreditCardCycleSummary = (
  account: Account,
  transactions: Transaction[],
  today: Date = new Date()
): CreditCardCycleSummary | null => {
  if (account.type !== 'credit-card') return null;

  const statementDay = clampDay(account.statementDay, 1);
  const dueDay = clampDay(account.dueDay, Math.min(statementDay + 10, 28));
  const lastStatementDate = getLastStatementDate(today, statementDay);
  const prevStatementDate = getStatementDateForMonth(
    addMonths(lastStatementDate, -1).getFullYear(),
    addMonths(lastStatementDate, -1).getMonth(),
    statementDay
  );
  const statementStart = addDays(prevStatementDate, 1);
  const statementEnd = lastStatementDate;

  const cardPurchases = transactions.filter(t =>
    t.transactionKind !== 'credit-card-payment' && t.accountId === account.id
  );
  const cardPayments = transactions.filter(t =>
    t.transactionKind === 'credit-card-payment' && t.creditCardAccountId === account.id
  );

  const statementBalance = cardPurchases
    .filter(t => {
      const transDate = parseISO(t.date);
      return isWithinInterval(transDate, { start: statementStart, end: statementEnd });
    })
    .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);

  const unbilledSpending = cardPurchases
    .filter(t => parseISO(t.date) > statementEnd)
    .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);

  const paidAmount = cardPayments
    .filter(t => parseISO(t.date) > statementEnd)
    .reduce((sum, t) => sum + t.amount, 0);

  const unpaidStatementBalance = Math.max(0, statementBalance - paidAmount);
  const overpayment = Math.max(0, paidAmount - statementBalance);
  const adjustedUnbilledSpending = Math.max(0, unbilledSpending - overpayment);
  const totalExposure = unpaidStatementBalance + adjustedUnbilledSpending;
  const dueDate = getDueDateForStatement(lastStatementDate, statementDay, dueDay);

  return {
    statementDate: format(lastStatementDate, 'yyyy-MM-dd'),
    dueDate: format(dueDate, 'yyyy-MM-dd'),
    statementBalance,
    unpaidStatementBalance,
    unbilledSpending: adjustedUnbilledSpending,
    totalExposure,
    paidAmount,
  };
};

export const calculateNetWorth = (accounts: Account[], balances?: Map<string, number>) => {
  const assets = accounts
    .filter(a => a.isAsset)
    .reduce((sum, a) => sum + (balances?.get(a.id) ?? a.currentBalance), 0);

  const liabilities = accounts
    .filter(a => !a.isAsset)
    .reduce((sum, a) => sum + Math.abs(balances?.get(a.id) ?? a.currentBalance), 0);

  return assets - liabilities;
};

// Generate dates for recurring transactions in a month
export const getRecurringDatesForMonth = (
  recurring: RecurringTransaction,
  year: number,
  month: number
): Date[] => {
  if (!recurring.isActive) return [];

  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(new Date(year, month, 1));
  const transactionStart = parseISO(recurring.startDate);
  const transactionEnd = recurring.endDate ? parseISO(recurring.endDate) : monthEnd;

  if (isAfter(transactionStart, monthEnd) || isBefore(transactionEnd, monthStart)) {
    return [];
  }

  const dates: Date[] = [];
  let currentDate = transactionStart;

  while (isBefore(currentDate, monthEnd) || currentDate.getTime() === monthEnd.getTime()) {
    if (isWithinInterval(currentDate, { start: monthStart, end: monthEnd })) {
      dates.push(new Date(currentDate));
    }

    if (recurring.frequency === 'once') break;

    switch (recurring.frequency) {
      case 'weekly':
        currentDate = addWeeks(currentDate, 1);
        break;
      case 'bi-weekly':
        currentDate = addWeeks(currentDate, 2);
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, 1);
        break;
      case 'quarterly':
        currentDate = addQuarters(currentDate, 1);
        break;
      case 'annually':
        currentDate = addYears(currentDate, 1);
        break;
    }

    if (recurring.endDate && isAfter(currentDate, transactionEnd)) break;
    if (dates.length > 100) break; // Safety limit
  }

  return dates;
};

export const calculateInstallmentAmount = (
  principal: number,
  monthlyRatePercent: number,
  count: number
) => {
  if (count <= 0 || principal <= 0) return 0;
  const monthlyRate = monthlyRatePercent / 100;
  if (monthlyRate <= 0) return principal / count;
  const denominator = 1 - Math.pow(1 + monthlyRate, -count);
  if (denominator === 0) return principal / count;
  return principal * (monthlyRate / denominator);
};

export const buildDebtInstallments = (
  startDate: string | undefined,
  count: number,
  amount: number,
  frequency: TransactionFrequency,
  existing: DebtInstallment[] = []
): DebtInstallment[] => {
  if (!startDate || count <= 0 || amount <= 0) return [];

  const existingByDate = new Map(existing.map(i => [i.dueDate, i]));
  const installments: DebtInstallment[] = [];
  let currentDate = parseISO(startDate);

  for (let i = 0; i < count; i++) {
    const dueDate = format(currentDate, 'yyyy-MM-dd');
    const existingInstallment = existingByDate.get(dueDate);
    installments.push({
      id: existingInstallment?.id ?? generateId(),
      dueDate,
      amount,
      status: existingInstallment?.status ?? 'pending',
      transactionId: existingInstallment?.transactionId,
    });

    if (frequency === 'once') break;

    switch (frequency) {
      case 'weekly':
        currentDate = addWeeks(currentDate, 1);
        break;
      case 'bi-weekly':
        currentDate = addWeeks(currentDate, 2);
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, 1);
        break;
      case 'quarterly':
        currentDate = addQuarters(currentDate, 1);
        break;
      case 'annually':
        currentDate = addYears(currentDate, 1);
        break;
      case 'once':
        break;
    }
  }

  return installments;
};

export type DebtPayoffItem = {
  debt: Debt;
  monthsToPayoff: number;
  totalInterest: number;
  totalPaid: number;
};

export const getDebtPayoffOrder = (debts: Debt[], strategy: DebtStrategy): Debt[] => {
  const filtered = debts.filter(d => d.currentBalance > 0);

  if (strategy === 'snowball') {
    return filtered.sort((a, b) => a.currentBalance - b.currentBalance);
  }

  return filtered.sort((a, b) => b.interestRate - a.interestRate);
};

export const calculateDebtPayoffTimeline = (
  debts: Debt[],
  strategy: DebtStrategy,
  extraPayment: number
): DebtPayoffItem[] => {
  const orderedDebts = getDebtPayoffOrder(debts, strategy);
  let availablePayment = extraPayment;
  const timeline: DebtPayoffItem[] = [];

  let cumulativeMonths = 0;

  orderedDebts.forEach((debt, index) => {
    let balance = debt.currentBalance;
    const monthlyRate = debt.interestRate / 100 / 12;
    const payment = debt.minimumPayment + (index === 0 ? availablePayment : 0);

    let months = 0;
    let totalInterest = 0;

    if (payment <= balance * monthlyRate) {
      // Payment doesn't cover interest - will never pay off
      months = 999;
      totalInterest = 0;
    } else {
      while (balance > 0 && months < 500) {
        const interest = balance * monthlyRate;
        totalInterest += interest;
        balance = balance + interest - payment;
        months++;
      }
    }

    const totalPaid = debt.currentBalance + totalInterest;
    cumulativeMonths += months;
    timeline.push({ debt, monthsToPayoff: months, totalInterest, totalPaid });

    // After paying off this debt, add its minimum payment to extra payment for next debt
    availablePayment += debt.minimumPayment;
  });

  return timeline;
};
