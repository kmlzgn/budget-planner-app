import { WealthSnapshot } from '../types';

export type Cashflow = { amount: number; date: string };

const toLocalDate = (value: string): Date => {
  const parts = value.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (year && month && day) return new Date(year, month - 1, day);
  }
  return new Date(value);
};

export const calculateXirr = (cashflows: Cashflow[]): number | null => {
  if (cashflows.length < 2) return null;
  const sorted = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map(c => toLocalDate(c.date));
  const amounts = sorted.map(c => c.amount);
  const hasPositive = amounts.some(a => a > 0);
  const hasNegative = amounts.some(a => a < 0);
  if (!hasPositive || !hasNegative) return null;

  const day0 = dates[0].getTime();
  const years = dates.map(d => (d.getTime() - day0) / (365 * 24 * 60 * 60 * 1000));

  let rate = 0.1;
  for (let i = 0; i < 50; i += 1) {
    let f = 0;
    let df = 0;
    for (let j = 0; j < amounts.length; j += 1) {
      const t = years[j];
      const denom = Math.pow(1 + rate, t);
      f += amounts[j] / denom;
      df += (-t * amounts[j]) / (denom * (1 + rate));
    }
    if (Math.abs(f) < 1e-6) return rate;
    if (df === 0) break;
    rate -= f / df;
    if (!Number.isFinite(rate)) return null;
  }
  return null;
};

export const adjustForInflation = (
  value: number,
  _date: string
): { value: number; adjusted: boolean } => {
  return { value, adjusted: false };
};

export const filterSnapshotsByRange = (
  snapshots: WealthSnapshot[],
  range: '1m' | '3m' | 'ytd' | 'all'
) => {
  if (range === 'all') return snapshots;
  const today = new Date();
  const start = new Date(today);
  if (range === '1m') start.setMonth(start.getMonth() - 1);
  if (range === '3m') start.setMonth(start.getMonth() - 3);
  if (range === 'ytd') start.setMonth(0, 1);
  return snapshots.filter(s => toLocalDate(s.date) >= start);
};
