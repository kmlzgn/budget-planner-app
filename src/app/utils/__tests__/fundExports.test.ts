import { describe, expect, it } from 'vitest';
import { buildFundExportRows, fundExportHeaders } from '../fundExports';
import { FundTransaction } from '../../types';

describe('buildFundExportRows', () => {
  it('preserves fractional units for buy and sell exports', () => {
    const transactions: FundTransaction[] = [
      {
        id: 'buy-1',
        assetClass: 'fund',
        date: '2026-03-01',
        fund: 'Alpha',
        accountId: 'acc-1',
        units: 7722.6966,
        price: 1.23,
        amount: 9498.916818,
        type: 'buy',
      },
      {
        id: 'sell-1',
        assetClass: 'fund',
        date: '2026-03-05',
        fund: 'Alpha',
        accountId: 'acc-1',
        units: -12.345,
        price: 3.5,
        amount: -43.2075,
        type: 'sell',
      },
    ];

    const rows = buildFundExportRows(transactions, () => 'Main Account');

    expect(fundExportHeaders).toEqual(['Date', 'Fund', 'Account', 'Owner', 'Units', 'Price', 'Amount']);
    expect(rows[0][4]).toBe(7722.6966);
    expect(rows[0][6]).toBeCloseTo(Math.abs(7722.6966 * 1.23), 10);
    expect(rows[1][4]).toBe(-12.345);
    expect(rows[1][6]).toBeCloseTo(Math.abs(-12.345 * 3.5), 10);
  });

  it('round-trips export rows with full numeric precision', () => {
    const transactions: FundTransaction[] = [
      {
        id: 'buy-2',
        assetClass: 'fund',
        date: '2026-03-10',
        fund: 'Beta',
        accountId: 'acc-2',
        units: 7722.6966,
        price: 1.2345,
        amount: 7722.6966 * 1.2345,
        type: 'buy',
      },
    ];

    const rows = buildFundExportRows(transactions, () => 'Core');
    const csv = [fundExportHeaders, ...rows].map(row => row.join(',')).join('\n');
    const [header, data] = csv.split('\n');
    expect(header).toBe('Date,Fund,Account,Owner,Units,Price,Amount');

    const [, , , , unitsRaw, priceRaw, amountRaw] = data.split(',');
    expect(Number(unitsRaw)).toBeCloseTo(7722.6966, 10);
    expect(Number(priceRaw)).toBeCloseTo(1.2345, 10);
    expect(Number(amountRaw)).toBeCloseTo(7722.6966 * 1.2345, 8);
  });
});
