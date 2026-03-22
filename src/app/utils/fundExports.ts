import { FundTransaction } from '../types';

export const fundExportHeaders = ['Date', 'Fund', 'Account', 'Owner', 'Units', 'Price', 'Amount'];

type AccountLabelLookup = (accountId?: string) => string;

export const buildFundExportRows = (
  transactions: FundTransaction[],
  getAccountLabel: AccountLabelLookup
) =>
  transactions.map(t => [
    t.date,
    t.fund,
    getAccountLabel(t.accountId),
    t.spender || '',
    t.units,
    t.price,
    Math.abs(t.units * t.price),
  ]);
