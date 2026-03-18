import { Account, AccountType, BudgetState, CommodityPrice, Deposit, FxRate } from '../types';
import { calculateAccountBalancesFromTransactions, calculateNetWorth } from './budgetCalculations';
import { calculateFundHoldings, FundHolding } from './fundCalculations';
import { getDepositExpectedValue, getDepositStatus, getDaysUntil } from './wealthCalculations';

const cashTypes = new Set<AccountType>(['cash', 'checking', 'savings']);

const normalizeName = (name: string) => name.trim().toLowerCase();

const isCommodityAccount = (account: Account) => {
  const name = normalizeName(account.name);
  return account.isAsset && (
    account.type === 'commodities' ||
    name.includes('gold') ||
    name.includes('altin') ||
    name.includes('commodity') ||
    name.includes('emtia')
  );
};

const isDepositAccount = (account: Account) => {
  const name = normalizeName(account.name);
  return account.isAsset && (name.includes('deposit') || name.includes('time deposit') || name.includes('term') || name.includes('vadeli'));
};

const isBlockedAccount = (account: Account) => {
  const name = normalizeName(account.name);
  return account.isAsset && (
    account.type === 'blocked' ||
    name.includes('blocked') ||
    name.includes('bloke')
  );
};

export type WealthTotals = {
  accountBalances: Map<string, number>;
  assetAccounts: Account[];
  liabilityAccounts: Account[];
  fundHoldings: FundHolding[];
  fundAssetsTotal: number;
  fundCostBasisTotal: number;
  fundUnrealizedPnL: number;
  fundUnrealizedPnLPct: number;
  activeFundsCount: number;
  fundBuyTotal: number;
  fundSellTotal: number;
  fundNetInvested: number;
  fundNominalReturn: number;
  activeDeposits: Deposit[];
  depositsTotal: number;
  nextMaturity?: string;
  activeDepositCount: number;
  activePrincipalTotal: number;
  activeNetInterestTotal: number;
  maturingIn7: number;
  cashTotal: number;
  goldTotal: number;
  blockedAssetsTotal: number;
  otherAssetsTotal: number;
  debtTotal: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

export const getWealthTotals = (state: BudgetState, today: Date): WealthTotals => {
  const accountBalances = calculateAccountBalancesFromTransactions(state.accounts, state.transactions, today);
  const getMarketFxRate = (currency: string) => {
    if (!currency || currency === state.settings.currency) return 1;
    const normalizePair = (pair: string) => pair.replace(/\s+/g, '').toUpperCase();
    const directPair = normalizePair(`${currency}/${state.settings.currency}`);
    const inversePair = normalizePair(`${state.settings.currency}/${currency}`);
    const direct = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === directPair)?.rate;
    if (Number.isFinite(direct) && (direct as number) > 0) return direct as number;
    const inverse = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === inversePair)?.rate;
    if (Number.isFinite(inverse) && (inverse as number) > 0) return 1 / (inverse as number);
    return 1;
  };
  const toBase = (value: number, account: Account) => {
    if (account.currency && account.currency !== state.settings.currency) {
      const exchangeRate = account.exchangeRate;
      const rate = Number.isFinite(exchangeRate) && (exchangeRate as number) > 0
        ? (exchangeRate as number)
        : getMarketFxRate(account.currency);
      return value * rate;
    }
    return value;
  };
  const getCommodityPrice = (account: Account) => {
    const fallbackName = normalizeName(account.name).includes('gold') || normalizeName(account.name).includes('altin')
      ? 'Gold'
      : account.commodityName;
    if (!fallbackName) return 0;
    const match = state.marketData.commodities.find(item => normalizeName(item.commodity) === normalizeName(fallbackName));
    return match?.price ?? 0;
  };
  const getAccountValue = (account: Account) => {
    if (account.type === 'commodities' && account.commodityValuationMode === 'auto') {
      const units = account.commodityUnits ?? 0;
      const price = getCommodityPrice(account);
      return units * price;
    }
    const localValue = account.type === 'pension'
      ? (account.pensionFundValue ?? 0) + (account.governmentContribution ?? 0)
      : (accountBalances.get(account.id) ?? account.currentBalance);
    return toBase(localValue, account);
  };
  const fundHoldings = calculateFundHoldings(state.fundTransactions, state.fundHoldingsMeta)
    .filter(h => h.netUnits !== 0 || h.totalBuyUnits > 0);
  const fundAssetsTotal = fundHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const fundCostBasisTotal = fundHoldings.reduce((sum, h) => sum + h.costBasis, 0);
  const fundUnrealizedPnL = fundAssetsTotal - fundCostBasisTotal;
  const fundUnrealizedPnLPct = fundCostBasisTotal !== 0 ? (fundUnrealizedPnL / fundCostBasisTotal) * 100 : 0;
  const activeFundsCount = new Set(fundHoldings.map(h => h.fund)).size;
  const fundBuyTotal = state.fundTransactions
    .filter(t => t.units > 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const fundSellTotal = state.fundTransactions
    .filter(t => t.units < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const fundNetInvested = fundBuyTotal - fundSellTotal;
  const fundNominalReturn = fundNetInvested !== 0
    ? (fundAssetsTotal - fundNetInvested) / fundNetInvested
    : 0;

  const activeDeposits = state.deposits.filter(d => getDepositStatus(d, today, 7) !== 'matured');
  const depositsTotal = activeDeposits.reduce((sum, d) => sum + getDepositExpectedValue(d), 0);
  const depositsWithMaturity = activeDeposits.filter(d => d.maturityDate);
  const nextMaturity = depositsWithMaturity
    .map(d => d.maturityDate)
    .filter(date => getDaysUntil(date, today) >= 0)
    .sort()[0];
  const activeDepositCount = activeDeposits.length;
  const activePrincipalTotal = activeDeposits.reduce((sum, d) => sum + d.principal, 0);
  const activeNetInterestTotal = activeDeposits.reduce((sum, d) => sum + d.netInterest, 0);
  const maturingIn7 = activeDeposits.filter(d => getDepositStatus(d, today, 7) === 'due-soon').length;

  const assetAccounts = state.accounts.filter(a => a.isAsset);
  const liabilityAccounts = state.accounts.filter(a => !a.isAsset);
  const debtTotal = state.debts.reduce((sum, debt) => sum + Math.abs(debt.currentBalance || 0), 0);
  const cashTotal = assetAccounts
    .filter(a => cashTypes.has(a.type) && !isDepositAccount(a) && !isBlockedAccount(a) && !isCommodityAccount(a))
    .reduce((sum, a) => sum + getAccountValue(a), 0);
  const goldTotal = assetAccounts
    .filter(a => isCommodityAccount(a))
    .reduce((sum, a) => sum + getAccountValue(a), 0);
  const blockedAssetsTotal = assetAccounts
    .filter(a => isBlockedAccount(a))
    .reduce((sum, a) => sum + getAccountValue(a), 0);
  const otherAssetsTotal = assetAccounts
    .filter(a =>
      !cashTypes.has(a.type) &&
      !isCommodityAccount(a) &&
      !isDepositAccount(a) &&
      !isBlockedAccount(a)
    )
    .reduce((sum, a) => sum + getAccountValue(a), 0);
  const totalAssets = cashTotal + fundAssetsTotal + depositsTotal + goldTotal + blockedAssetsTotal + otherAssetsTotal;
  const totalLiabilities = liabilityAccounts
    .reduce((sum, a) => sum + Math.abs(toBase(accountBalances.get(a.id) ?? a.currentBalance, a)), 0) + debtTotal;
  const netWorth = totalAssets - totalLiabilities;

  return {
    accountBalances,
    assetAccounts,
    liabilityAccounts,
    fundHoldings,
    fundAssetsTotal,
    fundCostBasisTotal,
    fundUnrealizedPnL,
    fundUnrealizedPnLPct,
    activeFundsCount,
    fundBuyTotal,
    fundSellTotal,
    fundNetInvested,
    fundNominalReturn,
    activeDeposits,
    depositsTotal,
    nextMaturity,
    activeDepositCount,
    activePrincipalTotal,
    activeNetInterestTotal,
    maturingIn7,
    cashTotal,
    goldTotal,
    blockedAssetsTotal,
    otherAssetsTotal,
    debtTotal,
    totalAssets,
    totalLiabilities,
    netWorth,
  };
};

export type BreakdownRow = {
  name: string;
  cash: number;
  funds: number;
  deposits: number;
  gold: number;
  blocked: number;
  otherAssets: number;
  debts: number;
  total: number;
};

export const buildWealthBreakdown = (
  assetAccounts: Account[],
  liabilityAccounts: Account[],
  accountBalances: Map<string, number>,
  fundHoldings: FundHolding[],
  activeDeposits: Deposit[],
  baseCurrency: string,
  fxRates: FxRate[],
  commodities: CommodityPrice[],
  getKey: (args: { account?: Account; deposit?: Deposit }) => string
) => {
  const getMarketFxRate = (currency: string) => {
    if (!currency || currency === baseCurrency) return 1;
    const normalizePair = (pair: string) => pair.replace(/\s+/g, '').toUpperCase();
    const directPair = normalizePair(`${currency}/${baseCurrency}`);
    const inversePair = normalizePair(`${baseCurrency}/${currency}`);
    const direct = fxRates.find(rate => normalizePair(rate.pair) === directPair)?.rate;
    if (Number.isFinite(direct) && (direct as number) > 0) return direct as number;
    const inverse = fxRates.find(rate => normalizePair(rate.pair) === inversePair)?.rate;
    if (Number.isFinite(inverse) && (inverse as number) > 0) return 1 / (inverse as number);
    return 1;
  };
  const toBase = (value: number, account: Account) => {
    if (account.currency && account.currency !== baseCurrency) {
      const exchangeRate = account.exchangeRate;
      const rate = Number.isFinite(exchangeRate) && (exchangeRate as number) > 0
        ? (exchangeRate as number)
        : getMarketFxRate(account.currency);
      return value * rate;
    }
    return value;
  };
  const getCommodityPrice = (account: Account) => {
    const fallbackName = normalizeName(account.name).includes('gold') || normalizeName(account.name).includes('altin')
      ? 'Gold'
      : account.commodityName;
    if (!fallbackName) return 0;
    const match = commodities.find(item => normalizeName(item.commodity) === normalizeName(fallbackName));
    return match?.price ?? 0;
  };
  const getAccountValue = (account: Account) => {
    if (account.type === 'commodities' && account.commodityValuationMode === 'auto') {
      const units = account.commodityUnits ?? 0;
      const price = getCommodityPrice(account);
      return units * price;
    }
    const localValue = account.type === 'pension'
      ? (account.pensionFundValue ?? 0) + (account.governmentContribution ?? 0)
      : (accountBalances.get(account.id) ?? account.currentBalance);
    return toBase(localValue, account);
  };
  const rows = new Map<string, BreakdownRow>();
  const getRow = (key: string) => {
    const name = key || 'Unassigned';
    const existing = rows.get(name);
    if (existing) return existing;
    const row = {
      name,
      cash: 0,
      funds: 0,
      deposits: 0,
      gold: 0,
      blocked: 0,
      otherAssets: 0,
      debts: 0,
      total: 0,
    };
    rows.set(name, row);
    return row;
  };
  const addValue = (key: string, field: keyof Omit<BreakdownRow, 'name' | 'total'>, value: number) => {
    const row = getRow(key);
    row[field] += value;
    row.total =
      row.cash +
      row.funds +
      row.deposits +
      row.gold +
      row.blocked +
      row.otherAssets -
      row.debts;
  };

  assetAccounts.forEach(account => {
    if (isDepositAccount(account)) return;
    const value = getAccountValue(account);
    const key = getKey({ account });
    if (isCommodityAccount(account)) addValue(key, 'gold', value);
    else if (isBlockedAccount(account)) addValue(key, 'blocked', value);
    else if (cashTypes.has(account.type)) addValue(key, 'cash', value);
    else addValue(key, 'otherAssets', value);
  });

  liabilityAccounts.forEach(account => {
    const value = Math.abs(getAccountValue(account));
    const key = getKey({ account });
    addValue(key, 'debts', value);
  });

  fundHoldings.forEach(holding => {
    const key = getKey({ account: assetAccounts.find(a => a.id === holding.accountId) });
    addValue(key, 'funds', holding.currentValue);
  });

  activeDeposits.forEach(deposit => {
    const key = getKey({ deposit });
    addValue(key, 'deposits', getDepositExpectedValue(deposit));
  });

  return Array.from(rows.values()).sort((a, b) => b.total - a.total);
};
