import { Account, BudgetState, CommodityPrice } from '../types';
import { calculateAccountBalancesFromTransactions } from './budgetCalculations';

const normalizeName = (name: string) => name.trim().toLowerCase();

const resolveCommodityFallbackName = (account: Account) => {
  const fallbackName = account.commodityName?.trim();
  if (fallbackName) return fallbackName;
  const normalized = normalizeName(account.name);
  if (normalized.includes('gold') || normalized.includes('altin')) return 'Gold';
  return '';
};

export const getCommodityMarketPrice = (
  account: Account,
  commodities: CommodityPrice[]
) => {
  const commodityName = resolveCommodityFallbackName(account);
  if (!commodityName) return 0;
  const match = commodities.find(item => normalizeName(item.commodity) === normalizeName(commodityName));
  return match?.price ?? 0;
};

export const getDerivedAccountLocalBalance = (
  account: Account,
  state: BudgetState,
  balances: Map<string, number>
) => {
  if (account.type === 'pension' || account.type === 'retirement') {
    return (account.pensionFundValue ?? 0) + (account.governmentContribution ?? 0);
  }

  if (account.type === 'commodities' && account.commodityValuationMode === 'auto') {
    const units = account.commodityUnits ?? 0;
    const price = getCommodityMarketPrice(account, state.marketData.commodities);
    return units * price;
  }

  return balances.get(account.id) ?? account.openingBalance ?? 0;
};

export const getDerivedAccountBalances = (state: BudgetState, today: Date = new Date()) => {
  const balances = calculateAccountBalancesFromTransactions(state.accounts, state.transactions, today);
  const derived = new Map<string, number>();
  state.accounts.forEach(account => {
    derived.set(account.id, getDerivedAccountLocalBalance(account, state, balances));
  });
  return derived;
};
