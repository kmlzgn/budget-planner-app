import { Debt, DebtStrategy } from '../types';
import {
  DebtSimulationResult,
  getDebtMonthlyPayment,
  getDebtReadiness,
  getExtraPaymentImpact,
  getDebtStrategyComparison,
  normalizeDebtBalance,
  orderDebtsForStrategy,
  simulateDebtPayoff,
} from './debtSimulation';

export type DebtDecisionSummary = {
  totalDebt: number;
  totalMinimumPayments: number | null;
  debtCount: number;
  monthsToDebtFree: number | null;
  totalInterestEstimate: number | null;
  monthsToDebtFreeBaseline: number | null;
  totalInterestBaseline: number | null;
  interestSaved: number | null;
  monthsSaved: number | null;
  missingRatesCount: number;
  missingPaymentCount: number;
  insufficientPaymentCount: number;
  invalidBalanceCount: number;
  payoffOrder: Debt[];
  simulation: DebtSimulationResult;
  baselineSimulation: DebtSimulationResult;
  extraPaymentImpact: ReturnType<typeof getExtraPaymentImpact> | null;
  strategyComparison: ReturnType<typeof getDebtStrategyComparison> | null;
};

export const getDebtDecisionSummary = (
  debts: Debt[],
  strategy: DebtStrategy,
  extraPayment: number
): DebtDecisionSummary => {
  const readiness = debts.map(getDebtReadiness);
  const totalDebt = readiness.reduce((sum, item) => sum + (item.balance || 0), 0);
  const totalMinimumPaymentsRaw = readiness.reduce((sum, item) => {
    const payment = getDebtMonthlyPayment(item.debt);
    return sum + (payment ?? 0);
  }, 0);
  const totalMinimumPayments = totalMinimumPaymentsRaw > 0 ? totalMinimumPaymentsRaw : null;
  const debtCount = debts.length;
  const missingRatesCount = readiness.filter(r => r.status === 'missing_interest').length;
  const missingPaymentCount = readiness.filter(r => r.status === 'missing_payment').length;
  const insufficientPaymentCount = readiness.filter(r => r.status === 'insufficient_payment').length;
  const invalidBalanceCount = readiness.filter(r => r.status === 'invalid_balance').length;

  const simulation = simulateDebtPayoff(debts, strategy, extraPayment);
  const baselineSimulation = simulateDebtPayoff(debts, strategy, 0);

  const monthsToDebtFree = simulation.status === 'ok' ? simulation.totalMonths : null;
  const totalInterestEstimate = simulation.status === 'ok' ? simulation.totalInterest : null;
  const monthsToDebtFreeBaseline = baselineSimulation.status === 'ok' ? baselineSimulation.totalMonths : null;
  const totalInterestBaseline = baselineSimulation.status === 'ok' ? baselineSimulation.totalInterest : null;

  const extraPaymentImpact = getExtraPaymentImpact(debts, strategy, extraPayment);
  const strategyComparison = getDebtStrategyComparison(debts, extraPayment);

  const monthsSaved = extraPaymentImpact ? extraPaymentImpact.monthsSaved : null;
  const interestSaved = extraPaymentImpact ? extraPaymentImpact.interestSaved : null;

  const payoffOrder = orderDebtsForStrategy(
    debts.map(debt => ({ ...debt, currentBalance: normalizeDebtBalance(debt) })),
    strategy
  );

  return {
    totalDebt,
    totalMinimumPayments,
    debtCount,
    monthsToDebtFree,
    totalInterestEstimate,
    monthsToDebtFreeBaseline,
    totalInterestBaseline,
    interestSaved,
    monthsSaved,
    missingRatesCount,
    missingPaymentCount,
    insufficientPaymentCount,
    invalidBalanceCount,
    payoffOrder,
    simulation,
    baselineSimulation,
    extraPaymentImpact,
    strategyComparison,
  };
};
