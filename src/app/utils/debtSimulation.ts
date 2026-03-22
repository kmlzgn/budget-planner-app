import { Debt, DebtStrategy, TransactionFrequency } from '../types';

export type DebtReadinessStatus =
  | 'ready'
  | 'closed'
  | 'invalid_balance'
  | 'missing_payment'
  | 'missing_interest'
  | 'insufficient_payment';

export type DebtReadiness = {
  debt: Debt;
  status: DebtReadinessStatus;
  balance: number;
  monthlyPayment: number | null;
  monthlyRate: number | null;
};

export type DebtSimulationStatus = 'ok' | 'empty' | 'incomplete' | 'impossible';

export type DebtSimulationIssue = {
  debtId: string;
  status: DebtReadinessStatus;
};

export type DebtSimulationDebtResult = {
  debtId: string;
  name: string;
  balance: number;
  monthlyPayment: number;
  annualRate: number;
  monthsToPayoff: number | null;
  interestPaid: number;
  totalPaid: number;
};

export type DebtSimulationResult = {
  status: DebtSimulationStatus;
  issues: DebtSimulationIssue[];
  payoffOrder: Debt[];
  totalMonths: number | null;
  totalInterest: number | null;
  totalPaid: number | null;
  debtResults: DebtSimulationDebtResult[];
};

const getMonthlyPaymentFromFrequency = (amount: number, frequency: TransactionFrequency) => {
  switch (frequency) {
    case 'weekly':
      return amount * (52 / 12);
    case 'bi-weekly':
      return amount * (26 / 12);
    case 'quarterly':
      return amount / 3;
    case 'annually':
      return amount / 12;
    case 'once':
      return null;
    case 'monthly':
    default:
      return amount;
  }
};

export const normalizeDebtBalance = (debt: Debt): number => {
  const current = Number.isFinite(debt.currentBalance) ? debt.currentBalance : 0;
  if (current > 0) return current;
  const total = Number.isFinite(debt.totalAmount) ? debt.totalAmount : 0;
  const paidAmount = Number.isFinite(debt.alreadyPaidAmount) ? debt.alreadyPaidAmount : 0;
  const paidInstallments = Number.isFinite(debt.alreadyPaidInstallments) ? debt.alreadyPaidInstallments : 0;
  const installmentAmount = Number.isFinite(debt.installmentAmount)
    ? (debt.installmentAmount as number)
    : (Number.isFinite(debt.minimumPayment) ? (debt.minimumPayment as number) : 0);
  const fallback = Math.max(0, total - paidAmount - (paidInstallments * installmentAmount));
  return fallback;
};

export const getDebtMonthlyPayment = (debt: Debt): number | null => {
  const minimum = Number.isFinite(debt.minimumPayment) ? (debt.minimumPayment as number) : 0;
  const installment = Number.isFinite(debt.installmentAmount) ? (debt.installmentAmount as number) : 0;
  const basePayment = minimum > 0 ? minimum : installment;
  if (!Number.isFinite(basePayment) || basePayment <= 0) return null;
  const frequency = debt.installmentFrequency ?? 'monthly';
  return getMonthlyPaymentFromFrequency(basePayment, frequency);
};

export const getDebtMonthlyRate = (debt: Debt): number | null => {
  if (!Number.isFinite(debt.interestRate)) return null;
  const annualRate = debt.interestRate as number;
  if (annualRate < 0) return null;
  return (annualRate / 100) / 12;
};

export const getDebtReadiness = (debt: Debt): DebtReadiness => {
  const balance = normalizeDebtBalance(debt);
  if (!Number.isFinite(balance) || balance < 0) {
    return { debt, status: 'invalid_balance', balance: 0, monthlyPayment: null, monthlyRate: null };
  }
  if (balance === 0) {
    return { debt, status: 'closed', balance: 0, monthlyPayment: null, monthlyRate: null };
  }
  const monthlyPayment = getDebtMonthlyPayment(debt);
  if (monthlyPayment === null) {
    return { debt, status: 'missing_payment', balance, monthlyPayment: null, monthlyRate: null };
  }
  const monthlyRate = getDebtMonthlyRate(debt);
  if (monthlyRate === null) {
    return { debt, status: 'missing_interest', balance, monthlyPayment, monthlyRate: null };
  }
  if (monthlyRate > 0 && monthlyPayment <= balance * monthlyRate) {
    return { debt, status: 'insufficient_payment', balance, monthlyPayment, monthlyRate };
  }
  return { debt, status: 'ready', balance, monthlyPayment, monthlyRate };
};

export const orderDebtsForStrategy = (debts: Debt[], strategy: DebtStrategy): Debt[] => {
  const filtered = debts.filter(d => normalizeDebtBalance(d) > 0);
  if (strategy === 'snowball') {
    return filtered.sort((a, b) => normalizeDebtBalance(a) - normalizeDebtBalance(b));
  }
  return filtered.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
};

export const simulateDebtPayoff = (
  debts: Debt[],
  strategy: DebtStrategy,
  extraPayment: number
): DebtSimulationResult => {
  const readiness = debts.map(getDebtReadiness);
  const issues = readiness
    .filter(item => item.status !== 'ready' && item.status !== 'closed')
    .map(item => ({ debtId: item.debt.id, status: item.status }));

  const blockingIssues = issues.filter(issue =>
    issue.status === 'missing_payment' ||
    issue.status === 'missing_interest' ||
    issue.status === 'invalid_balance'
  );

  const activeDebts = readiness.filter(item => item.status === 'ready' || item.status === 'insufficient_payment');
  const payoffOrder = orderDebtsForStrategy(debts, strategy);

  if (activeDebts.length === 0) {
    return {
      status: debts.length === 0 ? 'empty' : 'incomplete',
      issues,
      payoffOrder,
      totalMonths: null,
      totalInterest: null,
      totalPaid: null,
      debtResults: [],
    };
  }

  if (blockingIssues.length > 0) {
    return {
      status: 'incomplete',
      issues,
      payoffOrder,
      totalMonths: null,
      totalInterest: null,
      totalPaid: null,
      debtResults: [],
    };
  }

  const balances = new Map<string, number>();
  const monthlyPayments = new Map<string, number>();
  const monthlyRates = new Map<string, number>();
  const interestById = new Map<string, number>();
  const paidById = new Map<string, number>();
  const payoffMonthById = new Map<string, number>();

  activeDebts.forEach(item => {
    balances.set(item.debt.id, item.balance);
    monthlyPayments.set(item.debt.id, item.monthlyPayment ?? 0);
    monthlyRates.set(item.debt.id, item.monthlyRate ?? 0);
    interestById.set(item.debt.id, 0);
    paidById.set(item.debt.id, 0);
  });

  const orderedIds = payoffOrder.map(debt => debt.id).filter(id => balances.has(id));
  let rollover = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const maxMonths = 1200;
  let month = 0;

  const hasActiveBalance = () => Array.from(balances.values()).some(value => value > 0.01);

  while (hasActiveBalance() && month < maxMonths) {
    month += 1;

    balances.forEach((balance, debtId) => {
      if (balance <= 0) return;
      const monthlyRate = monthlyRates.get(debtId) ?? 0;
      const interest = balance * monthlyRate;
      const newBalance = balance + interest;
      balances.set(debtId, newBalance);
      interestById.set(debtId, (interestById.get(debtId) ?? 0) + interest);
      totalInterest += interest;
    });

    const totalExtra = Math.max(0, extraPayment) + rollover;
    let extraRemaining = totalExtra;

    balances.forEach((balance, debtId) => {
      if (balance <= 0) return;
      const payment = monthlyPayments.get(debtId) ?? 0;
      if (payment <= 0) return;
      const applied = Math.min(payment, balance);
      balances.set(debtId, balance - applied);
      paidById.set(debtId, (paidById.get(debtId) ?? 0) + applied);
      totalPaid += applied;
    });

    if (extraRemaining > 0) {
      for (const debtId of orderedIds) {
        const balance = balances.get(debtId) ?? 0;
        if (balance <= 0) continue;
        const applied = Math.min(extraRemaining, balance);
        balances.set(debtId, balance - applied);
        paidById.set(debtId, (paidById.get(debtId) ?? 0) + applied);
        totalPaid += applied;
        extraRemaining -= applied;
        if (extraRemaining <= 0) break;
      }
    }

    balances.forEach((balance, debtId) => {
      if (balance > 0) return;
      if (payoffMonthById.has(debtId)) return;
      payoffMonthById.set(debtId, month);
      rollover += monthlyPayments.get(debtId) ?? 0;
    });
  }

  if (month >= maxMonths) {
    return {
      status: 'impossible',
      issues,
      payoffOrder,
      totalMonths: null,
      totalInterest: null,
      totalPaid: null,
      debtResults: [],
    };
  }

  const debtResults = payoffOrder
    .filter(debt => balances.has(debt.id))
    .map(debt => {
      const balance = normalizeDebtBalance(debt);
      const monthlyPayment = monthlyPayments.get(debt.id) ?? 0;
      const interestPaid = interestById.get(debt.id) ?? 0;
      const totalPaidForDebt = paidById.get(debt.id) ?? 0;
      const monthsToPayoff = payoffMonthById.get(debt.id) ?? null;
      return {
        debtId: debt.id,
        name: debt.name,
        balance,
        monthlyPayment,
        annualRate: debt.interestRate,
        monthsToPayoff,
        interestPaid,
        totalPaid: totalPaidForDebt,
      };
    });

  const totalMonths = debtResults.reduce((max, debt) => Math.max(max, debt.monthsToPayoff ?? 0), 0);

  return {
    status: 'ok',
    issues,
    payoffOrder,
    totalMonths,
    totalInterest,
    totalPaid,
    debtResults,
  };
};

export const getDebtStrategyComparison = (
  debts: Debt[],
  extraPayment: number
) => {
  const snowball = simulateDebtPayoff(debts, 'snowball', extraPayment);
  const avalanche = simulateDebtPayoff(debts, 'avalanche', extraPayment);
  if (snowball.status !== 'ok' || avalanche.status !== 'ok') return null;
  if (snowball.totalMonths === null || avalanche.totalMonths === null) return null;
  if (snowball.totalInterest === null || avalanche.totalInterest === null) return null;
  return {
    monthsDifference: snowball.totalMonths - avalanche.totalMonths,
    interestDifference: snowball.totalInterest - avalanche.totalInterest,
    snowball,
    avalanche,
  };
};

export const getExtraPaymentImpact = (
  debts: Debt[],
  strategy: DebtStrategy,
  extraPayment: number
) => {
  if (extraPayment <= 0) return null;
  const baseline = simulateDebtPayoff(debts, strategy, 0);
  const withExtra = simulateDebtPayoff(debts, strategy, extraPayment);
  if (baseline.status !== 'ok' || withExtra.status !== 'ok') return null;
  if (baseline.totalMonths === null || withExtra.totalMonths === null) return null;
  if (baseline.totalInterest === null || withExtra.totalInterest === null) return null;
  return {
    monthsSaved: Math.max(0, baseline.totalMonths - withExtra.totalMonths),
    interestSaved: Math.max(0, baseline.totalInterest - withExtra.totalInterest),
    baseline,
    withExtra,
  };
};
