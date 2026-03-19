import { Debt, DebtStrategy } from '../types';
import { calculateDebtPayoffTimeline, getDebtPayoffOrder } from './budgetCalculations';

export type DebtDecisionSummary = {
  totalDebt: number;
  totalMinimumPayments: number;
  debtCount: number;
  monthsToDebtFree: number;
  totalInterestEstimate: number;
  monthsToDebtFreeBaseline: number;
  totalInterestBaseline: number;
  interestSaved: number;
  monthsSaved: number;
  missingRatesCount: number;
  missingPaymentCount: number;
  payoffOrder: Debt[];
};

const normalizeDebtsForTimeline = (debts: Debt[]): Debt[] =>
  debts.map(debt => {
    const paidAmount = debt.alreadyPaidAmount ?? 0;
    const paidInstallments = debt.alreadyPaidInstallments ?? 0;
    const installmentAmount = debt.installmentAmount ?? debt.minimumPayment ?? 0;
    const fallbackBalance = Math.max(
      0,
      (debt.totalAmount || 0) - paidAmount - (paidInstallments * installmentAmount)
    );
    const shouldFallback = debt.currentBalance <= 0 && debt.totalAmount > 0;
    return {
      ...debt,
      currentBalance: shouldFallback ? fallbackBalance : debt.currentBalance,
    };
  });

const extractTimelineTotals = (debts: Debt[], strategy: DebtStrategy, extraPayment: number) => {
  if (debts.length === 0) {
    return { monthsToDebtFree: 0, totalInterestEstimate: 0 };
  }
  const timeline = calculateDebtPayoffTimeline(debts, strategy, extraPayment);
  const monthsToDebtFree = timeline.length > 0 ? Math.max(...timeline.map(t => t.monthsToPayoff)) : 0;
  const totalInterestEstimate = timeline.reduce((sum, t) => sum + t.totalInterest, 0);
  return { monthsToDebtFree, totalInterestEstimate };
};

export const getDebtDecisionSummary = (
  debts: Debt[],
  strategy: DebtStrategy,
  extraPayment: number
): DebtDecisionSummary => {
  const normalizedDebts = normalizeDebtsForTimeline(debts);
  const totalDebt = normalizedDebts.reduce((sum, d) => sum + (d.currentBalance || 0), 0);
  const totalMinimumPayments = normalizedDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  const debtCount = normalizedDebts.length;
  const missingRatesCount = normalizedDebts.filter(d => !d.interestRate || d.interestRate <= 0).length;
  const missingPaymentCount = normalizedDebts.filter(d => !d.minimumPayment || d.minimumPayment <= 0).length;
  const payoffOrder = getDebtPayoffOrder(normalizedDebts, strategy);

  const current = extractTimelineTotals(normalizedDebts, strategy, extraPayment);
  const baseline = extractTimelineTotals(normalizedDebts, strategy, 0);

  const monthsSaved = Math.max(0, (baseline.monthsToDebtFree || 0) - (current.monthsToDebtFree || 0));
  const interestSaved = Math.max(0, (baseline.totalInterestEstimate || 0) - (current.totalInterestEstimate || 0));

  return {
    totalDebt,
    totalMinimumPayments,
    debtCount,
    monthsToDebtFree: current.monthsToDebtFree,
    totalInterestEstimate: current.totalInterestEstimate,
    monthsToDebtFreeBaseline: baseline.monthsToDebtFree,
    totalInterestBaseline: baseline.totalInterestEstimate,
    interestSaved,
    monthsSaved,
    missingRatesCount,
    missingPaymentCount,
    payoffOrder,
  };
};
