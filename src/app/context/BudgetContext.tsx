import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BudgetState, Category, RecurringTransaction, Transaction, Account, Debt, SavingsGoal, Settings, CategoryClassification, FundTransaction, FundHoldingMeta, Deposit, WealthSnapshot, MarketDataState, FxRate, CommodityPrice } from '../types';
import { deriveDepositFields } from '../utils/wealthCalculations';

interface BudgetContextType {
  state: BudgetState;
  updateSettings: (settings: Partial<Settings>) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addRecurringTransaction: (transaction: RecurringTransaction) => void;
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => void;
  deleteRecurringTransaction: (id: string) => void;
  addTransaction: (transaction: Transaction) => void;
  addTransactions: (transactions: Transaction[]) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  setTransactions: (transactions: Transaction[]) => void;
  addFundTransaction: (transaction: FundTransaction) => void;
  addFundTransactions: (transactions: FundTransaction[]) => void;
  updateFundTransaction: (id: string, updates: Partial<FundTransaction>) => void;
  deleteFundTransaction: (id: string) => void;
  setFundTransactions: (transactions: FundTransaction[]) => void;
  setFundHoldingsMeta: (meta: FundHoldingMeta[]) => void;
  addDeposit: (deposit: Deposit) => void;
  addDeposits: (deposits: Deposit[]) => void;
  updateDeposit: (id: string, updates: Partial<Deposit>) => void;
  deleteDeposit: (id: string) => void;
  setDeposits: (deposits: Deposit[]) => void;
  addWealthSnapshot: (snapshot: WealthSnapshot) => void;
  setMarketData: (marketData: MarketDataState) => void;
  upsertFxRate: (pair: string, updates: Partial<FxRate>) => void;
  upsertCommodityPrice: (commodity: string, updates: Partial<CommodityPrice>) => void;
  upsertFundHoldingMeta: (fund: string, updates: Partial<FundHoldingMeta>) => void;
  addAccount: (account: Account) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  setAccounts: (accounts: Account[]) => void;
  setCategories: (categories: Category[]) => void;
  addDebt: (debt: Debt) => void;
  updateDebt: (id: string, updates: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  addSavingsGoal: (goal: SavingsGoal) => void;
  updateSavingsGoal: (id: string, updates: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;
  restoreState: (data: unknown) => boolean;
  resetData: (selection: Partial<{
    transactions: boolean;
    deposits: boolean;
    accounts: boolean;
    categories: boolean;
    funds: boolean;
    fundPrices: boolean;
    debts: boolean;
    savingsGoals: boolean;
    recurringTransactions: boolean;
    wealthSnapshots: boolean;
  }>) => void;
}

const defaultCategories: Category[] = [
  { id: '1', name: 'Salary', type: 'income', classification: 'none', color: '#10b981' },
  { id: '2', name: 'Freelance', type: 'income', classification: 'none', color: '#34d399' },
  { id: '3', name: 'Housing', type: 'expense', classification: 'needs', color: '#ef4444' },
  { id: '4', name: 'Transportation', type: 'expense', classification: 'needs', color: '#f97316' },
  { id: '5', name: 'Food & Groceries', type: 'expense', classification: 'needs', color: '#f59e0b' },
  { id: '6', name: 'Utilities', type: 'expense', classification: 'needs', color: '#eab308' },
  { id: '7', name: 'Entertainment', type: 'expense', classification: 'wants', color: '#8b5cf6' },
  { id: '8', name: 'Healthcare', type: 'expense', classification: 'needs', color: '#ec4899' },
  { id: '9', name: 'Savings', type: 'expense', classification: 'savings', color: '#3b82f6' },
  { id: '10', name: 'Debt Payment', type: 'expense', classification: 'savings', color: '#6366f1' },
];

const CURRENT_SCHEMA_VERSION = 9;

const initialState: BudgetState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  settings: {
    currency: '$',
    startMonth: 0, // January
    startYear: 2026,
    budgetMethod: 'zero-based',
    familyMembers: ['Me'],
    language: 'en',
    owners: [],
  },
  categories: defaultCategories,
  recurringTransactions: [],
  transactions: [],
  fundTransactions: [],
  fundHoldingsMeta: [],
  marketData: {
    fxRates: [],
    commodities: [],
  },
  deposits: [],
  wealthSnapshots: [],
  accounts: [],
  debts: [],
  savingsGoals: [],
};

const normalizeSettings = (settings: Settings): Settings => ({
  ...settings,
  language: settings.language ?? 'en',
  owners: settings.owners ?? [],
});

const clampDay = (value: number | undefined, fallback: number) => {
  const num = Number.isFinite(value) ? Math.trunc(value as number) : fallback;
  return Math.min(31, Math.max(1, num));
};

const normalizeAccount = (account: Account, settingsCurrency: string): Account => {
  const currency = account.currency ?? settingsCurrency;
  const isForeignCurrency = account.isForeignCurrency ?? (currency !== settingsCurrency);
  const statementDay = account.type === 'credit-card'
    ? clampDay(account.statementDay, 1)
    : undefined;
  const dueDay = account.type === 'credit-card'
    ? clampDay(account.dueDay, Math.min((statementDay ?? 1) + 10, 28))
    : undefined;
  return {
    ...account,
    currency,
    isForeignCurrency,
    exchangeRate: account.exchangeRate ?? 1,
    notes: account.notes ?? '',
    owner: account.owner ?? '',
    institution: account.institution ?? '',
    statementDay,
    dueDay,
    pensionFundValue: account.pensionFundValue ?? 0,
    governmentContribution: account.governmentContribution ?? 0,
  };
};

const normalizeDebt = (debt: Debt, defaultPaymentCategoryId?: string): Debt => {
  const totalAmount = Number.isFinite(debt.totalAmount) ? debt.totalAmount : 0;
  const currentBalance = Number.isFinite(debt.currentBalance) ? debt.currentBalance : totalAmount;
  const minimumPayment = Number.isFinite(debt.minimumPayment) ? debt.minimumPayment : 0;
  const alreadyPaidAmount = Number.isFinite(debt.alreadyPaidAmount) ? (debt.alreadyPaidAmount as number) : 0;
  const alreadyPaidInstallments = Number.isFinite(debt.alreadyPaidInstallments) ? (debt.alreadyPaidInstallments as number) : 0;
  return {
    ...debt,
    totalAmount,
    currentBalance,
    minimumPayment,
    alreadyPaidAmount,
    alreadyPaidInstallments,
    oneTimeFee: debt.oneTimeFee ?? 0,
    oneTimeFeeNote: debt.oneTimeFeeNote ?? '',
    paymentCategoryId: debt.paymentCategoryId ?? defaultPaymentCategoryId,
    installmentFrequency: debt.installmentFrequency ?? 'monthly',
    installmentCount: debt.installmentCount ?? 0,
    installmentAmount: debt.installmentAmount ?? minimumPayment,
    installments: debt.installments ?? [],
  };
};

const normalizeTransaction = (transaction: Transaction): Transaction => {
  const transactionKind = transaction.transactionKind ?? 'standard';
  const baseAmount = Number.isFinite(transaction.baseAmount) ? (transaction.baseAmount as number) : transaction.amount;
  const accountAmount = Number.isFinite(transaction.accountAmount) ? (transaction.accountAmount as number) : baseAmount;
  const fxRateToBase = Number.isFinite(transaction.fxRateToBase) ? (transaction.fxRateToBase as number) : 1;
  return {
    ...transaction,
    debtId: transaction.debtId ?? undefined,
    installmentId: transaction.installmentId ?? undefined,
    transactionKind,
    creditCardAccountId: transaction.creditCardAccountId ?? undefined,
    paymentAccountId: transaction.paymentAccountId ?? (transactionKind === 'credit-card-payment' ? transaction.accountId : undefined),
    accountAmount,
    baseAmount,
    fxRateToBase,
    amount: baseAmount,
  };
};

const normalizeFundHoldingMeta = (meta: FundHoldingMeta): FundHoldingMeta => ({
  ...meta,
  currentPrice: meta.currentPrice ?? 0,
  withholdingTaxRate: meta.withholdingTaxRate ?? 0,
  transactionFeeRate: meta.transactionFeeRate ?? 0,
  priceMode: meta.priceMode ?? 'manual',
  lastUpdated: meta.lastUpdated ?? undefined,
});

const normalizeFxRate = (rate: FxRate): FxRate => ({
  pair: rate.pair,
  rate: Number.isFinite(rate.rate) ? rate.rate : 0,
  mode: rate.mode ?? 'manual',
  updatedAt: rate.updatedAt ?? undefined,
});

const normalizeCommodityPrice = (item: CommodityPrice): CommodityPrice => ({
  commodity: item.commodity,
  price: Number.isFinite(item.price) ? item.price : 0,
  mode: item.mode ?? 'manual',
  updatedAt: item.updatedAt ?? undefined,
});

const normalizeMarketData = (marketData?: MarketDataState): MarketDataState => ({
  fxRates: Array.isArray(marketData?.fxRates) ? marketData!.fxRates.map(normalizeFxRate) : [],
  commodities: Array.isArray(marketData?.commodities) ? marketData!.commodities.map(normalizeCommodityPrice) : [],
});

const normalizeFundTransaction = (transaction: FundTransaction): FundTransaction => {
  const raw = transaction as FundTransaction & { amount?: number };
  let units = transaction.units;
  if ((units === undefined || Number.isNaN(units)) && raw.amount !== undefined) {
    const sign = transaction.type === 'sell' ? -1 : 1;
    units = transaction.price ? (raw.amount / transaction.price) * sign : 0;
  }
  if (units === undefined || Number.isNaN(units)) units = 0;
  const price = Number.isFinite(transaction.price) ? transaction.price : 0;
  const amount = Number.isFinite(raw.amount) ? raw.amount : units * price;
  const type = transaction.type ?? (units < 0 ? 'sell' : 'buy');
  return {
    ...transaction,
    assetClass: 'fund',
    units,
    price,
    amount,
    type,
    cashTransactionId: transaction.cashTransactionId ?? undefined,
  };
};

const normalizeDeposit = (deposit: Deposit): Deposit => {
  const legacy = deposit as Deposit & {
    interestRate?: number;
    expectedValue?: number;
    maturityDate?: string;
    termDays?: number;
    grossRate?: number;
    withholdingTaxRate?: number;
  };
  const base: Partial<Deposit> = {
    id: deposit.id,
    owner: deposit.owner ?? '',
    institution: deposit.institution ?? '',
    principal: Number.isFinite(deposit.principal) ? deposit.principal : 0,
    termDays: Number.isFinite(legacy.termDays) ? legacy.termDays : 0,
    grossRate: Number.isFinite(legacy.grossRate) ? legacy.grossRate : (Number.isFinite(legacy.interestRate) ? legacy.interestRate : 0),
    withholdingTaxRate: Number.isFinite(legacy.withholdingTaxRate) ? legacy.withholdingTaxRate : 0,
    startDate: deposit.startDate ?? '',
    maturityDate: legacy.maturityDate ?? '',
    source: deposit.source ?? 'manual',
  };
  const derived = deriveDepositFields(base);
  if (Number.isFinite((legacy as { expectedValue?: number }).expectedValue)) {
    derived.maturityValue = (legacy as { expectedValue?: number }).expectedValue as number;
    derived.netInterest = derived.maturityValue - derived.principal;
    derived.grossInterest = derived.netInterest / (1 - (derived.withholdingTaxRate / 100 || 0));
    derived.withholdingTaxAmount = derived.grossInterest - derived.netInterest;
  }
  return derived;
};

const normalizeWealthSnapshot = (snapshot: WealthSnapshot): WealthSnapshot => ({
  ...snapshot,
  totalAssets: Number.isFinite(snapshot.totalAssets) ? snapshot.totalAssets : 0,
  totalDebts: Number.isFinite(snapshot.totalDebts) ? snapshot.totalDebts : 0,
  netWealth: Number.isFinite(snapshot.netWealth) ? snapshot.netWealth : 0,
  cash: Number.isFinite(snapshot.cash) ? snapshot.cash : 0,
  funds: Number.isFinite(snapshot.funds) ? snapshot.funds : 0,
  deposits: Number.isFinite(snapshot.deposits) ? snapshot.deposits : 0,
  gold: Number.isFinite(snapshot.gold) ? snapshot.gold : 0,
  blockedAssets: Number.isFinite(snapshot.blockedAssets) ? snapshot.blockedAssets : 0,
  otherAssets: Number.isFinite(snapshot.otherAssets) ? snapshot.otherAssets : 0,
});

const normalizeDebtName = (name?: string) =>
  (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const sanitizeBudgetState = (state: BudgetState): BudgetState => {
  const categoryIds = new Set(state.categories.map(c => c.id));
  const accountIds = new Set(state.accounts.map(a => a.id));
  const accountById = new Map(state.accounts.map(a => [a.id, a]));
  const sanitizeAccountId = (accountId?: string) =>
    accountId && accountIds.has(accountId) ? accountId : undefined;
  const defaultPaymentCategoryId = state.categories.find(c => c.name === 'Debt Payment' && c.type === 'expense')?.id;

  return {
    ...state,
    settings: normalizeSettings(state.settings),
    accounts: state.accounts.map(a => normalizeAccount(a, state.settings.currency)),
    // Remove records with missing categories; drop invalid account links.
    recurringTransactions: state.recurringTransactions
      .filter(rt => categoryIds.has(rt.categoryId))
      .map(rt => ({ ...rt, accountId: sanitizeAccountId(rt.accountId) })),
    transactions: state.transactions
      .filter(t => categoryIds.has(t.categoryId))
      .map(t => {
        const accountId = sanitizeAccountId(t.accountId);
        const account = accountId ? accountById.get(accountId) : undefined;
        const accountCurrency = t.accountCurrency ?? account?.currency ?? state.settings.currency;
        const fxRateToBase = Number.isFinite(t.fxRateToBase)
          ? (t.fxRateToBase as number)
          : (accountCurrency === state.settings.currency ? 1 : (account?.exchangeRate ?? 1));
        return normalizeTransaction({
          ...t,
          accountId,
          accountCurrency,
          fxRateToBase,
          creditCardAccountId: sanitizeAccountId(t.creditCardAccountId),
          paymentAccountId: sanitizeAccountId(t.paymentAccountId),
        });
      }),
    fundTransactions: (state.fundTransactions || []).map(ft =>
      normalizeFundTransaction({ ...ft, accountId: sanitizeAccountId(ft.accountId) })
    ),
    fundHoldingsMeta: (state.fundHoldingsMeta || []).map(normalizeFundHoldingMeta),
    marketData: normalizeMarketData(state.marketData),
    deposits: (state.deposits || []).map(d => normalizeDeposit(d)),
    wealthSnapshots: (state.wealthSnapshots || []).map(normalizeWealthSnapshot),
    debts: state.debts
      .map(d => normalizeDebt({ ...d, accountId: sanitizeAccountId(d.accountId) }, defaultPaymentCategoryId))
      .filter(d =>
        !(normalizeDebtName(d.name) === 'ihtiyac kredisi' && d.totalAmount === 0 && d.currentBalance === 0 && d.minimumPayment === 0)
      ),
    savingsGoals: state.savingsGoals.map(g => ({ ...g, accountId: sanitizeAccountId(g.accountId) })),
  };
};

const inferClassification = (category: Pick<Category, 'name' | 'type'>): CategoryClassification => {
  if (category.type === 'income') return 'none';

  const needsCategories = ['Housing', 'Utilities', 'Food & Groceries', 'Transportation', 'Healthcare'];
  const savingsCategories = ['Savings', 'Debt Payment'];

  if (needsCategories.includes(category.name)) return 'needs';
  if (savingsCategories.includes(category.name)) return 'savings';
  return 'wants';
};

const migrateBudgetData = (data: unknown): BudgetState | null => {
  if (!data || typeof data !== 'object') return null;

  const raw = data as Partial<BudgetState>;
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;

  if (version === CURRENT_SCHEMA_VERSION) {
    const withClassification = (raw as BudgetState);
    return sanitizeBudgetState(withClassification);
  }

  if (version === 0 || version === 1 || version === 2 || version === 3 || version === 4 || version === 5 || version === 6 || version === 7 || version === 8) {
    const rawState = raw as BudgetState;
    const categories = (rawState.categories || []).map(cat => ({
      ...cat,
      classification: cat.classification ?? inferClassification(cat),
    }));

    return sanitizeBudgetState({
      ...rawState,
      settings: {
        ...rawState.settings,
        language: rawState.settings?.language ?? 'en',
      },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      categories,
      fundTransactions: rawState.fundTransactions ?? [],
      fundHoldingsMeta: rawState.fundHoldingsMeta ?? [],
      marketData: rawState.marketData ?? { fxRates: [], commodities: [] },
      deposits: rawState.deposits ?? [],
      wealthSnapshots: rawState.wealthSnapshots ?? [],
    });
  }

  return null;
};

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
};

export const BudgetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BudgetState>(() => {
    const saved = localStorage.getItem('budgetPlannerData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as unknown;
        const migrated = migrateBudgetData(parsed);
        return migrated ?? initialState;
      } catch {
        return initialState;
      }
    }
    return initialState;
  });

  useEffect(() => {
    localStorage.setItem('budgetPlannerData', JSON.stringify(state));
  }, [state]);

  const updateSettings = (settings: Partial<Settings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  };

  const addCategory = (category: Category) => {
    setState(prev => ({
      ...prev,
      categories: [...prev.categories, category],
    }));
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === id ? { ...cat, ...updates } : cat
      ),
    }));
  };

  const deleteCategory = (id: string) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.filter(cat => cat.id !== id),
      recurringTransactions: prev.recurringTransactions.filter(t => t.categoryId !== id),
      transactions: prev.transactions.filter(t => t.categoryId !== id),
    }));
  };

  const addRecurringTransaction = (transaction: RecurringTransaction) => {
    setState(prev => ({
      ...prev,
      recurringTransactions: [...prev.recurringTransactions, transaction],
    }));
  };

  const updateRecurringTransaction = (id: string, updates: Partial<RecurringTransaction>) => {
    setState(prev => ({
      ...prev,
      recurringTransactions: prev.recurringTransactions.map(t =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  };

  const deleteRecurringTransaction = (id: string) => {
    setState(prev => ({
      ...prev,
      recurringTransactions: prev.recurringTransactions.filter(t => t.id !== id),
    }));
  };

  const addTransaction = (transaction: Transaction) => {
    setState(prev => ({
      ...prev,
      transactions: [...prev.transactions, normalizeTransaction(transaction)],
    }));
  };

  const addTransactions = (transactions: Transaction[]) => {
    if (transactions.length === 0) return;
    setState(prev => ({
      ...prev,
      transactions: [...prev.transactions, ...transactions.map(normalizeTransaction)],
    }));
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  };

  const deleteTransaction = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id),
    }));
  };

  const setTransactions = (transactions: Transaction[]) => {
    setState(prev => ({
      ...prev,
      transactions: transactions.map(normalizeTransaction),
    }));
  };

  const addFundTransaction = (transaction: FundTransaction) => {
    setState(prev => ({
      ...prev,
      fundTransactions: [...prev.fundTransactions, transaction],
    }));
  };

  const addFundTransactions = (transactions: FundTransaction[]) => {
    if (transactions.length === 0) return;
    setState(prev => ({
      ...prev,
      fundTransactions: [...prev.fundTransactions, ...transactions],
    }));
  };

  const updateFundTransaction = (id: string, updates: Partial<FundTransaction>) => {
    setState(prev => ({
      ...prev,
      fundTransactions: prev.fundTransactions.map(t =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  };

  const deleteFundTransaction = (id: string) => {
    setState(prev => ({
      ...prev,
      fundTransactions: prev.fundTransactions.filter(t => t.id !== id),
    }));
  };

  const setFundTransactions = (transactions: FundTransaction[]) => {
    setState(prev => ({
      ...prev,
      fundTransactions: transactions.map(normalizeFundTransaction),
    }));
  };

  const setFundHoldingsMeta = (meta: FundHoldingMeta[]) => {
    setState(prev => ({
      ...prev,
      fundHoldingsMeta: meta.map(normalizeFundHoldingMeta),
    }));
  };

  const addDeposit = (deposit: Deposit) => {
    setState(prev => ({
      ...prev,
      deposits: [...prev.deposits, deriveDepositFields(deposit)],
    }));
  };

  const addDeposits = (deposits: Deposit[]) => {
    if (deposits.length === 0) return;
    setState(prev => ({
      ...prev,
      deposits: [...prev.deposits, ...deposits.map(d => deriveDepositFields(d))],
    }));
  };

  const updateDeposit = (id: string, updates: Partial<Deposit>) => {
    setState(prev => ({
      ...prev,
      deposits: prev.deposits.map(d =>
        d.id === id ? deriveDepositFields({ ...d, ...updates }) : d
      ),
    }));
  };

  const deleteDeposit = (id: string) => {
    setState(prev => ({
      ...prev,
      deposits: prev.deposits.filter(d => d.id !== id),
    }));
  };

  const setDeposits = (deposits: Deposit[]) => {
    setState(prev => ({
      ...prev,
      deposits: deposits.map(d => deriveDepositFields(d)),
    }));
  };

  const addWealthSnapshot = (snapshot: WealthSnapshot) => {
    setState(prev => ({
      ...prev,
      wealthSnapshots: [...prev.wealthSnapshots, snapshot],
    }));
  };

  const setMarketData = (marketData: MarketDataState) => {
    setState(prev => ({
      ...prev,
      marketData: normalizeMarketData(marketData),
    }));
  };

  const upsertFxRate = (pair: string, updates: Partial<FxRate>) => {
    setState(prev => {
      const existing = prev.marketData.fxRates.find(item => item.pair === pair);
      const updated = existing
        ? prev.marketData.fxRates.map(item =>
            item.pair === pair ? normalizeFxRate({ ...item, ...updates, pair }) : item
          )
        : [...prev.marketData.fxRates, normalizeFxRate({ pair, rate: 0, mode: 'manual', ...updates })];
      return { ...prev, marketData: { ...prev.marketData, fxRates: updated } };
    });
  };

  const upsertCommodityPrice = (commodity: string, updates: Partial<CommodityPrice>) => {
    setState(prev => {
      const existing = prev.marketData.commodities.find(item => item.commodity === commodity);
      const updated = existing
        ? prev.marketData.commodities.map(item =>
            item.commodity === commodity ? normalizeCommodityPrice({ ...item, ...updates, commodity }) : item
          )
        : [...prev.marketData.commodities, normalizeCommodityPrice({ commodity, price: 0, mode: 'manual', ...updates })];
      return { ...prev, marketData: { ...prev.marketData, commodities: updated } };
    });
  };

  const upsertFundHoldingMeta = (fund: string, updates: Partial<FundHoldingMeta>) => {
    setState(prev => {
      const existing = prev.fundHoldingsMeta.find(meta => meta.fund === fund);
      const updated = existing
        ? prev.fundHoldingsMeta.map(meta =>
            meta.fund === fund ? normalizeFundHoldingMeta({ ...meta, ...updates }) : meta
          )
        : [...prev.fundHoldingsMeta, normalizeFundHoldingMeta({ fund, currentPrice: 0, withholdingTaxRate: 0, ...updates })];
      return { ...prev, fundHoldingsMeta: updated };
    });
  };

  const addAccount = (account: Account) => {
    setState(prev => ({
      ...prev,
      accounts: [...prev.accounts, account],
    }));
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc =>
        acc.id === id ? { ...acc, ...updates } : acc
      ),
    }));
  };

  const deleteAccount = (id: string) => {
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.filter(acc => acc.id !== id),
      recurringTransactions: prev.recurringTransactions.map(t =>
        t.accountId === id ? { ...t, accountId: undefined } : t
      ),
      transactions: prev.transactions.map(t =>
        t.accountId === id || t.creditCardAccountId === id || t.paymentAccountId === id
          ? {
              ...t,
              accountId: t.accountId === id ? undefined : t.accountId,
              creditCardAccountId: t.creditCardAccountId === id ? undefined : t.creditCardAccountId,
              paymentAccountId: t.paymentAccountId === id ? undefined : t.paymentAccountId,
            }
          : t
      ),
      debts: prev.debts.map(d =>
        d.accountId === id ? { ...d, accountId: undefined } : d
      ),
      savingsGoals: prev.savingsGoals.map(g =>
        g.accountId === id ? { ...g, accountId: undefined } : g
      ),
    }));
  };

  const setAccounts = (accounts: Account[]) => {
    setState(prev => ({
      ...prev,
      accounts: accounts.map(a => normalizeAccount(a, prev.settings.currency)),
    }));
  };

  const setCategories = (categories: Category[]) => {
    setState(prev => ({
      ...prev,
      categories,
    }));
  };

  const addDebt = (debt: Debt) => {
    setState(prev => ({
      ...prev,
      debts: [...prev.debts, debt],
    }));
  };

  const updateDebt = (id: string, updates: Partial<Debt>) => {
    setState(prev => ({
      ...prev,
      debts: prev.debts.map(d =>
        d.id === id ? { ...d, ...updates } : d
      ),
    }));
  };

  const deleteDebt = (id: string) => {
    setState(prev => ({
      ...prev,
      debts: prev.debts.filter(d => d.id !== id),
    }));
  };

  const addSavingsGoal = (goal: SavingsGoal) => {
    setState(prev => ({
      ...prev,
      savingsGoals: [...prev.savingsGoals, goal],
    }));
  };

  const updateSavingsGoal = (id: string, updates: Partial<SavingsGoal>) => {
    setState(prev => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map(g =>
        g.id === id ? { ...g, ...updates } : g
      ),
    }));
  };

  const deleteSavingsGoal = (id: string) => {
    setState(prev => ({
      ...prev,
      savingsGoals: prev.savingsGoals.filter(g => g.id !== id),
    }));
  };

  const resetData = (selection: Partial<{
    transactions: boolean;
    deposits: boolean;
    accounts: boolean;
    categories: boolean;
    funds: boolean;
    fundPrices: boolean;
    debts: boolean;
    savingsGoals: boolean;
    recurringTransactions: boolean;
    wealthSnapshots: boolean;
  }>) => {
    const hasSelection = Object.values(selection).some(Boolean);
    if (!hasSelection) return;
    setState(prev => ({
      ...prev,
      transactions: selection.transactions ? initialState.transactions : prev.transactions,
      deposits: selection.deposits ? initialState.deposits : prev.deposits,
      accounts: selection.accounts ? initialState.accounts : prev.accounts,
      categories: selection.categories ? initialState.categories : prev.categories,
      fundTransactions: selection.funds ? initialState.fundTransactions : prev.fundTransactions,
      fundHoldingsMeta: selection.fundPrices ? initialState.fundHoldingsMeta : prev.fundHoldingsMeta,
      debts: selection.debts ? initialState.debts : prev.debts,
      savingsGoals: selection.savingsGoals ? initialState.savingsGoals : prev.savingsGoals,
      recurringTransactions: selection.recurringTransactions ? initialState.recurringTransactions : prev.recurringTransactions,
      wealthSnapshots: selection.wealthSnapshots ? initialState.wealthSnapshots : prev.wealthSnapshots,
    }));
  };

  const restoreState = (data: unknown) => {
    const migrated = migrateBudgetData(data);
    if (!migrated) return false;
    setState(migrated);
    return true;
  };

  const value: BudgetContextType = {
    state,
    updateSettings,
    addCategory,
    updateCategory,
    deleteCategory,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    addTransaction,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    setTransactions,
    addFundTransaction,
    addFundTransactions,
    updateFundTransaction,
    deleteFundTransaction,
    setFundTransactions,
    setFundHoldingsMeta,
    upsertFundHoldingMeta,
    addDeposit,
    addDeposits,
    updateDeposit,
    deleteDeposit,
    setDeposits,
    addWealthSnapshot,
    setMarketData,
    upsertFxRate,
    upsertCommodityPrice,
    addAccount,
    updateAccount,
    deleteAccount,
    setAccounts,
    setCategories,
    addDebt,
    updateDebt,
    deleteDebt,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    restoreState,
    resetData,
  };

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
};
