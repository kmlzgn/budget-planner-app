import { useState } from 'react';
import { useAccountsDomain, useBudgetState, useSavingsGoalsDomain, useWealthSnapshotsDomain } from '../context/budgetDomains';
import { useBudget } from '../context/BudgetContext';
import { Plus, Trash2, Edit2, TrendingUp, Check } from 'lucide-react';
import { Account, SavingsGoal, AccountType, Deposit, WealthViewMode } from '../types';
import { generateId } from '../utils/id';
import { format } from 'date-fns';
import { getCreditCardCycleSummary } from '../utils/budgetCalculations';
import { formatCurrency } from '../utils/formatting';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { adjustForInflation, calculateXirr, filterSnapshotsByRange } from '../utils/wealthAnalytics';
import { getDepositExpectedValue } from '../utils/wealthCalculations';
import { buildWealthBreakdown, getWealthTotals } from '../utils/wealthSelectors';
import { t } from '../utils/i18n';

const accountTypes: { value: AccountType; label: string; isAsset: boolean }[] = [
  { value: 'cash', label: 'Cash', isAsset: true },
  { value: 'checking', label: 'Checking Account', isAsset: true },
  { value: 'savings', label: 'Savings Account', isAsset: true },
  { value: 'blocked', label: 'Blocked Account', isAsset: true },
  { value: 'commodities', label: 'Commodities', isAsset: true },
  { value: 'investment', label: 'Investment Account', isAsset: true },
  { value: 'brokerage', label: 'Brokerage Account', isAsset: true },
  { value: 'retirement', label: 'Retirement Account', isAsset: true },
  { value: 'pension', label: 'Pension Account', isAsset: true },
  { value: 'life-insurance', label: 'Life Insurance', isAsset: true },
  { value: 'credit-card', label: 'Credit Card', isAsset: false },
  { value: 'loan', label: 'Loan', isAsset: false },
  { value: 'mortgage', label: 'Mortgage', isAsset: false },
  { value: 'auto-loan', label: 'Auto Loan', isAsset: false },
  { value: 'other-asset', label: 'Other Asset', isAsset: true },
  { value: 'other-liability', label: 'Other Liability', isAsset: false },
];

export function AccountsWealth() {
  const state = useBudgetState();
  const { addTransaction, addCategory } = useBudget();
  const { addAccount, updateAccount, deleteAccount } = useAccountsDomain();
  const { addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useSavingsGoalsDomain();
  const { addWealthSnapshot } = useWealthSnapshotsDomain();
  const language = state.settings.language;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const [wealthViewMode, setWealthViewMode] = useState<WealthViewMode>('nominal');
  const [snapshotRange, setSnapshotRange] = useState<'1m' | '3m' | 'ytd' | 'all'>('3m');
  const [advancedSections, setAdvancedSections] = useState<string[]>([]);
  
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountFormData, setAccountFormData] = useState<Partial<Account>>(() => ({
    name: '',
    type: 'checking',
    openingBalance: 0,
    currentBalance: 0,
    isAsset: true,
    currency: state.settings.currency,
    isForeignCurrency: false,
    exchangeRate: 1,
    notes: '',
    owner: '',
    institution: '',
    statementDay: 1,
    dueDay: 15,
    pensionFundValue: 0,
    governmentContribution: 0,
    commodityName: 'Gold',
    commodityUnits: 0,
    commodityValuationMode: 'manual',
  }));

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalFormData, setGoalFormData] = useState<Partial<SavingsGoal>>({
    name: '',
    targetAmount: 0,
    currentAmount: 0,
  });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [openLiabilityId, setOpenLiabilityId] = useState<string | null>(null);
  const [isCardPaymentOpen, setIsCardPaymentOpen] = useState(false);
  const [cardPaymentForm, setCardPaymentForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    cardAccountId: '',
    paymentAccountId: '',
    amount: 0,
    description: '',
  });

  const clampDay = (value: number | undefined, fallback: number) => {
    const num = Number.isFinite(value) ? Math.trunc(value as number) : fallback;
    return Math.min(31, Math.max(1, num));
  };

  const handleSubmitAccount = () => {
    if (accountFormData.name && accountFormData.type !== undefined) {
      const isCreditCard = accountFormData.type === 'credit-card';
      const isPension = accountFormData.type === 'pension';
      const isCommodity = accountFormData.type === 'commodities';
      const statementDay = isCreditCard ? clampDay(accountFormData.statementDay, 1) : undefined;
      const dueDay = isCreditCard ? clampDay(accountFormData.dueDay, Math.min((statementDay ?? 1) + 10, 28)) : undefined;
      const pensionFundValue = accountFormData.pensionFundValue ?? 0;
      const governmentContribution = accountFormData.governmentContribution ?? 0;
      const commodityName = accountFormData.commodityName ?? '';
      const commodityUnits = accountFormData.commodityUnits ?? 0;
      const commodityValuationMode = accountFormData.commodityValuationMode ?? 'manual';
      const commodityPrice = isCommodity
        ? getCommodityMarketPrice({
            ...accountFormData,
            name: accountFormData.name,
            commodityName,
            commodityUnits,
            commodityValuationMode,
          } as Account)
        : 0;
      const commodityValue = commodityValuationMode === 'auto' ? commodityUnits * commodityPrice : (accountFormData.currentBalance ?? 0);
      const derivedBalance = isPension
        ? pensionFundValue + governmentContribution
        : isCommodity
          ? commodityValue
          : (accountFormData.currentBalance ?? 0);
      if (editingAccountId) {
        updateAccount(editingAccountId, {
          ...accountFormData,
          statementDay,
          dueDay,
          pensionFundValue,
          governmentContribution,
          commodityName,
          commodityUnits,
          commodityValuationMode,
          currentBalance: derivedBalance,
        });
        setEditingAccountId(null);
      } else {
        const currency = accountFormData.currency || state.settings.currency;
        const isForeignCurrency = accountFormData.isForeignCurrency ?? (currency !== state.settings.currency);
        addAccount({
          ...accountFormData,
          id: generateId(),
          currency,
          isForeignCurrency,
          exchangeRate: accountFormData.exchangeRate ?? 1,
          notes: accountFormData.notes ?? '',
          statementDay,
          dueDay,
          pensionFundValue,
          governmentContribution,
          commodityName,
          commodityUnits,
          commodityValuationMode,
          currentBalance: derivedBalance,
        } as Account);
      }
      resetAccountForm();
      setIsAccountModalOpen(false);
    }
  };

  const resetAccountForm = () => {
    setAccountFormData({
      name: '',
      type: 'checking',
      openingBalance: 0,
      currentBalance: 0,
      isAsset: true,
      currency: state.settings.currency,
      isForeignCurrency: false,
      exchangeRate: 1,
    notes: '',
    owner: '',
    institution: '',
    statementDay: 1,
    dueDay: 15,
    pensionFundValue: 0,
    governmentContribution: 0,
    commodityName: 'Gold',
    commodityUnits: 0,
    commodityValuationMode: 'manual',
  });
    setEditingAccountId(null);
  };

  const startEditAccount = (account: Account) => {
    setAccountFormData(account);
    setEditingAccountId(account.id);
    setIsAccountModalOpen(true);
  };

  const handleSubmitGoal = () => {
    if (goalFormData.name && goalFormData.targetAmount) {
      if (editingGoalId) {
        updateSavingsGoal(editingGoalId, goalFormData);
        setEditingGoalId(null);
      } else {
        addSavingsGoal({
          ...goalFormData,
          id: generateId(),
          currentAmount: goalFormData.currentAmount || 0,
        } as SavingsGoal);
      }
      resetGoalForm();
    }
  };

  const resetGoalForm = () => {
    setGoalFormData({
      name: '',
      targetAmount: 0,
      currentAmount: 0,
    });
    setEditingGoalId(null);
  };

  const startEditGoal = (goal: SavingsGoal) => {
    setGoalFormData(goal);
    setEditingGoalId(goal.id);
  };

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return t('No account', language);
    const account = state.accounts.find(item => item.id === accountId);
    if (!account) return t('Unknown', language);
    const institution = account.institution?.trim();
    const currencyTag = account.currency ? ` (${account.currency})` : '';
    return institution ? `${institution} • ${account.name}${currencyTag}` : `${account.name}${currencyTag}`;
  };

  const formatLocalAmount = (value: number, currency: string) =>
    `${currency} ${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;


  const paymentSourceAccounts = state.accounts.filter(account => account.isAsset && account.type !== 'credit-card');

  const getOrCreateCardPaymentCategory = () => {
    const name = 'Credit Card Payment';
    let category = state.categories.find(c => c.name === name && c.type === 'expense');
    if (!category) {
      category = {
        id: generateId(),
        name,
        type: 'expense',
        classification: 'savings',
        color: '#6366f1',
      };
      addCategory(category);
    }
    return category.id;
  };

  const resetCardPaymentForm = () => {
    setCardPaymentForm({
      date: format(new Date(), 'yyyy-MM-dd'),
      cardAccountId: '',
      paymentAccountId: '',
      amount: 0,
      description: '',
    });
  };

  const openCardPayment = (cardAccountId: string, suggestedAmount: number) => {
    setCardPaymentForm({
      date: format(new Date(), 'yyyy-MM-dd'),
      cardAccountId,
      paymentAccountId: paymentSourceAccounts[0]?.id ?? '',
      amount: suggestedAmount,
      description: '',
    });
    setIsCardPaymentOpen(true);
  };

  const handleCardPaymentSubmit = () => {
    if (!cardPaymentForm.cardAccountId || !cardPaymentForm.paymentAccountId || !cardPaymentForm.amount) {
      return;
    }
    const categoryId = getOrCreateCardPaymentCategory();
    const paymentAccount = state.accounts.find(a => a.id === cardPaymentForm.paymentAccountId);
    const accountCurrency = paymentAccount?.currency ?? state.settings.currency;
    const fxRateToBase = accountCurrency === state.settings.currency
      ? 1
      : (paymentAccount ? resolveAccountFxRate(paymentAccount) : 1);
    const accountAmount = cardPaymentForm.amount;
    const baseAmountValue = accountCurrency === state.settings.currency ? accountAmount : accountAmount * fxRateToBase;
    addTransaction({
      id: generateId(),
      date: cardPaymentForm.date,
      amount: baseAmountValue,
      baseAmount: baseAmountValue,
      accountAmount,
      accountCurrency,
      fxRateToBase,
      categoryId,
      accountId: cardPaymentForm.paymentAccountId,
      creditCardAccountId: cardPaymentForm.cardAccountId,
      paymentAccountId: cardPaymentForm.paymentAccountId,
      description: cardPaymentForm.description?.trim() || t('Credit Card Payment', language),
      type: 'expense',
      transactionKind: 'credit-card-payment',
    });
    resetCardPaymentForm();
    setIsCardPaymentOpen(false);
  };

  const today = new Date();
  const {
    accountBalances,
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
    assetAccounts,
    liabilityAccounts,
    cashTotal,
    goldTotal,
    blockedAssetsTotal,
    otherAssetsTotal,
    totalAssets,
    totalLiabilities,
    netWorth,
  } = getWealthTotals(state, today);
  const todayStr = format(today, 'yyyy-MM-dd');
  const fundCashflows = state.fundTransactions.map(t => ({
    date: t.date,
    amount: t.units > 0 ? -Math.abs(t.amount) : Math.abs(t.amount),
  }));
  if (fundAssetsTotal > 0) {
    fundCashflows.push({ date: todayStr, amount: fundAssetsTotal });
  }
  const fundXirr = calculateXirr(fundCashflows);
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
  const getMarketFxBaselineRate = (currency: string) => {
    if (!currency || currency === state.settings.currency) return 1;
    const normalizePair = (pair: string) => pair.replace(/\s+/g, '').toUpperCase();
    const directPair = normalizePair(`${currency}/${state.settings.currency}`);
    const inversePair = normalizePair(`${state.settings.currency}/${currency}`);
    const direct = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === directPair)?.baselineRate;
    if (Number.isFinite(direct) && (direct as number) > 0) return direct as number;
    const inverse = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === inversePair)?.baselineRate;
    if (Number.isFinite(inverse) && (inverse as number) > 0) return 1 / (inverse as number);
    return 1;
  };
  const resolveAccountFxRate = (account: Account) => {
    if (!account.currency || account.currency === state.settings.currency) return 1;
    const exchangeRate = account.exchangeRate;
    if (Number.isFinite(exchangeRate) && (exchangeRate as number) > 0) return exchangeRate as number;
    return getMarketFxRate(account.currency);
  };
  const resolveAccountBaselineFxRate = (account: Account) => {
    if (!account.currency || account.currency === state.settings.currency) return 1;
    const exchangeRate = account.exchangeRate;
    if (Number.isFinite(exchangeRate) && (exchangeRate as number) > 0 && exchangeRate !== 1) {
      return exchangeRate as number;
    }
    const baseline = getMarketFxBaselineRate(account.currency);
    return Number.isFinite(baseline) && (baseline as number) > 0 ? (baseline as number) : getMarketFxRate(account.currency);
  };
  const getCommodityMarketPrice = (account: Account) => {
    const fallbackName = account.commodityName?.trim()
      || (account.name.toLowerCase().includes('gold') || account.name.toLowerCase().includes('altin') ? 'Gold' : '');
    if (!fallbackName) return 0;
    const match = state.marketData.commodities.find(item => item.commodity.toLowerCase() === fallbackName.toLowerCase());
    return match?.price ?? 0;
  };
  const getCommodityBaselinePrice = (account: Account) => {
    const fallbackName = account.commodityName?.trim()
      || (account.name.toLowerCase().includes('gold') || account.name.toLowerCase().includes('altin') ? 'Gold' : '');
    if (!fallbackName) return 0;
    const match = state.marketData.commodities.find(item => item.commodity.toLowerCase() === fallbackName.toLowerCase());
    return match?.baselinePrice ?? 0;
  };
  const getCommodityBaselineValue = (account: Account) => {
    const units = account.commodityUnits ?? 0;
    const baselinePrice = getCommodityBaselinePrice(account);
    if (baselinePrice > 0) return units * baselinePrice;
    return account.openingBalance ?? 0;
  };
  const toBase = (value: number, account: Account) => {
    if (account.currency && account.currency !== state.settings.currency) {
      return value * resolveAccountFxRate(account);
    }
    return value;
  };
  const toBaselineBase = (value: number, account: Account) => {
    if (account.currency && account.currency !== state.settings.currency) {
      return value * resolveAccountBaselineFxRate(account);
    }
    return value;
  };
  const getAccountLocalValue = (account: Account) => {
    if (account.type === 'commodities' && account.commodityValuationMode === 'auto') {
      const units = account.commodityUnits ?? 0;
      const price = getCommodityMarketPrice(account);
      return units * price;
    }
    if (account.type === 'pension') {
      return (account.pensionFundValue ?? 0) + (account.governmentContribution ?? 0);
    }
    return accountBalances.get(account.id) ?? account.currentBalance;
  };
  const getAccountValue = (account: Account) => toBase(getAccountLocalValue(account), account);
  const getAccountBaselineValue = (account: Account) => {
    if (account.type === 'commodities') {
      return toBaselineBase(getCommodityBaselineValue(account), account);
    }
    return toBaselineBase(account.openingBalance ?? 0, account);
  };

  const applyView = (value: number, date: string = todayStr) => {
    if (wealthViewMode === 'nominal') return { value, adjusted: true };
    return adjustForInflation(value, date);
  };
  const adjustedNetWorth = applyView(netWorth);
  const adjustedCashTotal = applyView(cashTotal);
  const adjustedFundAssetsTotal = applyView(fundAssetsTotal);
  const adjustedDepositsTotal = applyView(depositsTotal);
  const adjustedGoldTotal = applyView(goldTotal);
  const adjustedBlockedTotal = applyView(blockedAssetsTotal);
  const adjustedOtherAssetsTotal = applyView(otherAssetsTotal);
  const adjustedLiabilitiesTotal = applyView(totalLiabilities);
  const realDataAvailable = [
    adjustedNetWorth,
    adjustedCashTotal,
    adjustedFundAssetsTotal,
    adjustedDepositsTotal,
    adjustedGoldTotal,
    adjustedBlockedTotal,
    adjustedOtherAssetsTotal,
    adjustedLiabilitiesTotal,
  ].every(item => item.adjusted);

  const adjustedFundCurrent = applyView(fundAssetsTotal);
  const adjustedFundInvested = applyView(fundNetInvested);
  const adjustedFundCostBasis = applyView(fundCostBasisTotal);
  const adjustedFundUnrealized = applyView(fundUnrealizedPnL);
  const fundRealAvailable = adjustedFundCurrent.adjusted && adjustedFundInvested.adjusted;
  const fundRealReturn = adjustedFundInvested.value !== 0
    ? (adjustedFundCurrent.value - adjustedFundInvested.value) / adjustedFundInvested.value
    : 0;
  const pensionTotal = (accountFormData.pensionFundValue ?? 0) + (accountFormData.governmentContribution ?? 0);
  const commodityPreviewValue = accountFormData.type === 'commodities' && accountFormData.commodityValuationMode === 'auto'
    ? (accountFormData.commodityUnits ?? 0) * getCommodityMarketPrice({
        ...accountFormData,
        name: accountFormData.name || '',
        commodityName: accountFormData.commodityName ?? '',
        commodityUnits: accountFormData.commodityUnits ?? 0,
        commodityValuationMode: accountFormData.commodityValuationMode ?? 'manual',
      } as Account)
    : (accountFormData.currentBalance ?? 0);

  const handleCaptureSnapshot = () => {
    addWealthSnapshot({
      id: generateId(),
      date: todayStr,
      totalAssets,
      totalDebts: totalLiabilities,
      netWealth: netWorth,
      cash: cashTotal,
      funds: fundAssetsTotal,
      deposits: depositsTotal,
      gold: goldTotal,
      blockedAssets: blockedAssetsTotal,
      otherAssets: otherAssetsTotal,
    });
  };

  const filteredSnapshots = filterSnapshotsByRange(state.wealthSnapshots, snapshotRange);
  const snapshotSeries = filteredSnapshots.length > 0
    ? filteredSnapshots
    : [{
        id: 'current',
        date: todayStr,
        totalAssets,
        totalDebts: totalLiabilities,
        netWealth: netWorth,
        cash: cashTotal,
        funds: fundAssetsTotal,
        deposits: depositsTotal,
        gold: goldTotal,
        blockedAssets: blockedAssetsTotal,
        otherAssets: otherAssetsTotal,
      }];

  const timelineData = snapshotSeries.map(snapshot => {
    const net = applyView(snapshot.netWealth, snapshot.date);
    const assets = applyView(snapshot.totalAssets, snapshot.date);
    const debts = applyView(snapshot.totalDebts, snapshot.date);
    return {
      date: snapshot.date,
      net: net.value,
      assets: assets.value,
      debts: debts.value,
    };
  });

  const accountById = new Map(state.accounts.map(account => [account.id, account]));
  const transactionImpactByAccount = new Map<string, number>();
  const fundCashImpactByAccount = new Map<string, number>();
  const transactionById = new Map(state.transactions.map(tx => [tx.id, tx]));

  state.transactions.forEach(tx => {
    if (tx.transactionKind === 'credit-card-payment') {
      const paymentAccountId = tx.paymentAccountId ?? tx.accountId;
      if (!paymentAccountId) return;
      const current = transactionImpactByAccount.get(paymentAccountId) ?? 0;
      transactionImpactByAccount.set(paymentAccountId, current - tx.amount);
      return;
    }

    if (!tx.accountId) return;
    const account = accountById.get(tx.accountId);
    if (!account || account.type === 'credit-card') return;
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    const current = transactionImpactByAccount.get(tx.accountId) ?? 0;
    transactionImpactByAccount.set(tx.accountId, current + delta);
  });

  state.fundTransactions.forEach(tx => {
    if (!tx.cashTransactionId) return;
    const cashTx = transactionById.get(tx.cashTransactionId);
    if (!cashTx || !cashTx.accountId) return;
    const delta = cashTx.type === 'income' ? cashTx.amount : -cashTx.amount;
    const current = fundCashImpactByAccount.get(cashTx.accountId) ?? 0;
    fundCashImpactByAccount.set(cashTx.accountId, current + delta);
  });

  const reconciliationAccounts = state.accounts.filter(a => a.type !== 'credit-card');
  const creditCardAccounts = state.accounts.filter(a => a.type === 'credit-card');
  const selectedCard = creditCardAccounts.find(a => a.id === cardPaymentForm.cardAccountId);
  const selectedCardSummary = selectedCard
    ? getCreditCardCycleSummary(selectedCard, state.transactions, today)
    : null;

  const dataIssues: Array<{ level: 'error' | 'warning'; message: string }> = [];
  const formatIssue = (key: string, count: number) => t(key, language).replace('{count}', String(count));
  const invalidFundRows = state.fundTransactions.filter(t => !t.date || !t.fund || !t.price || t.units === 0);
  if (invalidFundRows.length > 0) {
    dataIssues.push({ level: 'error', message: formatIssue('Fund transactions have missing fields or zero units.', invalidFundRows.length) });
  }
  const holdingsMissingPrice = fundHoldings.filter(h => h.currentPrice === 0 && h.lastPrice === 0);
  if (holdingsMissingPrice.length > 0) {
    dataIssues.push({ level: 'warning', message: formatIssue('Fund holdings have no price for valuation.', holdingsMissingPrice.length) });
  }
  const invalidDeposits = state.deposits.filter(
    d => !d.startDate || d.principal <= 0 || d.termDays <= 0 || d.grossRate <= 0
  );
  if (invalidDeposits.length > 0) {
    dataIssues.push({ level: 'error', message: formatIssue('Deposits have missing dates or invalid principal/term/rate.', invalidDeposits.length) });
  }

  const reconciliationRows = [
    {
      label: t('Net Wealth = Assets - Debts', language),
      expected: totalAssets - totalLiabilities,
      actual: netWorth,
    },
    {
      label: t('Funds Total = Sum of Holdings', language),
      expected: fundHoldings.reduce((sum, h) => sum + h.currentValue, 0),
      actual: fundAssetsTotal,
    },
    {
      label: t('Deposits Total = Sum of Deposits', language),
      expected: activeDeposits.reduce((sum, d) => sum + getDepositExpectedValue(d), 0),
      actual: depositsTotal,
    },
  ].map(row => ({
    ...row,
    delta: row.actual - row.expected,
  }));

  const institutionBreakdown = buildWealthBreakdown(
    assetAccounts,
    liabilityAccounts,
    accountBalances,
    fundHoldings,
    activeDeposits,
    state.settings.currency,
    state.marketData.fxRates,
    state.marketData.commodities,
    ({ account, deposit }) => account?.institution?.trim() || deposit?.institution?.trim() || ''
  );

  const personBreakdown = buildWealthBreakdown(
    assetAccounts,
    liabilityAccounts,
    accountBalances,
    fundHoldings,
    activeDeposits,
    state.settings.currency,
    state.marketData.fxRates,
    state.marketData.commodities,
    ({ account, deposit }) => account?.owner?.trim() || deposit?.owner?.trim() || ''
  );

  const renderBreakdownName = (name: string) => (name === 'Unassigned' ? t('Unassigned', language) : name);

  const liabilityCards = [
    ...liabilityAccounts.map(account => {
      const derivedBalance = accountBalances.get(account.id) ?? account.currentBalance;
      const cardSummary = account.type === 'credit-card'
        ? getCreditCardCycleSummary(account, state.transactions, today)
        : null;
      return {
        kind: 'account' as const,
        id: account.id,
        account,
        derivedBalance,
        cardSummary,
      };
    }),
    ...state.debts.map(debt => ({
      kind: 'debt' as const,
      id: debt.id,
      debt,
    })),
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('Accounts & Wealth Tracking', language)}</h1>
        <p className="text-gray-600">{t('Monitor your accounts, net worth, and savings goals', language)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWealthViewMode('nominal')}
            className={`px-4 py-2 rounded-lg text-sm ${wealthViewMode === 'nominal' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {t('Nominal', language)}
          </button>
          <button
            onClick={() => setWealthViewMode('real')}
            className={`px-4 py-2 rounded-lg text-sm ${wealthViewMode === 'real' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {t('Real', language)}
          </button>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(prev => !prev)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('Add', language)}
          </button>
          {showAddMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow z-10">
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setIsAccountModalOpen(true);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                {t('Add Account', language)}
              </button>
            </div>
          )}
        </div>
      </div>

      {wealthViewMode === 'real' && !realDataAvailable && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          {t('Real values unavailable: no inflation data configured.', language)}
        </div>
      )}

      {/* Asset Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-500">{t('Cash', language)}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(adjustedCashTotal.value, state.settings.currency, locale)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5 border border-emerald-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">{t('Funds', language)}</div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(adjustedFundAssetsTotal.value, state.settings.currency, locale)}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {t('Cost Basis', language)}: {formatCurrency(adjustedFundCostBasis.value, state.settings.currency, locale)}
          </div>
          <div className={`text-xs ${adjustedFundUnrealized.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {t('Unrealized P/L', language)}: {formatCurrency(adjustedFundUnrealized.value, state.settings.currency, locale)} ({fundUnrealizedPnLPct.toFixed(2)}%)
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {activeFundsCount} {t('active funds', language)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-500">{t('Commodities', language)}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(adjustedGoldTotal.value, state.settings.currency, locale)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-500">{t('Deposits', language)}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(adjustedDepositsTotal.value, state.settings.currency, locale)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-500">{t('Debts', language)}</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {formatCurrency(adjustedLiabilitiesTotal.value, state.settings.currency, locale)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5 border border-blue-200">
          <div className="text-sm text-gray-500">{t('Net Wealth', language)}</div>
          <div className={`text-2xl font-bold mt-1 ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(adjustedNetWorth.value, state.settings.currency, locale)}
          </div>
          <div className="text-xs text-gray-500 mt-1">{t('Assets - Liabilities', language)}</div>
        </div>
      </div>

      {/* Quick Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-500">{t('Funds Summary', language)}</div>
            <button
              onClick={() => setAdvancedSections(prev => Array.from(new Set([...prev, 'fund-holdings'])))}
              className="text-xs text-emerald-700 hover:underline"
            >
              {t('View holdings', language)}
            </button>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(adjustedFundAssetsTotal.value, state.settings.currency, locale)}
          </div>
          <div className={`text-sm ${adjustedFundUnrealized.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {t('Unrealized P/L', language)}: {formatCurrency(adjustedFundUnrealized.value, state.settings.currency, locale)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {activeFundsCount} {t('active funds', language)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-500 mb-2">{t('Deposits Summary', language)}</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(activePrincipalTotal, state.settings.currency, locale)}
          </div>
          <div className="text-sm text-gray-700">{t('Net Interest', language)}: {formatCurrency(activeNetInterestTotal, state.settings.currency, locale)}</div>
          <div className="text-sm text-gray-700">{t('Next Maturity', language)}: {nextMaturity || '-'}</div>
          <div className="text-xs text-gray-500 mt-1">
            {t('Active', language)}: {activeDepositCount} • {t('Maturing in 7 days', language)}: {maturingIn7}
          </div>
        </div>
      </div>

      {/* Accounts Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Accounts */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{t('Asset Accounts', language)}</h2>
          </div>
          <div className="space-y-2">
            {assetAccounts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t('No accounts available.', language)}</p>
            ) : (
              assetAccounts.map(account => {
                const localBalance = getAccountLocalValue(account);
                const derivedBalance = getAccountValue(account);
                  const baselineValue = getAccountBaselineValue(account);
                  const change = derivedBalance - baselineValue;
                  const changePct = baselineValue > 0 ? (change / baselineValue) * 100 : 0;
                return (
                  <div key={account.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-900" title={getAccountLabel(account.id)}>
                          {getAccountLabel(account.id)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {t(accountTypes.find(t => t.value === account.type)?.label ?? '', language)}
                        </div>
                        {account.institution && (
                          <div className="text-xs text-gray-500">{t('Institution', language)}: {account.institution}</div>
                        )}
                        {account.owner && (
                          <div className="text-xs text-gray-500">{t('Owner', language)}: {account.owner}</div>
                        )}
                        {account.currency && (
                          <div className="text-xs text-gray-500">{t('Account Currency', language)}: {account.currency}</div>
                        )}
                        {account.type === 'commodities' && (
                          <div className="text-xs text-gray-500">
                            {t('Commodity', language)}: {account.commodityName || account.name} • {t('Units', language)}: {account.commodityUnits ?? 0} • {t('Mode', language)}: {t(account.commodityValuationMode === 'auto' ? 'Auto Fetch' : 'Manual', language)}
                          </div>
                        )}
                        {account.type === 'pension' && (
                          <div className="text-xs text-gray-500">
                            {t('Fund Value', language)}: {formatCurrency(account.pensionFundValue ?? 0, state.settings.currency, locale)}
                            {' • '}
                            {t('Government Contribution', language)}: {formatCurrency(account.governmentContribution ?? 0, state.settings.currency, locale)}
                          </div>
                        )}
                        {account.notes && (
                          <div className="text-xs text-gray-500">{account.notes}</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditAccount(account)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteAccount(account.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(derivedBalance, state.settings.currency, locale)}
                      </div>
                      <div className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change >= 0 ? '+' : ''}{formatCurrency(change, state.settings.currency, locale)}
                        {baselineValue > 0 && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({changePct.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    {account.isForeignCurrency && account.currency && (
                      <div className="mt-1 text-xs text-gray-500">
                        {formatLocalAmount(localBalance, account.currency)} • {t('FX Rate to Base', language)}: {resolveAccountFxRate(account)} → {formatCurrency(derivedBalance, state.settings.currency, locale)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Liability Accounts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Liability Accounts', language)}</h2>
          {liabilityCards.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('No accounts available.', language)}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {liabilityCards.map(item => {
                if (item.kind === 'account') {
                  const account = item.account;
                  const cardSummary = item.cardSummary;
                  const cardId = `account-${account.id}`;
                  const isOpen = openLiabilityId === cardId;
                  const localBalance = accountBalances.get(account.id) ?? account.currentBalance;
                  const baseBalance = account.currency && account.currency !== state.settings.currency
                    ? localBalance * resolveAccountFxRate(account)
                    : localBalance;
                  const balance = cardSummary?.unpaidStatementBalance ?? Math.abs(baseBalance);
                  const change = baseBalance - toBase(account.openingBalance, account);
                  const typeLabel = t(accountTypes.find(t => t.value === account.type)?.label ?? '', language);

                  return (
                    <div key={cardId} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-gray-900" title={getAccountLabel(account.id)}>
                            {getAccountLabel(account.id)}
                          </div>
                          <div className="text-xs text-gray-600">{typeLabel}</div>
                          {account.institution && (
                            <div className="text-xs text-gray-500">{t('Institution', language)}: {account.institution}</div>
                          )}
                          {account.owner && (
                            <div className="text-xs text-gray-500">{t('Owner', language)}: {account.owner}</div>
                          )}
                          {account.currency && (
                            <div className="text-xs text-gray-500">{t('Account Currency', language)}: {account.currency}</div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEditAccount(account)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteAccount(account.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-red-700">
                            {formatCurrency(Math.abs(balance), state.settings.currency, locale)}
                          </div>
                          <div className={`text-xs ${change <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change <= 0 ? '' : '+'}{formatCurrency(Math.abs(change), state.settings.currency, locale)}
                          </div>
                          {account.isForeignCurrency && account.currency && !cardSummary && (
                            <div className="mt-1 text-xs text-gray-500">
                            {formatLocalAmount(Math.abs(localBalance), account.currency)} ? {t('FX Rate to Base', language)}: {resolveAccountFxRate(account)} ? {formatCurrency(Math.abs(baseBalance), state.settings.currency, locale)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {cardSummary && (
                            <button
                              onClick={() => openCardPayment(account.id, cardSummary.unpaidStatementBalance > 0 ? cardSummary.unpaidStatementBalance : cardSummary.totalExposure)}
                              className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                            >
                              {t('Pay', language)}
                            </button>
                          )}
                          <button
                            onClick={() => setOpenLiabilityId(prev => (prev === cardId ? null : cardId))}
                            className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            {isOpen ? t('Hide', language) : t('View', language)}
                          </button>
                        </div>
                      </div>
                      {cardSummary && (
                        <div className="mt-2 text-xs text-gray-600">
                          {t('Unpaid Statement', language)}: {formatCurrency(cardSummary.unpaidStatementBalance, state.settings.currency, locale)} â€¢ {t('Unbilled Spending', language)}: {formatCurrency(cardSummary.unbilledSpending, state.settings.currency, locale)}
                        </div>
                      )}
                      {isOpen && cardSummary && (
                        <div className="mt-3 text-xs text-gray-600 space-y-1">
                          <div>{t('Statement Balance', language)}: {formatCurrency(cardSummary.statementBalance, state.settings.currency, locale)}</div>
                          <div>{t('Unpaid Statement', language)}: {formatCurrency(cardSummary.unpaidStatementBalance, state.settings.currency, locale)}</div>
                          <div>{t('Unbilled Spending', language)}: {formatCurrency(cardSummary.unbilledSpending, state.settings.currency, locale)}</div>
                          <div>{t('Exposure', language)}: {formatCurrency(cardSummary.totalExposure, state.settings.currency, locale)}</div>
                          <div>{t('Due', language)}: {cardSummary.dueDate}</div>
                        </div>
                      )}
                      {isOpen && !cardSummary && (
                        <div className="mt-3 text-xs text-gray-600 space-y-1">
                          <div>{t('Opening Balance', language)}: {formatCurrency(account.openingBalance, state.settings.currency, locale)}</div>
                          <div>{t('Current Balance', language)}: {formatCurrency(Math.abs(item.derivedBalance), state.settings.currency, locale)}</div>
                        </div>
                      )}
                    </div>
                  );
                }

                const debtCardId = `debt-${item.id}`;
                const isOpen = openLiabilityId === debtCardId;
                const debt = item.debt;
                const balance = Math.abs(debt.currentBalance || 0);
                return (
                  <div key={debtCardId} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{debt.name}</div>
                        <div className="text-xs text-gray-600">{t('Debts', language)}</div>
                      </div>
                      <button
                        onClick={() => setOpenLiabilityId(prev => (prev === debtCardId ? null : debtCardId))}
                        className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        {isOpen ? t('Hide', language) : t('View', language)}
                      </button>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-red-700">
                        {formatCurrency(balance, state.settings.currency, locale)}
                      </div>
                      {debt.minimumPayment > 0 && (
                        <div className="text-xs text-gray-600">
                          {t('Min. Payment', language)}: {formatCurrency(debt.minimumPayment, state.settings.currency, locale)}
                        </div>
                      )}
                    </div>
                    {isOpen && (
                      <div className="mt-3 text-xs text-gray-600 space-y-1">
                        <div>{t('Total Amount', language)}: {formatCurrency(debt.totalAmount, state.settings.currency, locale)}</div>
                        <div>{t('Monthly Interest Rate (%)', language)}: {(debt.interestRate / 12).toFixed(2)}%</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Advanced */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t('Advanced', language)}</h2>
            <p className="text-sm text-gray-600">{t('Details, breakdowns, and diagnostics', language)}</p>
          </div>
        </div>
        <Accordion type="multiple" value={advancedSections} onValueChange={setAdvancedSections} className="space-y-3">
          <AccordionItem value="fund-holdings" className="border border-gray-200 rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t('Fund Holdings', language)}</AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Fund', language)}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Account', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Net Units', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Avg Cost', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Current Price', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Value', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Unrealized P/L', language)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {fundHoldings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                          {t('No fund holdings available.', language)}
                        </td>
                      </tr>
                    ) : (
                      fundHoldings.map(holding => (
                        <tr key={`${holding.accountId ?? 'none'}-${holding.fund}`}>
                          <td className="px-3 py-2">{holding.fund}</td>
                          <td className="px-3 py-2">
                            <span title={getAccountLabel(holding.accountId)}>{getAccountLabel(holding.accountId)}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {Math.trunc(holding.netUnits).toLocaleString(locale, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(holding.avgCost, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(holding.currentPrice, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(holding.currentValue, state.settings.currency, locale)}</td>
                          <td className={`px-3 py-2 text-right ${holding.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(holding.unrealizedPnL, state.settings.currency, locale)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {t('Valuation uses the latest transaction price unless a current price is set.', language)}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="institution-breakdown" className="border border-gray-200 rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t('Institution Breakdown', language)}</AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Institution', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Cash', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Funds', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Deposits', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Debts', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Total', language)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {institutionBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                          {t('No data available.', language)}
                        </td>
                      </tr>
                    ) : (
                      institutionBreakdown.map(row => (
                        <tr key={`inst-${row.name}`}>
                          <td className="px-3 py-2">{renderBreakdownName(row.name)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.cash, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.funds, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.deposits, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right text-red-600">{formatCurrency(row.debts, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.total, state.settings.currency, locale)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="person-breakdown" className="border border-gray-200 rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t('Person Breakdown', language)}</AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Owner', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Cash', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Funds', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Deposits', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Debts', language)}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Total', language)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {personBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                          {t('No data available.', language)}
                        </td>
                      </tr>
                    ) : (
                      personBreakdown.map(row => (
                        <tr key={`person-${row.name}`}>
                          <td className="px-3 py-2">{renderBreakdownName(row.name)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.cash, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.funds, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.deposits, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right text-red-600">{formatCurrency(row.debts, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.total, state.settings.currency, locale)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="wealth-history" className="border border-gray-200 rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t('Wealth History', language)}</AccordionTrigger>
            <AccordionContent>
              <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t('Wealth History', language)}</h2>
            <p className="text-sm text-gray-600">{t('Snapshots of total wealth over time', language)}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={snapshotRange}
              onChange={(e) => setSnapshotRange(e.target.value as typeof snapshotRange)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="1m">1M</option>
              <option value="3m">3M</option>
              <option value="ytd">YTD</option>
              <option value="all">{t('All', language)}</option>
            </select>
            <button
              onClick={handleCaptureSnapshot}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              {t('Capture Snapshot', language)}
            </button>
          </div>
        </div>
        <div className="h-64 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData}>
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value: number) => formatCurrency(value, state.settings.currency, locale)} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, state.settings.currency, locale)}
              />
              <Legend />
              <Line type="monotone" dataKey="net" name={t('Net Worth', language)} stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="assets" name={t('Assets', language)} stroke="#3b82f6" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="debts" name={t('Liabilities', language)} stroke="#ef4444" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Date', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Net', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Assets', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Debts', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Cash', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Funds', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Deposits', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Commodities', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Blocked', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Other', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                    {t('No snapshots yet. Capture a snapshot to start tracking history.', language)}
                  </td>
                </tr>
              ) : (
                filteredSnapshots.map(snapshot => {
                  const net = applyView(snapshot.netWealth, snapshot.date);
                  const assets = applyView(snapshot.totalAssets, snapshot.date);
                  const debts = applyView(snapshot.totalDebts, snapshot.date);
                  const cash = applyView(snapshot.cash, snapshot.date);
                  const funds = applyView(snapshot.funds, snapshot.date);
                  const deposits = applyView(snapshot.deposits, snapshot.date);
                  const gold = applyView(snapshot.gold, snapshot.date);
                  const blocked = applyView(snapshot.blockedAssets, snapshot.date);
                  const other = applyView(snapshot.otherAssets, snapshot.date);
                  return (
                    <tr key={snapshot.id}>
                      <td className="px-3 py-2">{snapshot.date}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(net.value, state.settings.currency, locale)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(assets.value, state.settings.currency, locale)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(debts.value, state.settings.currency, locale)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(cash.value, state.settings.currency, locale)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(funds.value, state.settings.currency, locale)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(deposits.value, state.settings.currency, locale)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(gold.value, state.settings.currency, locale)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(blocked.value, state.settings.currency, locale)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(other.value, state.settings.currency, locale)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {wealthViewMode === 'real' && !realDataAvailable && (
          <div className="text-xs text-amber-700 mt-2">{t('Real history unavailable without inflation data.', language)}</div>
        )}
      </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reconciliation" className="border border-gray-200 rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t('Reconciliation', language)}</AccordionTrigger>
            <AccordionContent>
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{t('Account Reconciliation', language)}</h2>
                  <p className="text-sm text-gray-600">
                    {t('Opening balance + transaction impact + manual adjustment = current app balance.', language)}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Account', language)}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Opening', language)}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Transactions Impact', language)}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Fund Cash', language)}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Manual Adj.', language)}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('App Balance', language)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reconciliationAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                            {t('No accounts available.', language)}
                          </td>
                        </tr>
                      ) : (
                        reconciliationAccounts.map(account => {
                          const derivedBalance = accountBalances.get(account.id) ?? account.currentBalance;
                          const opening = account.openingBalance ?? 0;
                          const transactionImpact = transactionImpactByAccount.get(account.id) ?? 0;
                          const manualAdjustment = derivedBalance - (opening + transactionImpact);
                          const fundImpact = fundCashImpactByAccount.get(account.id) ?? 0;
                          return (
                            <tr key={account.id}>
                              <td className="px-3 py-2">
                                <span title={getAccountLabel(account.id)}>{getAccountLabel(account.id)}</span>
                              </td>
                              <td className="px-3 py-2 text-right">{formatCurrency(opening, state.settings.currency, locale)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(transactionImpact, state.settings.currency, locale)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(fundImpact, state.settings.currency, locale)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(manualAdjustment, state.settings.currency, locale)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(derivedBalance, state.settings.currency, locale)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Credit Card Cycles', language)}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Credit Card', language)}</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Statement Balance', language)}</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Unpaid Statement', language)}</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Unbilled Spending', language)}</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Paid Amount', language)}</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Exposure', language)}</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Due', language)}</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Actions', language)}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {creditCardAccounts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                              {t('No credit cards available.', language)}
                            </td>
                          </tr>
                        ) : (
                          creditCardAccounts.map(account => {
                            const summary = getCreditCardCycleSummary(account, state.transactions, today);
                            if (!summary) return null;
                            const suggestedAmount = summary.unpaidStatementBalance > 0
                              ? summary.unpaidStatementBalance
                              : summary.totalExposure;
                            return (
                              <tr key={account.id}>
                                <td className="px-3 py-2">
                                  <span title={getAccountLabel(account.id)}>{getAccountLabel(account.id)}</span>
                                </td>
                                <td className="px-3 py-2 text-right">{formatCurrency(summary.statementBalance, state.settings.currency, locale)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(summary.unpaidStatementBalance, state.settings.currency, locale)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(summary.unbilledSpending, state.settings.currency, locale)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(summary.paidAmount, state.settings.currency, locale)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(summary.totalExposure, state.settings.currency, locale)}</td>
                                <td className="px-3 py-2">{summary.dueDate}</td>
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => openCardPayment(account.id, suggestedAmount)}
                                    disabled={suggestedAmount <= 0}
                                    className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {t('Pay', language)}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="data-health" className="border border-gray-200 rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t('Data Health & Reconciliation', language)}</AccordionTrigger>
            <AccordionContent>
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t('Data Health & Reconciliation', language)}</h2>
          <div className="text-sm text-gray-600">
            {dataIssues.length === 0 ? t('No data issues detected.', language) : `${dataIssues.length} ${t('issues detected', language)}`}
          </div>
        </div>

        <div className="space-y-2">
          {dataIssues.length === 0 ? (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {t('No data issues detected.', language)}
            </div>
          ) : (
            dataIssues.map((issue, index) => (
              <div
                key={`${issue.level}-${index}`}
                className={`text-sm rounded-lg px-3 py-2 ${
                  issue.level === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                }`}
              >
                {issue.message}
              </div>
            ))
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('Check', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Expected', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Actual', language)}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Delta', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reconciliationRows.map(row => {
                const delta = Math.abs(row.delta);
                const ok = delta < 0.01;
                return (
                  <tr key={row.label}>
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.expected, state.settings.currency, locale)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.actual, state.settings.currency, locale)}</td>
                    <td className={`px-3 py-2 text-right ${ok ? 'text-green-600' : 'text-amber-600'}`}>
                      {formatCurrency(row.delta, state.settings.currency, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="savings-goals" className="border border-gray-200 rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold">{t('Savings Goals', language)}</AccordionTrigger>
            <AccordionContent>
              <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {editingGoalId ? t('Edit Savings Goal', language) : t('Add Savings Goal', language)}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Goal Name', language)} *</label>
            <input
              type="text"
              value={goalFormData.name || ''}
              onChange={(e) => setGoalFormData({ ...goalFormData, name: e.target.value })}
              placeholder={t('e.g., Emergency Fund', language)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Target Amount', language)} * ({state.settings.currency})
            </label>
            <input
              type="number"
              value={goalFormData.targetAmount || ''}
              onChange={(e) => setGoalFormData({ ...goalFormData, targetAmount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Current Amount', language)} ({state.settings.currency})
            </label>
            <input
              type="number"
              value={goalFormData.currentAmount || ''}
              onChange={(e) => setGoalFormData({ ...goalFormData, currentAmount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Target Date (Optional)', language)}</label>
            <input
              type="date"
              value={goalFormData.targetDate || ''}
              onChange={(e) => setGoalFormData({ ...goalFormData, targetDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSubmitGoal}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            {editingGoalId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingGoalId ? t('Update Goal', language) : t('Add Goal', language)}
          </button>
          {editingGoalId && (
            <button
              onClick={resetGoalForm}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('Cancel', language)}
            </button>
          )}
        </div>
      </div>

      {/* Goals List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Savings Goals Progress', language)}</h2>
        <div className="space-y-4">
          {state.savingsGoals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('No savings goals set yet', language)}</p>
          ) : (
            state.savingsGoals.map(goal => {
              const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
              const remaining = goal.targetAmount - goal.currentAmount;

              return (
                <div key={goal.id} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-900 text-lg">{goal.name}</div>
                      {goal.targetDate && (
                        <div className="text-sm text-gray-600">{t('Target:', language)} {goal.targetDate}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditGoal(goal)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteSavingsGoal(goal.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">
                        {state.settings.currency}{goal.currentAmount.toFixed(2)} of {state.settings.currency}{goal.targetAmount.toFixed(2)}
                      </span>
                      <span className="font-semibold text-blue-700">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-blue-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                        {remaining > 0 ? (
                      <span>{state.settings.currency}{remaining.toFixed(2)} {t('remaining to reach goal', language)}</span>
                    ) : (
                      <span className="text-green-600 font-semibold">🎉 {t('Goal achieved!', language)}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <Dialog
        open={isCardPaymentOpen}
        onOpenChange={(open) => {
          setIsCardPaymentOpen(open);
          if (!open) resetCardPaymentForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('Credit Card Payment', language)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Payment Date', language)} *</label>
              <input
                type="date"
                value={cardPaymentForm.date}
                onChange={(e) => setCardPaymentForm({ ...cardPaymentForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Credit Card', language)} *</label>
              <select
                value={cardPaymentForm.cardAccountId}
                onChange={(e) => setCardPaymentForm({ ...cardPaymentForm, cardAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">{t('Select credit card...', language)}</option>
                {creditCardAccounts.map(account => (
                  <option key={account.id} value={account.id}>{getAccountLabel(account.id)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Source Account', language)} *</label>
              <select
                value={cardPaymentForm.paymentAccountId}
                onChange={(e) => setCardPaymentForm({ ...cardPaymentForm, paymentAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">{t('Select source account...', language)}</option>
                {paymentSourceAccounts.map(account => (
                  <option key={account.id} value={account.id}>{getAccountLabel(account.id)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Amount', language)} * ({state.settings.currency})</label>
              <input
                type="number"
                value={cardPaymentForm.amount || ''}
                onChange={(e) => setCardPaymentForm({ ...cardPaymentForm, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description (Optional)', language)}</label>
              <input
                type="text"
                value={cardPaymentForm.description}
                onChange={(e) => setCardPaymentForm({ ...cardPaymentForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          {selectedCardSummary && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
              <button
                onClick={() => setCardPaymentForm({ ...cardPaymentForm, amount: selectedCardSummary.unpaidStatementBalance })}
                className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('Use Unpaid Statement', language)}: {formatCurrency(selectedCardSummary.unpaidStatementBalance, state.settings.currency, locale)}
              </button>
              <button
                onClick={() => setCardPaymentForm({ ...cardPaymentForm, amount: selectedCardSummary.totalExposure })}
                className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('Use Total Exposure', language)}: {formatCurrency(selectedCardSummary.totalExposure, state.settings.currency, locale)}
              </button>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => {
                setIsCardPaymentOpen(false);
                resetCardPaymentForm();
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('Cancel', language)}
            </button>
            <button
              onClick={handleCardPaymentSubmit}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              {t('Add Payment', language)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAccountModalOpen}
        onOpenChange={(open) => {
          setIsAccountModalOpen(open);
          if (!open) resetAccountForm();
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingAccountId ? t('Edit Account', language) : t('Add Account', language)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account Name', language)} *</label>
              <input
                type="text"
                value={accountFormData.name || ''}
                onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account Type', language)} *</label>
              <select
                value={accountFormData.type}
                onChange={(e) => {
                  const type = e.target.value as AccountType;
                  const typeMeta = accountTypes.find(t => t.value === type);
                  const isCreditCard = type === 'credit-card';
                  setAccountFormData({
                    ...accountFormData,
                    type,
                    isAsset: typeMeta?.isAsset ?? accountFormData.isAsset,
                    statementDay: isCreditCard ? (accountFormData.statementDay ?? 1) : undefined,
                    dueDay: isCreditCard ? (accountFormData.dueDay ?? 15) : undefined,
                    commodityName: type === 'commodities' ? (accountFormData.commodityName ?? 'Gold') : accountFormData.commodityName,
                    commodityValuationMode: type === 'commodities' ? (accountFormData.commodityValuationMode ?? 'manual') : accountFormData.commodityValuationMode,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {accountTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {t(type.label, language)}
                  </option>
                ))}
              </select>
            </div>
            {accountFormData.type === 'credit-card' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Statement Day', language)} *</label>
                  <input
                    type="number"
                    value={accountFormData.statementDay ?? ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, statementDay: parseInt(e.target.value, 10) || 0 })}
                    min={1}
                    max={31}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Due Day', language)} *</label>
                  <input
                    type="number"
                    value={accountFormData.dueDay ?? ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, dueDay: parseInt(e.target.value, 10) || 0 })}
                    min={1}
                    max={31}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Opening Balance', language)}</label>
              <input
                type="number"
                value={accountFormData.openingBalance ?? ''}
                onChange={(e) => setAccountFormData({ ...accountFormData, openingBalance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Current Balance', language)}</label>
              <input
                type="number"
                value={
                  accountFormData.type === 'pension'
                    ? pensionTotal
                    : (accountFormData.type === 'commodities' && accountFormData.commodityValuationMode === 'auto')
                      ? commodityPreviewValue
                      : (accountFormData.currentBalance ?? '')
                }
                onChange={(e) => setAccountFormData({ ...accountFormData, currentBalance: parseFloat(e.target.value) || 0 })}
                disabled={accountFormData.type === 'pension' || (accountFormData.type === 'commodities' && accountFormData.commodityValuationMode === 'auto')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            {accountFormData.type === 'pension' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fund Value', language)}</label>
                  <input
                    type="number"
                    value={accountFormData.pensionFundValue ?? ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, pensionFundValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Government Contribution', language)}</label>
                  <input
                    type="number"
                    value={accountFormData.governmentContribution ?? ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, governmentContribution: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </>
            )}
            {accountFormData.type === 'commodities' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Commodity', language)}</label>
                  <input
                    type="text"
                    value={accountFormData.commodityName || ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, commodityName: e.target.value })}
                    placeholder="Gold"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Units', language)}</label>
                  <input
                    type="number"
                    value={accountFormData.commodityUnits ?? ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, commodityUnits: parseFloat(e.target.value) || 0 })}
                    step="0.0001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Mode', language)}</label>
                  <select
                    value={accountFormData.commodityValuationMode ?? 'manual'}
                    onChange={(e) => setAccountFormData({ ...accountFormData, commodityValuationMode: e.target.value as 'manual' | 'auto' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="manual">{t('Manual', language)}</option>
                    <option value="auto">{t('Auto Fetch', language)}</option>
                  </select>
                </div>
                <div className="md:col-span-2 text-xs text-gray-500">
                  {t('Current Price', language)}: {formatCurrency(getCommodityMarketPrice({
                    ...accountFormData,
                    name: accountFormData.name || '',
                    commodityName: accountFormData.commodityName ?? '',
                    commodityUnits: accountFormData.commodityUnits ?? 0,
                    commodityValuationMode: accountFormData.commodityValuationMode ?? 'manual',
                  } as Account), state.settings.currency, locale)}
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account Currency', language)}</label>
              <input
                type="text"
                value={accountFormData.currency || state.settings.currency}
                onChange={(e) => setAccountFormData({ ...accountFormData, currency: e.target.value })}
                placeholder="TRY"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                id="account-foreign"
                type="checkbox"
                checked={accountFormData.isForeignCurrency ?? false}
                onChange={(e) => setAccountFormData({ ...accountFormData, isForeignCurrency: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="account-foreign" className="text-sm text-gray-700">{t('Foreign Currency', language)}</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Exchange Rate', language)}</label>
              <input
                type="number"
                value={accountFormData.exchangeRate ?? ''}
                onChange={(e) => setAccountFormData({ ...accountFormData, exchangeRate: parseFloat(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Institution', language)}</label>
              <input
                type="text"
                value={accountFormData.institution || ''}
                onChange={(e) => setAccountFormData({ ...accountFormData, institution: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Owner', language)}</label>
              <input
                type="text"
                value={accountFormData.owner || ''}
                onChange={(e) => setAccountFormData({ ...accountFormData, owner: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Notes', language)}</label>
              <textarea
                value={accountFormData.notes || ''}
                onChange={(e) => setAccountFormData({ ...accountFormData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setIsAccountModalOpen(false);
                resetAccountForm();
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('Cancel', language)}
            </button>
            <button
              onClick={handleSubmitAccount}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              {editingAccountId ? t('Update Account', language) : t('Add Account', language)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



