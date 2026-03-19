import { BudgetState } from '../types';
import { WealthTotals } from './wealthSelectors';

export type FundAllocationByFund = {
  fund: string;
  value: number;
  pct: number;
};

export type FundAllocationByAccount = {
  accountId?: string;
  value: number;
  pct: number;
};

export type FundPortfolioSummary = {
  totalValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  netInvested: number;
  nominalReturn: number;
  activeFundsCount: number;
  allocationsByFund: FundAllocationByFund[];
  allocationsByAccount: FundAllocationByAccount[];
  topHoldingPct: number;
  top3Pct: number;
  invalidTransactionCount: number;
  missingPriceCount: number;
  lowConfidence: boolean;
  realizedAvailable: boolean;
};

export const getFundPortfolioSummary = (state: BudgetState, wealthTotals: WealthTotals): FundPortfolioSummary => {
  const { fundHoldings, fundAssetsTotal, fundCostBasisTotal, fundUnrealizedPnL, fundUnrealizedPnLPct } = wealthTotals;
  const totalValue = fundAssetsTotal;

  const allocationByFundMap = new Map<string, number>();
  const allocationByAccountMap = new Map<string, number>();

  fundHoldings.forEach(holding => {
    allocationByFundMap.set(holding.fund, (allocationByFundMap.get(holding.fund) ?? 0) + holding.currentValue);
    const accountKey = holding.accountId ?? 'unassigned';
    allocationByAccountMap.set(accountKey, (allocationByAccountMap.get(accountKey) ?? 0) + holding.currentValue);
  });

  const allocationsByFund = Array.from(allocationByFundMap.entries())
    .map(([fund, value]) => ({
      fund,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const allocationsByAccount = Array.from(allocationByAccountMap.entries())
    .map(([accountId, value]) => ({
      accountId: accountId === 'unassigned' ? undefined : accountId,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const topHoldingPct = allocationsByFund[0]?.pct ?? 0;
  const top3Pct = allocationsByFund.slice(0, 3).reduce((sum, item) => sum + item.pct, 0);

  const invalidTransactionCount = state.fundTransactions.filter(t => !t.date || !t.fund || !t.price || t.units === 0).length;
  const missingPriceCount = fundHoldings.filter(h => h.currentPrice === 0 && h.lastPrice === 0).length;
  const lowConfidence = invalidTransactionCount > 0 || missingPriceCount > 0;

  return {
    totalValue,
    costBasis: fundCostBasisTotal,
    unrealizedPnL: fundUnrealizedPnL,
    unrealizedPnLPct: fundUnrealizedPnLPct,
    netInvested: wealthTotals.fundNetInvested,
    nominalReturn: wealthTotals.fundNominalReturn,
    activeFundsCount: wealthTotals.activeFundsCount,
    allocationsByFund,
    allocationsByAccount,
    topHoldingPct,
    top3Pct,
    invalidTransactionCount,
    missingPriceCount,
    lowConfidence,
    realizedAvailable: false,
  };
};
