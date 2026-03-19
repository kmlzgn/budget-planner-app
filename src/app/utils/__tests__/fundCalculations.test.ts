import { describe, expect, it } from 'vitest';
import { calculateFundHoldings } from '../fundCalculations';
import { FundHoldingMeta, FundTransaction } from '../../types';

describe('calculateFundHoldings', () => {
  it('calculates cost basis and unrealized P/L from buys and sells', () => {
    const transactions: FundTransaction[] = [
      {
        id: 't1',
        assetClass: 'fund',
        date: '2026-01-05',
        fund: 'Alpha',
        units: 10,
        price: 10,
        amount: 100,
        type: 'buy',
      },
      {
        id: 't2',
        assetClass: 'fund',
        date: '2026-02-05',
        fund: 'Alpha',
        units: -2,
        price: 12,
        amount: -24,
        type: 'sell',
      },
    ];
    const meta: FundHoldingMeta[] = [
      { fund: 'Alpha', currentPrice: 11, withholdingTaxRate: 0 },
    ];

    const [holding] = calculateFundHoldings(transactions, meta);
    expect(holding.netUnits).toBe(8);
    expect(holding.avgCost).toBe(10);
    expect(holding.costBasis).toBe(80);
    expect(holding.currentPrice).toBe(11);
    expect(holding.currentValue).toBe(88);
    expect(holding.unrealizedPnL).toBe(8);
    expect(holding.unrealizedPnLPct).toBeCloseTo(10, 5);
  });
});
