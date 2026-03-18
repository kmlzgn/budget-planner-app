import { FundHoldingMeta, FundTransaction } from '../types';

export type FundHolding = {
  accountId?: string;
  fund: string;
  netUnits: number;
  totalBuyAmount: number;
  totalBuyUnits: number;
  avgCost: number;
  costBasis: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  withholdingTaxRate: number;
  taxAdjustedValue: number;
  lastPrice: number;
  lastDate: string;
};

export const calculateFundHoldings = (
  transactions: FundTransaction[],
  meta: FundHoldingMeta[]
): FundHolding[] => {
  const metaByFund = new Map(meta.map(m => [m.fund, m]));
  const holdingsMap = new Map<string, FundHolding>();

  transactions.forEach(tx => {
    const key = `${tx.accountId ?? 'none'}|${tx.fund}`;
    const existing = holdingsMap.get(key) ?? {
      accountId: tx.accountId,
      fund: tx.fund,
      netUnits: 0,
      totalBuyAmount: 0,
      totalBuyUnits: 0,
      avgCost: 0,
      costBasis: 0,
      currentPrice: 0,
      currentValue: 0,
      unrealizedPnL: 0,
      unrealizedPnLPct: 0,
      withholdingTaxRate: 0,
      taxAdjustedValue: 0,
      lastPrice: 0,
      lastDate: '',
    };

    const units = tx.units ?? 0;
    const grossAmount = Math.abs(units * tx.price);
    if (units > 0) {
      existing.netUnits += units;
      existing.totalBuyAmount += grossAmount;
      existing.totalBuyUnits += units;
    } else if (units < 0) {
      existing.netUnits += units;
    }

    if (!existing.lastDate || tx.date > existing.lastDate) {
      existing.lastDate = tx.date;
      existing.lastPrice = tx.price;
    }

    holdingsMap.set(key, existing);
  });

  return Array.from(holdingsMap.values()).map(holding => {
    const metaItem = metaByFund.get(holding.fund);
    const avgCost = holding.totalBuyUnits > 0 ? holding.totalBuyAmount / holding.totalBuyUnits : 0;
    const currentPrice = metaItem?.currentPrice ?? holding.lastPrice ?? 0;
    const withholdingTaxRate = metaItem?.withholdingTaxRate ?? 0;
    const currentValue = holding.netUnits * currentPrice;
    const costBasis = holding.netUnits * avgCost;
    const unrealizedPnL = currentValue - costBasis;
    const unrealizedPnLPct = costBasis !== 0 ? (unrealizedPnL / costBasis) * 100 : 0;
    const gain = Math.max(0, unrealizedPnL);
    const taxAdjustedValue = currentValue - gain * (withholdingTaxRate / 100);

    return {
      ...holding,
      avgCost,
      costBasis,
      currentPrice,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPct,
      withholdingTaxRate,
      taxAdjustedValue,
    };
  });
};
