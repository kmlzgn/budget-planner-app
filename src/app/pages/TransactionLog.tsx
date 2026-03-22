import { useEffect, useRef, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Plus, Trash2, Edit2, Check, Filter, Download, Upload, X, Repeat } from 'lucide-react';
import { Deposit, FundTransaction, Transaction } from '../types';
import { generateId } from '../utils/id';
import { format, subDays, subMonths, subYears, startOfYear, endOfYear } from 'date-fns';
import { formatDateDisplay, t } from '../utils/i18n';
import { formatCurrency } from '../utils/formatting';
import { getRandomCategoryColor } from '../utils/categoryColors';
import { calculateFundHoldings } from '../utils/fundCalculations';
import { deriveDepositFields, getDepositStatus } from '../utils/wealthCalculations';
import { buildFundExportRows, fundExportHeaders } from '../utils/fundExports';
import * as XLSX from 'xlsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { BreadcrumbInline } from '../components/BreadcrumbInline';
import { UnitsInput } from '../components/inputs/NumberInput';
import { MoneyField } from '../components/inputs/MoneyField';
import { RateField } from '../components/inputs/RateField';
import { SmartDateInput } from '../components/inputs/SmartDateInput';
import { AppCard } from '../components/ui/app-card';
import { PrimaryButton, SecondaryButton } from '../components/ui/app-buttons';

type ImportRow = {
  date: string;
  categoryName: string;
  description: string;
  accountName?: string;
  spender?: string;
  amount: number;
  type: Transaction['type'];
};

type DepositImportRow = Deposit;

export function TransactionLog() {
  const {
    state,
    addTransaction,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    addFundTransaction,
    addFundTransactions,
    updateFundTransaction,
    deleteFundTransaction,
    addDeposit,
    addDeposits,
    updateDeposit,
    deleteDeposit,
    addCategory,
    addAccount,
    updateSettings,
  } = useBudget();
  const language = state.settings.language;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fundFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'funds' | 'deposits'>('transactions');
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowEditData, setRowEditData] = useState<Partial<Transaction> | null>(null);
  const [isFxManualOverride, setIsFxManualOverride] = useState(false);
  const [isRowFxManualOverride, setIsRowFxManualOverride] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [datePreset, setDatePreset] = useState<'custom' | 'last7' | 'last15' | 'lastMonth' | 'lastYear' | 'thisYear'>('custom');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [transactionSort, setTransactionSort] = useState<{ key: 'date' | 'description' | 'category' | 'account' | 'owner' | 'amount'; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [duplicateImportRows, setDuplicateImportRows] = useState<Array<ImportRow & { key: string }>>([]);
  const [selectedDuplicateKeys, setSelectedDuplicateKeys] = useState<Set<string>>(new Set());
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importSummary, setImportSummary] = useState({
    total: 0,
    imported: 0,
    invalid: 0,
    duplicates: 0,
    skipped: 0,
    warnings: 0,
  });
  const [fundFormData, setFundFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'buy' as FundTransaction['type'],
    fund: '',
    accountId: '',
    spender: '',
    units: 0,
    price: 0,
  });
  const [fundFormError, setFundFormError] = useState('');
  const [fundSearchQuery, setFundSearchQuery] = useState('');
  const [fundFilterDateFrom, setFundFilterDateFrom] = useState('');
  const [fundFilterDateTo, setFundFilterDateTo] = useState('');
  const [fundDatePreset, setFundDatePreset] = useState<'custom' | 'last7' | 'last15' | 'lastMonth' | 'lastYear' | 'thisYear'>('custom');
  const [fundFilterAccountId, setFundFilterAccountId] = useState('all');
  const [fundFilterSpender, setFundFilterSpender] = useState('all');
  const [fundCurrentPage, setFundCurrentPage] = useState(1);
  const [fundPageSize, setFundPageSize] = useState(20);
  const [fundSort, setFundSort] = useState<{ key: 'date' | 'fund' | 'account' | 'owner' | 'units' | 'price' | 'amount'; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });
  const [fxRateCache, setFxRateCache] = useState<Record<string, number>>({});
  const [fundImportRows, setFundImportRows] = useState<FundTransaction[]>([]);
  const [fundImportErrors, setFundImportErrors] = useState<string[]>([]);
  const [isFundImportOpen, setIsFundImportOpen] = useState(false);
  const [fundImportSummary, setFundImportSummary] = useState({
    total: 0,
    imported: 0,
    invalid: 0,
    duplicates: 0,
    skipped: 0,
    warnings: 0,
  });
  const [fundDuplicateRows, setFundDuplicateRows] = useState<FundTransaction[]>([]);
  const [fundEditingId, setFundEditingId] = useState<string | null>(null);
  const [fundRowEditData, setFundRowEditData] = useState<Partial<FundTransaction> | null>(null);
  const [fundEditError, setFundEditError] = useState('');
  const depositFileInputRef = useRef<HTMLInputElement>(null);
  const [depositFormData, setDepositFormData] = useState<Partial<Deposit>>({
    owner: '',
    principal: 0,
    institution: '',
    termDays: 0,
    grossRate: 0,
    withholdingTaxRate: 0,
    startDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [depositEditingId, setDepositEditingId] = useState<string | null>(null);
  const [depositSearchQuery, setDepositSearchQuery] = useState('');
  const [depositStatusFilter, setDepositStatusFilter] = useState<'all' | 'active' | 'matured' | 'due-soon'>('active');
  const [depositSort, setDepositSort] = useState<{ key: 'startDate' | 'owner' | 'institution' | 'principal' | 'maturityDate' | 'status'; direction: 'asc' | 'desc' }>({
    key: 'startDate',
    direction: 'desc',
  });
  const [depositImportRows, setDepositImportRows] = useState<Deposit[]>([]);
  const [depositImportErrors, setDepositImportErrors] = useState<string[]>([]);
  const [isDepositImportOpen, setIsDepositImportOpen] = useState(false);
  const [depositImportSummary, setDepositImportSummary] = useState({
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    skipped: 0,
  });
  const [formData, setFormData] = useState<Partial<Transaction>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    categoryId: '',
    description: '',
    type: 'expense',
    fxRateToBase: 1,
  });

  useEffect(() => {
    const accountId = formData.accountId;
    const date = formData.date;
    if (!accountId || !date) return;
    const currency = getAccountCurrency(accountId);
    if (!isAutoFxCurrency(currency)) return;
    if (isFxManualOverride) return;
    fetchFxRateForDate(currency, date)
      .then(rate => {
        setFxRateCache(prev => ({ ...prev, [getFxCacheKey(currency, date)]: rate }));
        setFormData(prev => {
          if (prev.accountId !== accountId || prev.date !== date) return prev;
          if (prev.fxRateToBase === rate) return prev;
          return { ...prev, fxRateToBase: rate };
        });
      })
      .catch(() => undefined);
  }, [formData.accountId, formData.date, state.marketData.fxRates, isFxManualOverride]);

  useEffect(() => {
    const accountId = rowEditData?.accountId;
    const date = rowEditData?.date;
    if (!accountId || !date) return;
    const currency = getAccountCurrency(accountId);
    if (!isAutoFxCurrency(currency)) return;
    if (isRowFxManualOverride) return;
    fetchFxRateForDate(currency, date)
      .then(rate => {
        setFxRateCache(prev => ({ ...prev, [getFxCacheKey(currency, date)]: rate }));
        setRowEditData(prev => {
          if (!prev || prev.accountId !== accountId || prev.date !== date) return prev;
          if (prev.fxRateToBase === rate) return prev;
          return { ...prev, fxRateToBase: rate };
        });
      })
      .catch(() => undefined);
  }, [rowEditData?.accountId, rowEditData?.date, state.marketData.fxRates, isRowFxManualOverride]);

  useEffect(() => {
    const accountId = fundFormData.accountId;
    const date = fundFormData.date;
    if (!accountId || !date) return;
    const currency = getAccountCurrency(accountId);
    if (!isAutoFxCurrency(currency)) return;
    fetchFxRateForDate(currency, date)
      .then(rate => {
        setFxRateCache(prev => ({ ...prev, [getFxCacheKey(currency, date)]: rate }));
      })
      .catch(() => undefined);
  }, [fundFormData.accountId, fundFormData.date, state.marketData.fxRates]);

  const handleSubmit = () => {
    if (formData.date && formData.amount && formData.categoryId && formData.description) {
      const accountCurrency = getAccountCurrency(formData.accountId);
      const accountAmount = Math.abs(Number(formData.amount) || 0);
      const fxRateToBase = accountCurrency === baseCurrency
        ? 1
        : (Number.isFinite(formData.fxRateToBase) ? (formData.fxRateToBase as number) : getAccountFxRate(formData.accountId, formData.date));
      const baseAmountValue = accountCurrency === baseCurrency ? accountAmount : accountAmount * fxRateToBase;
      addTransaction({
        ...formData,
        id: generateId(),
        amount: baseAmountValue,
        baseAmount: baseAmountValue,
        accountAmount,
        accountCurrency,
        fxRateToBase,
      } as Transaction);
      resetForm();
    }
  };

  const resetForm = () => {
    setIsFxManualOverride(false);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      categoryId: '',
      description: '',
      type: 'expense',
      fxRateToBase: 1,
    });
  };

  const repeatTransaction = (transaction: Transaction) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const accountAmount = Number.isFinite(transaction.accountAmount)
      ? (transaction.accountAmount as number)
      : transaction.amount;
    setIsFxManualOverride(false);
    setEditingId(null);
    setRowEditData(null);
    setFormData({
      date: today,
      amount: Math.abs(accountAmount),
      categoryId: transaction.categoryId,
      description: transaction.description,
      type: transaction.type,
      accountId: transaction.accountId,
      spender: transaction.spender,
      fxRateToBase: transaction.fxRateToBase ?? getAccountFxRate(transaction.accountId, today),
    });
    setTransactionFormOpen(true);
    setActiveTab('transactions');
  };


  const startEdit = (transaction: Transaction) => {
    setIsRowFxManualOverride(false);
    setEditingId(transaction.id);
    setRowEditData({ ...transaction });
  };

  const cancelRowEdit = () => {
    setIsRowFxManualOverride(false);
    setEditingId(null);
    setRowEditData(null);
  };

  const saveRowEdit = () => {
    if (!editingId || !rowEditData) return;
    if (
      rowEditData.date &&
      (rowEditData.accountAmount ?? rowEditData.amount) &&
      rowEditData.categoryId &&
      rowEditData.description &&
      rowEditData.type
    ) {
      const accountCurrency = getAccountCurrency(rowEditData.accountId);
      const accountAmount = Math.abs(Number(rowEditData.accountAmount ?? rowEditData.amount) || 0);
      const fxRateToBase = accountCurrency === baseCurrency
        ? 1
        : (Number.isFinite(rowEditData.fxRateToBase) ? (rowEditData.fxRateToBase as number) : getAccountFxRate(rowEditData.accountId, rowEditData.date));
      const baseAmountValue = accountCurrency === baseCurrency ? accountAmount : accountAmount * fxRateToBase;
      updateTransaction(editingId, {
        ...rowEditData,
        amount: baseAmountValue,
        baseAmount: baseAmountValue,
        accountAmount,
        accountCurrency,
        fxRateToBase,
      });
      cancelRowEdit();
    }
  };

  const getCategoryName = (categoryId: string) => {
    return state.categories.find(c => c.id === categoryId)?.name || t('Unknown', language);
  };

  const getCategoryColor = (categoryId: string) => {
    return state.categories.find(c => c.id === categoryId)?.color || '#6b7280';
  };

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return t('No account', language);
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return t('Unknown', language);
    const institution = account.institution?.trim();
    const currencyTag = account.currency ? ` (${account.currency})` : '';
    return institution ? `${institution} • ${account.name}${currencyTag}` : `${account.name}${currencyTag}`;
  };

  const getAccountMatchKey = (accountId?: string) => {
    if (!accountId) return 'none';
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return 'unknown';
    const institution = account.institution?.trim();
    return normalizeLookup(institution ? `${institution} • ${account.name}` : account.name);
  };

  const baseCurrency = state.settings.currency;
  const getFxCacheKey = (currency: string, date: string) => `${currency}|${date}`;
  const getFxRateEntry = (currency: string) => {
    const normalizePair = (pair: string) => pair.replace(/\s+/g, '').toUpperCase();
    const directPair = normalizePair(`${currency}/${baseCurrency}`);
    const inversePair = normalizePair(`${baseCurrency}/${currency}`);
    const direct = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === directPair);
    if (direct) return direct;
    const inverse = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === inversePair);
    if (inverse) return { ...inverse, rate: inverse.rate ? 1 / inverse.rate : inverse.rate };
    return undefined;
  };
  const isAutoFxCurrency = (currency: string) => {
    if (!currency || currency === baseCurrency) return false;
    return getFxRateEntry(currency)?.mode === 'auto';
  };
  const fetchFxRateForDate = async (currency: string, date: string) => {
    const normalizedCurrency = currency.toUpperCase();
    if (!normalizedCurrency || normalizedCurrency === baseCurrency) return 1;
    try {
      const url = `https://api.frankfurter.dev/v1/${date}?base=${encodeURIComponent(normalizedCurrency)}&symbols=${encodeURIComponent(baseCurrency)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('fx_fetch_failed');
      const data = (await response.json()) as { rates?: Record<string, number> };
      const rate = data?.rates?.[baseCurrency];
      if (Number.isFinite(rate)) return rate as number;
    } catch {
      // fall through
    }
    return getMarketFxRate(normalizedCurrency);
  };
  const getAccountCurrency = (accountId?: string) => {
    const account = state.accounts.find(a => a.id === accountId);
    return account?.currency ?? baseCurrency;
  };
  const getMarketFxRate = (currency: string) => {
    if (!currency || currency === baseCurrency) return 1;
    const normalizePair = (pair: string) => pair.replace(/\s+/g, '').toUpperCase();
    const directPair = normalizePair(`${currency}/${baseCurrency}`);
    const inversePair = normalizePair(`${baseCurrency}/${currency}`);
    const direct = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === directPair)?.rate;
    if (Number.isFinite(direct) && (direct as number) > 0) return direct as number;
    const inverse = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === inversePair)?.rate;
    if (Number.isFinite(inverse) && (inverse as number) > 0) return 1 / (inverse as number);
    return 1;
  };
  const getAccountFxRate = (accountId?: string, date?: string) => {
    const account = state.accounts.find(a => a.id === accountId);
    const currency = account?.currency ?? baseCurrency;
    if (currency === baseCurrency) return 1;
    const exchangeRate = account?.exchangeRate;
    if (Number.isFinite(exchangeRate) && (exchangeRate as number) > 0) return exchangeRate as number;
    if (date) {
      const cached = fxRateCache[getFxCacheKey(currency, date)];
      if (Number.isFinite(cached) && (cached as number) > 0) return cached as number;
    }
    return getMarketFxRate(currency);
  };
  const formatLocalAmount = (value: number, currency: string) =>
    `${currency} ${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

  const getAccountName = (accountId?: string) => getAccountLabel(accountId);
  const ownerOptions = state.settings.owners && state.settings.owners.length > 0
    ? state.settings.owners
    : state.settings.familyMembers;
  const usedCategoryIds = new Set(state.transactions.map(t => t.categoryId));
  const availableFilterCategories = state.categories.filter(cat => usedCategoryIds.has(cat.id));

  const formatUnits = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    const intValue = Math.trunc(value);
    return intValue.toLocaleString(locale, { maximumFractionDigits: 0 });
  };

  const computeBaseAmount = (accountId?: string, accountAmount?: number, fxRate?: number, date?: string) => {
    const currency = getAccountCurrency(accountId);
    const amountValue = Math.abs(Number(accountAmount) || 0);
    const rate = currency === baseCurrency
      ? 1
      : (Number.isFinite(fxRate) ? (fxRate as number) : getAccountFxRate(accountId, date));
    const baseAmountValue = currency === baseCurrency ? amountValue : amountValue * rate;
    return {
      currency,
      accountAmount: amountValue,
      fxRateToBase: rate,
      baseAmount: baseAmountValue,
      isForeign: currency !== baseCurrency,
    };
  };

  function normalizeSearchValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return format(value, 'yyyy-MM-dd');
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value.toLowerCase();
    return String(value).toLowerCase();
  }

  function buildSearchText(values: unknown[]) {
    return values.map(normalizeSearchValue).join(' ').toLowerCase();
  }

  const getNetUnitsForHolding = (fund: string, accountId?: string, excludeId?: string) => {
    const accountKey = accountId ?? '';
    const targetFund = fund.trim().toLowerCase();
    return state.fundTransactions.reduce((sum, tx) => {
      if (excludeId && tx.id === excludeId) return sum;
      const txFund = (tx.fund || '').trim().toLowerCase();
      const txAccount = tx.accountId ?? '';
      if (txFund !== targetFund || txAccount !== accountKey) return sum;
      const units = Number.isFinite(tx.units) ? tx.units : 0;
      return sum + units;
    }, 0);
  };

  const getOrCreateFundCategory = (type: FundTransaction['type']) => {
    const isBuy = type === 'buy';
    const name = isBuy ? 'Fund Purchase' : 'Fund Sale';
    const categoryType = isBuy ? 'expense' : 'income';
    let category = state.categories.find(c => c.name === name && c.type === categoryType);
    if (!category) {
      category = {
        id: generateId(),
        name,
        type: categoryType,
        classification: isBuy ? 'savings' : 'none',
        color: getRandomCategoryColor(categoryType),
      };
      addCategory(category);
    }
    return category.id;
  };

  const toggleSort = <T extends string>(current: { key: T; direction: 'asc' | 'desc' }, key: T) => {
    if (current.key === key) {
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    }
    return { key, direction: 'asc' };
  };

  const sortIndicator = <T extends string>(current: { key: T; direction: 'asc' | 'desc' }, key: T) => {
    if (current.key !== key) return '';
    return current.direction === 'asc' ? '▲' : '▼';
  };

  const compareValues = (a: string | number, b: string | number) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
  };

  const handleFundSubmit = () => {
    if (!fundFormData.date || !fundFormData.fund || !fundFormData.units || !fundFormData.price) return;
    setFundFormError('');
    const units = Math.trunc(Number(fundFormData.units));
    if (!Number.isFinite(units) || units === 0) return;
    const signedUnits = fundFormData.type === 'buy'
      ? Math.abs(units)
      : -Math.abs(units);
    const amount = signedUnits * fundFormData.price;
    if (signedUnits < 0) {
      const availableUnits = getNetUnitsForHolding(fundFormData.fund, fundFormData.accountId || undefined);
      if (Math.abs(signedUnits) > availableUnits + 1e-6) {
        setFundFormError(t('Cannot sell more units than currently owned.', language));
        return;
      }
    }
    const grossAmount = Math.abs(amount);
    const cashTransactionId = generateId();
    const cashType = signedUnits > 0 ? 'expense' : 'income';
    const categoryId = getOrCreateFundCategory(fundFormData.type);
    const cashFx = computeBaseAmount(
      fundFormData.accountId || undefined,
      grossAmount,
      getAccountFxRate(fundFormData.accountId || undefined, fundFormData.date),
      fundFormData.date
    );
    addTransaction({
      id: cashTransactionId,
      date: fundFormData.date,
      amount: cashFx.baseAmount,
      baseAmount: cashFx.baseAmount,
      accountAmount: cashFx.accountAmount,
      accountCurrency: cashFx.currency,
      fxRateToBase: cashFx.fxRateToBase,
      categoryId,
      accountId: fundFormData.accountId || undefined,
      description: `${fundFormData.fund} ${signedUnits > 0 ? 'buy' : 'sell'}`,
      type: cashType,
      spender: fundFormData.spender || undefined,
    });
    addFundTransaction({
      id: generateId(),
      assetClass: 'fund',
      date: fundFormData.date,
      fund: fundFormData.fund.trim(),
      accountId: fundFormData.accountId || undefined,
      spender: fundFormData.spender || undefined,
      units: signedUnits,
      price: fundFormData.price,
      amount,
      type: signedUnits > 0 ? 'buy' : 'sell',
      cashTransactionId,
    });
    setFundFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      type: 'buy',
      fund: '',
      accountId: '',
      spender: '',
      units: 0,
      price: 0,
    });
  };

  const resetDepositForm = () => {
    setDepositFormData({
      owner: '',
      principal: 0,
      institution: '',
      termDays: 0,
      grossRate: 0,
      withholdingTaxRate: 0,
      startDate: format(new Date(), 'yyyy-MM-dd'),
    });
    setDepositEditingId(null);
  };

  const startEditDeposit = (deposit: Deposit) => {
    setDepositFormData({
      owner: deposit.owner || '',
      principal: deposit.principal,
      institution: deposit.institution || '',
      termDays: deposit.termDays,
      grossRate: deposit.grossRate,
      withholdingTaxRate: deposit.withholdingTaxRate,
      startDate: deposit.startDate,
    });
    setDepositEditingId(deposit.id);
  };

  const handleDepositSubmit = () => {
    if (!depositFormData.startDate || !depositFormData.principal || !depositFormData.termDays) return;
    const payload = deriveDepositFields({
      id: depositEditingId ?? generateId(),
      owner: depositFormData.owner?.trim() || '',
      institution: depositFormData.institution?.trim() || '',
      principal: depositFormData.principal || 0,
      termDays: depositFormData.termDays || 0,
      grossRate: depositFormData.grossRate || 0,
      withholdingTaxRate: depositFormData.withholdingTaxRate || 0,
      startDate: depositFormData.startDate || '',
      source: 'manual',
    });

    if (depositEditingId) {
      updateDeposit(depositEditingId, payload);
    } else {
      addDeposit(payload);
    }
    resetDepositForm();
  };

  const startFundEdit = (transaction: FundTransaction) => {
    setFundEditingId(transaction.id);
    setFundRowEditData({ ...transaction });
  };

  const cancelFundEdit = () => {
    setFundEditingId(null);
    setFundRowEditData(null);
  };

  const saveFundEdit = () => {
    if (!fundEditingId || !fundRowEditData) return;
    if (!fundRowEditData.date || !fundRowEditData.fund || !fundRowEditData.units || !fundRowEditData.price) return;
    setFundEditError('');
    const units = Math.trunc(Number(fundRowEditData.units));
    if (!Number.isFinite(units) || units === 0) return;
    const amount = units * fundRowEditData.price;
    const type = units > 0 ? 'buy' : 'sell';
    if (units < 0) {
      const availableUnits = getNetUnitsForHolding(fundRowEditData.fund, fundRowEditData.accountId || undefined, fundEditingId);
      if (Math.abs(units) > availableUnits + 1e-6) {
        setFundEditError(t('Cannot sell more units than currently owned.', language));
        return;
      }
    }
    updateFundTransaction(fundEditingId, {
      date: fundRowEditData.date,
      fund: fundRowEditData.fund.trim(),
      accountId: fundRowEditData.accountId || undefined,
      spender: fundRowEditData.spender || undefined,
      units,
      price: fundRowEditData.price,
      amount,
      type,
      assetClass: 'fund',
    });

    if (fundRowEditData.cashTransactionId) {
      const grossAmount = Math.abs(amount);
      const cashType = units > 0 ? 'expense' : 'income';
      const categoryId = getOrCreateFundCategory(type);
      const cashFx = computeBaseAmount(
        fundRowEditData.accountId || undefined,
        grossAmount,
        getAccountFxRate(fundRowEditData.accountId || undefined, fundRowEditData.date),
        fundRowEditData.date
      );
      updateTransaction(fundRowEditData.cashTransactionId, {
        date: fundRowEditData.date,
        amount: cashFx.baseAmount,
        baseAmount: cashFx.baseAmount,
        accountAmount: cashFx.accountAmount,
        accountCurrency: cashFx.currency,
        fxRateToBase: cashFx.fxRateToBase,
        categoryId,
        accountId: fundRowEditData.accountId || undefined,
        description: `${fundRowEditData.fund.trim()} ${units > 0 ? 'buy' : 'sell'}`,
        type: cashType,
        spender: fundRowEditData.spender || undefined,
      });
    }

    cancelFundEdit();
  };

  const applyFundDatePreset = (preset: typeof fundDatePreset) => {
    const today = new Date();
    if (preset === 'custom') {
      setFundFilterDateFrom('');
      setFundFilterDateTo('');
      return;
    }
    if (preset === 'last7') {
      setFundFilterDateFrom(format(subDays(today, 7), 'yyyy-MM-dd'));
      setFundFilterDateTo(format(today, 'yyyy-MM-dd'));
      return;
    }
    if (preset === 'last15') {
      setFundFilterDateFrom(format(subDays(today, 15), 'yyyy-MM-dd'));
      setFundFilterDateTo(format(today, 'yyyy-MM-dd'));
      return;
    }
    if (preset === 'lastMonth') {
      setFundFilterDateFrom(format(subMonths(today, 1), 'yyyy-MM-dd'));
      setFundFilterDateTo(format(today, 'yyyy-MM-dd'));
      return;
    }
    if (preset === 'lastYear') {
      setFundFilterDateFrom(format(subYears(today, 1), 'yyyy-MM-dd'));
      setFundFilterDateTo(format(today, 'yyyy-MM-dd'));
      return;
    }
    if (preset === 'thisYear') {
      setFundFilterDateFrom(format(startOfYear(today), 'yyyy-MM-dd'));
      setFundFilterDateTo(format(endOfYear(today), 'yyyy-MM-dd'));
    }
  };

  // Filter transactions
  let filteredTransactions = [...state.transactions];

  if (filterType !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.type === filterType);
  }

  if (filterCategory !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.categoryId === filterCategory);
  }

  if (filterAccountId !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.accountId === filterAccountId);
  }

  if (filterOwner !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => (t.spender || '') === filterOwner);
  }

  if (filterDateFrom) {
    filteredTransactions = filteredTransactions.filter(t => t.date >= filterDateFrom);
  }

  if (filterDateTo) {
    filteredTransactions = filteredTransactions.filter(t => t.date <= filterDateTo);
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  if (normalizedSearch) {
    filteredTransactions = filteredTransactions.filter(t => {
      const haystack = buildSearchText([
        t.description,
        getCategoryName(t.categoryId),
        getAccountName(t.accountId),
        t.spender,
        t.amount,
      ]);
      return haystack.includes(normalizedSearch);
    });
  }

  const getTransactionSortValue = (transaction: Transaction) => {
    switch (transactionSort.key) {
      case 'date':
        return transaction.date;
      case 'description':
        return transaction.description || '';
      case 'category':
        return getCategoryName(transaction.categoryId);
      case 'account':
        return getAccountLabel(transaction.accountId);
      case 'owner':
        return transaction.spender || '';
      case 'amount':
        return transaction.baseAmount ?? transaction.amount;
      default:
        return transaction.date;
    }
  };

  filteredTransactions = filteredTransactions.sort((a, b) => {
    const result = compareValues(getTransactionSortValue(a), getTransactionSortValue(b));
    return transactionSort.direction === 'asc' ? result : -result;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPageSafe - 1) * pageSize,
    currentPageSafe * pageSize
  );

  const filteredIncome = filteredTransactions
    .filter(t => t.type === 'income' && t.transactionKind !== 'credit-card-payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredExpenses = filteredTransactions
    .filter(t => t.type === 'expense' && t.transactionKind !== 'credit-card-payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredNet = filteredIncome - filteredExpenses;

  let filteredFundTransactions = [...state.fundTransactions];

  if (fundFilterDateFrom) {
    filteredFundTransactions = filteredFundTransactions.filter(t => t.date >= fundFilterDateFrom);
  }

  if (fundFilterDateTo) {
    filteredFundTransactions = filteredFundTransactions.filter(t => t.date <= fundFilterDateTo);
  }

  if (fundFilterAccountId !== 'all') {
    filteredFundTransactions = filteredFundTransactions.filter(t => t.accountId === fundFilterAccountId);
  }

  if (fundFilterSpender !== 'all') {
    filteredFundTransactions = filteredFundTransactions.filter(t => t.spender === fundFilterSpender);
  }

  const normalizedFundSearch = fundSearchQuery.trim().toLowerCase();
  if (normalizedFundSearch) {
    filteredFundTransactions = filteredFundTransactions.filter(t => {
      const haystack = buildSearchText([
        t.fund,
        getAccountName(t.accountId),
        t.spender,
        t.amount,
        t.price,
      ]);
      return haystack.includes(normalizedFundSearch);
    });
  }

  const getFundSortValue = (transaction: FundTransaction) => {
    switch (fundSort.key) {
      case 'date':
        return transaction.date;
      case 'fund':
        return transaction.fund;
      case 'account':
        return getAccountLabel(transaction.accountId);
      case 'owner':
        return transaction.spender || '';
      case 'units':
        return transaction.units;
      case 'price':
        return transaction.price;
      case 'amount':
        return transaction.amount;
      default:
        return transaction.date;
    }
  };

  filteredFundTransactions = filteredFundTransactions.sort((a, b) => {
    const result = compareValues(getFundSortValue(a), getFundSortValue(b));
    return fundSort.direction === 'asc' ? result : -result;
  });

  const fundTotalPages = Math.max(1, Math.ceil(filteredFundTransactions.length / fundPageSize));
  const fundCurrentPageSafe = Math.min(fundCurrentPage, fundTotalPages);
  const paginatedFundTransactions = filteredFundTransactions.slice(
    (fundCurrentPageSafe - 1) * fundPageSize,
    fundCurrentPageSafe * fundPageSize
  );

  const filteredFundBuyTotal = filteredFundTransactions
    .filter(t => t.units > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const filteredFundSellTotal = filteredFundTransactions
    .filter(t => t.units < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const filteredFundNetCash = filteredFundSellTotal - filteredFundBuyTotal;

  const depositToday = new Date();
  let filteredDeposits = [...state.deposits];

  if (depositStatusFilter !== 'all') {
    filteredDeposits = filteredDeposits.filter(deposit => {
      const status = getDepositStatus(deposit, depositToday, 7);
      if (depositStatusFilter === 'active') return status !== 'matured';
      return status === depositStatusFilter;
    });
  }

  const normalizedDepositSearch = depositSearchQuery.trim().toLowerCase();
  if (normalizedDepositSearch) {
    filteredDeposits = filteredDeposits.filter(deposit => {
      const status = getDepositStatus(deposit, depositToday, 7);
      const haystack = buildSearchText([
        deposit.owner,
        deposit.institution,
        deposit.principal,
        deposit.termDays,
        deposit.grossRate,
        deposit.startDate,
        deposit.maturityDate,
        status,
      ]);
      return haystack.includes(normalizedDepositSearch);
    });
  }

  const getDepositSortValue = (deposit: Deposit) => {
    const status = getDepositStatus(deposit, depositToday, 7);
    switch (depositSort.key) {
      case 'startDate':
        return deposit.startDate;
      case 'owner':
        return deposit.owner || '';
      case 'institution':
        return deposit.institution || '';
      case 'principal':
        return deposit.principal;
      case 'maturityDate':
        return deposit.maturityDate;
      case 'status':
        return status;
      default:
        return deposit.startDate;
    }
  };

  filteredDeposits = filteredDeposits.sort((a, b) => {
    const result = compareValues(getDepositSortValue(a), getDepositSortValue(b));
    return depositSort.direction === 'asc' ? result : -result;
  });

  const filteredDepositPrincipalTotal = filteredDeposits.reduce((sum, d) => sum + d.principal, 0);
  const filteredDepositMaturityTotal = filteredDeposits.reduce((sum, d) => sum + d.maturityValue, 0);
  const filteredDepositNet = filteredDepositMaturityTotal - filteredDepositPrincipalTotal;

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Account', 'Owner'];
    const rows = state.transactions.map(t => [
      t.date,
      t.type,
      getCategoryName(t.categoryId),
      t.description,
      t.amount,
      getAccountName(t.accountId),
      t.spender || '',
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const exportFundsToCSV = () => {
    const rows = buildFundExportRows(filteredFundTransactions, getAccountLabel);
    const csv = [fundExportHeaders, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funds-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const exportFundsToXLSX = () => {
    const rows = buildFundExportRows(filteredFundTransactions, getAccountLabel);
    const worksheet = XLSX.utils.aoa_to_sheet([fundExportHeaders, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Funds');
    XLSX.writeFile(workbook, `funds-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportDepositsToCSV = () => {
    const headers = ['Owner', 'Institution', 'Principal', 'Term Days', 'Gross Rate %', 'Stopaj %', 'Start Date', 'Maturity Date', 'Net Interest', 'Maturity Value', 'Status'];
    const rows = filteredDeposits.map(d => [
      d.owner || '',
      d.institution || '',
      d.principal,
      d.termDays,
      d.grossRate,
      d.withholdingTaxRate,
      d.startDate,
      d.maturityDate,
      d.netInterest,
      d.maturityValue,
      getDepositStatus(d, depositToday, 7),
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deposits-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const exportDepositsToXLSX = () => {
    const headers = ['Owner', 'Institution', 'Principal', 'Term Days', 'Gross Rate %', 'Stopaj %', 'Start Date', 'Maturity Date', 'Net Interest', 'Maturity Value', 'Status'];
    const rows = filteredDeposits.map(d => [
      d.owner || '',
      d.institution || '',
      d.principal,
      d.termDays,
      d.grossRate,
      d.withholdingTaxRate,
      d.startDate,
      d.maturityDate,
      d.netInterest,
      d.maturityValue,
      getDepositStatus(d, depositToday, 7),
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Deposits');
    XLSX.writeFile(workbook, `deposits-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const applyDatePreset = (preset: typeof datePreset) => {
    const today = new Date();
    if (preset === 'custom') {
      setFilterDateFrom('');
      setFilterDateTo('');
      return;
    }
    if (preset === 'last7') {
      setFilterDateFrom(format(subDays(today, 7), 'yyyy-MM-dd'));
      setFilterDateTo(format(today, 'yyyy-MM-dd'));
      return;
    }
    if (preset === 'last15') {
      setFilterDateFrom(format(subDays(today, 15), 'yyyy-MM-dd'));
      setFilterDateTo(format(today, 'yyyy-MM-dd'));
      return;
    }
    if (preset === 'lastMonth') {
      setFilterDateFrom(format(subMonths(today, 1), 'yyyy-MM-dd'));
      setFilterDateTo(format(today, 'yyyy-MM-dd'));
      return;
    }
    if (preset === 'lastYear') {
      setFilterDateFrom(format(subYears(today, 1), 'yyyy-MM-dd'));
      setFilterDateTo(format(today, 'yyyy-MM-dd'));
      return;
    }
    if (preset === 'thisYear') {
      setFilterDateFrom(format(startOfYear(today), 'yyyy-MM-dd'));
      setFilterDateTo(format(endOfYear(today), 'yyyy-MM-dd'));
    }
  };

  const formFx = computeBaseAmount(formData.accountId, formData.amount, formData.fxRateToBase, formData.date);
  const rowEditFx = rowEditData
    ? computeBaseAmount(
        rowEditData.accountId,
        rowEditData.accountAmount ?? rowEditData.amount,
        rowEditData.fxRateToBase,
        rowEditData.date
      )
    : null;

  const normalizeHeader = (value: string) => value.toLowerCase().replace(/\s+/g, '').trim();
  const normalizeLookup = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

  const parseTransactionType = (value: unknown): Transaction['type'] | null => {
    const text = normalizeLookup(String(value ?? ''));
    if (!text) return null;
    if (['income', 'in', 'credit', 'gelir'].includes(text)) return 'income';
    if (['expense', 'out', 'debit', 'gider'].includes(text)) return 'expense';
    return null;
  };

  const formatLocalDate = (date: Date) =>
    format(new Date(date.getFullYear(), date.getMonth(), date.getDate()), 'yyyy-MM-dd');

  const normalizeImportedDate = (value: unknown): string | null => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return format(new Date(value.getFullYear(), value.getMonth(), value.getDate()), 'yyyy-MM-dd');
    }
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return format(new Date(parsed.y, parsed.m - 1, parsed.d), 'yyyy-MM-dd');
      }
    }
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(text)) return text.slice(0, 10);
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)) {
      const [day, month, year] = text.split('.').map(part => Number(part));
      if (!year || !month || !day) return null;
      return format(new Date(year, month - 1, day), 'yyyy-MM-dd');
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
      const [partA, partB, year] = text.split('/').map(part => Number(part));
      if (!year || !partA || !partB) return null;
      const isDayFirst = partA > 12 || partB <= 12;
      const day = isDayFirst ? partA : partB;
      const month = isDayFirst ? partB : partA;
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      return format(new Date(year, month - 1, day), 'yyyy-MM-dd');
    }
    return null;
  };

  const parseDateValue = (value: unknown) => normalizeImportedDate(value);

  const parseDateOnly = (value: unknown) => normalizeImportedDate(value);

  const toLocalDate = (value: string) => {
    const normalized = parseDateOnly(value);
    if (!normalized) return new Date();
    const [year, month, day] = normalized.split('-').map(part => Number(part));
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
  };

  const parseImportedAmount = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value ?? '').trim();
    if (!text) return null;
    const isParenNegative = text.startsWith('(') && text.endsWith(')');
    let cleaned = text.replace(/[^\d,.\-]/g, '');
    if (!cleaned) return null;
    const isNegative = cleaned.startsWith('-') || isParenNegative;
    cleaned = cleaned.replace(/-/g, '');

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    let normalized = cleaned;

    if (lastComma !== -1 && lastDot !== -1) {
      const decimalSeparator = lastComma > lastDot ? ',' : '.';
      const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
      normalized = cleaned.split(thousandsSeparator).join('');
      if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
    } else if (lastComma !== -1) {
      const parts = cleaned.split(',');
      if (parts.length > 2) {
        normalized = parts.join('');
      } else if (parts.length === 2) {
        normalized = `${parts[0]}.${parts[1]}`;
      }
    } else if (lastDot !== -1) {
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        normalized = parts.join('');
      } else if (parts.length === 2) {
        const [intPart, decPart] = parts;
        if (decPart.length === 3 && intPart.length >= 1) {
          normalized = `${intPart}${decPart}`;
        } else {
          normalized = `${intPart}.${decPart}`;
        }
      }
    }

    const parsed = parseFloat(normalized);
    if (Number.isNaN(parsed)) return null;
    return isNegative ? -Math.abs(parsed) : parsed;
  };

  const parseTurkishNumber = (value: unknown) => parseImportedAmount(value);

  const parseTurkishPercent = (value: unknown) => {
    const parsed = parseTurkishNumber(value);
    if (parsed === null) return null;
    return parsed;
  };

  const parseAmountValue = (value: unknown) => parseImportedAmount(value);


  const handleExcelFile = async (file: File) => {
    const errors: string[] = [];
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', raw: true });

    const headerRow = rows[0] as unknown[] | undefined;
    if (!headerRow || headerRow.length === 0) {
      setImportRows([]);
      setDuplicateImportRows([]);
      setSelectedDuplicateKeys(new Set());
      setImportErrors([t('No header row found in the file.', language)]);
      setImportSummary({
        total: 0,
        imported: 0,
        invalid: 0,
        duplicates: 0,
        skipped: 0,
        warnings: 0,
      });
      setIsImportOpen(true);
      return;
    }

    const headerMap: Record<string, keyof ImportRow | 'amount'> = {
      date: 'date',
      type: 'type',
      transactiontype: 'type',
      direction: 'type',
      category: 'categoryName',
      description: 'description',
      decription: 'description',
      account: 'accountName',
      spender: 'spender',
      owner: 'spender',
      amount: 'amount',
    };

    const columnIndex: Partial<Record<keyof ImportRow | 'amount', number>> = {};
    headerRow.forEach((cell, index) => {
      const key = normalizeHeader(String(cell ?? ''));
      const mapped = headerMap[key];
      if (mapped && columnIndex[mapped] === undefined) {
        columnIndex[mapped] = index;
      }
    });

    const requiredColumns: Array<keyof ImportRow | 'amount'> = [
      'date',
      'categoryName',
      'description',
      'amount',
    ];

    const missing = requiredColumns.filter(col => columnIndex[col] === undefined);
    if (missing.length > 0) {
      setImportRows([]);
      setImportErrors([
        t('Missing required columns:', language) + ' ' + missing.join(', '),
      ]);
      setImportSummary({
        total: 0,
        imported: 0,
        invalid: 0,
        duplicates: 0,
        skipped: 0,
        warnings: 0,
      });
      setIsImportOpen(true);
      return;
    }

    const existingKeys = new Set(
      state.transactions.map(t => {
        const categoryName = normalizeLookup(getCategoryName(t.categoryId));
        const accountName = getAccountMatchKey(t.accountId);
        const spender = normalizeLookup(t.spender || 'none');
        return [
          t.date,
          t.type,
          categoryName,
          normalizeLookup(t.description),
          accountName,
          spender,
          t.amount.toFixed(2),
        ].join('|');
      })
    );

    const seenKeys = new Set<string>();
    let totalRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    const parsedRows: ImportRow[] = [];
    const duplicateRowsList: Array<ImportRow & { key: string }> = [];
    rows.slice(1).forEach((row, rowIndex) => {
      const values = row as unknown[];
      const hasData = values.some(value => String(value ?? '').trim() !== '');
      if (!hasData) return;
      totalRows += 1;

      const dateValue = parseDateValue(values[columnIndex.date!]);
      const categoryName = String(values[columnIndex.categoryName!] ?? '').trim();
      const description = String(values[columnIndex.description!] ?? '').trim();
      const amountValue = parseAmountValue(values[columnIndex.amount!]);
      const explicitType = columnIndex.type !== undefined
        ? parseTransactionType(values[columnIndex.type])
        : null;

      if (!dateValue || !categoryName || !description || amountValue === null) {
        errors.push(
          t('Row', language) +
            ` ${rowIndex + 2}: ` +
            t('Missing or invalid required fields.', language),
        );
        invalidRows += 1;
        return;
      }

      const accountName = columnIndex.accountName !== undefined
        ? String(values[columnIndex.accountName] ?? '').trim()
        : '';
      const spender = columnIndex.spender !== undefined
        ? String(values[columnIndex.spender] ?? '').trim()
        : '';
      const type = explicitType ?? (amountValue < 0 ? 'expense' : 'income');
      const key = [
        dateValue,
        type,
        normalizeLookup(categoryName),
        normalizeLookup(description),
        normalizeLookup(accountName || 'none'),
        normalizeLookup(spender || 'none'),
        Math.abs(amountValue).toFixed(2),
      ].join('|');

      const rowPayload: ImportRow = {
        date: dateValue,
        categoryName,
        description,
        accountName: accountName || undefined,
        spender: spender || undefined,
        amount: Math.abs(amountValue),
        type,
      };

      if (seenKeys.has(key) || existingKeys.has(key)) {
        duplicateRows += 1;
        duplicateRowsList.push({ ...rowPayload, key });
        return;
      }
      seenKeys.add(key);

      parsedRows.push(rowPayload);
    });

    setImportRows(parsedRows);
    setDuplicateImportRows(duplicateRowsList);
    setSelectedDuplicateKeys(new Set());
    setImportErrors(errors);
    setImportSummary({
      total: totalRows,
      imported: parsedRows.length,
      invalid: invalidRows,
      duplicates: duplicateRows,
      skipped: invalidRows + duplicateRows,
      warnings: errors.length,
    });
    setIsImportOpen(true);
  };

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await handleExcelFile(file);
  };

  const handleFundExcelFile = async (file: File) => {
    const errors: string[] = [];
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', raw: true });

    const headerRow = rows[0] as unknown[] | undefined;
    if (!headerRow || headerRow.length === 0) {
      setFundImportRows([]);
      setFundDuplicateRows([]);
      setFundImportErrors([t('No header row found in the file.', language)]);
      setFundImportSummary({ total: 0, imported: 0, invalid: 0, duplicates: 0, skipped: 0, warnings: 1 });
      setIsFundImportOpen(true);
      return;
    }

    const headerMap: Record<string, 'date' | 'fund' | 'account' | 'spender' | 'units' | 'price'> = {
      date: 'date',
      fund: 'fund',
      account: 'account',
      spender: 'spender',
      owner: 'spender',
      units: 'units',
      price: 'price',
    };

    const columnIndex: Partial<Record<'date' | 'fund' | 'account' | 'spender' | 'units' | 'price', number>> = {};
    headerRow.forEach((cell, index) => {
      const key = normalizeHeader(String(cell ?? ''));
      const mapped = headerMap[key];
      if (mapped && columnIndex[mapped] === undefined) {
        columnIndex[mapped] = index;
      }
    });

    const requiredColumns: Array<'date' | 'fund' | 'units' | 'price'> = ['date', 'fund', 'units', 'price'];
    const missing = requiredColumns.filter(col => columnIndex[col] === undefined);
    if (missing.length > 0) {
      setFundImportRows([]);
      setFundDuplicateRows([]);
      setFundImportErrors([
        t('Missing required columns:', language) + ' ' + missing.join(', '),
      ]);
      setFundImportSummary({ total: 0, imported: 0, invalid: 0, duplicates: 0, skipped: 0, warnings: 1 });
      setIsFundImportOpen(true);
      return;
    }

    const accountLookup = new Map<string, string>();
    state.accounts.forEach(acc => {
      const nameKey = normalizeLookup(acc.name);
      if (nameKey) accountLookup.set(nameKey, acc.id);
      const institutionKey = normalizeLookup(acc.institution || '');
      if (institutionKey) accountLookup.set(institutionKey, acc.id);
      if (institutionKey && nameKey) accountLookup.set(`${institutionKey} • ${nameKey}`, acc.id);
    });
    const resolveAccountId = (accountName: string) =>
      accountLookup.get(normalizeLookup(accountName)) ?? undefined;
    const existingKeys = new Set(
      state.fundTransactions.map(tx => {
        const accountKey = tx.accountId ?? 'none';
        const spender = normalizeLookup(tx.spender || 'none');
        const fundName = normalizeLookup(tx.fund);
        return [
          tx.date,
          fundName,
          accountKey,
          spender,
          Math.trunc(tx.units).toFixed(0),
          tx.price.toFixed(6),
        ].join('|');
      })
    );
    const holdingsMap = new Map(
      calculateFundHoldings(state.fundTransactions, state.fundHoldingsMeta).map(holding => [
        `${holding.accountId ?? 'none'}|${normalizeLookup(holding.fund)}`,
        holding.netUnits,
      ])
    );
    const seenKeys = new Set<string>();
    let totalRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    const parsedRows: FundTransaction[] = [];
    const duplicateRowsList: FundTransaction[] = [];
    const candidates: Array<{ rowIndex: number; key: string; payload: FundTransaction; holdingKey: string; units: number }> = [];

    rows.slice(1).forEach((row, rowIndex) => {
      const values = row as unknown[];
      const hasData = values.some(value => String(value ?? '').trim() !== '');
      if (!hasData) return;
      totalRows += 1;

      const dateValue = parseDateValue(values[columnIndex.date!]);
      const fundName = String(values[columnIndex.fund!] ?? '').trim();
      const unitsValue = parseAmountValue(values[columnIndex.units!]);
      const priceValue = parseAmountValue(values[columnIndex.price!]);

      if (!dateValue || !fundName || unitsValue === null || priceValue === null || priceValue === 0) {
        errors.push(
          t('Row', language) +
            ` ${rowIndex + 2}: ` +
            t('Missing or invalid required fields.', language),
        );
        invalidRows += 1;
        return;
      }

      const accountName = columnIndex.account !== undefined
        ? String(values[columnIndex.account] ?? '').trim()
        : '';
      const spender = columnIndex.spender !== undefined
        ? String(values[columnIndex.spender] ?? '').trim()
        : '';
      const units = Math.trunc(Number(unitsValue));
      if (!Number.isFinite(units) || units === 0) {
        errors.push(
          t('Row', language) +
            ` ${rowIndex + 2}: ` +
            t('Missing or invalid required fields.', language),
        );
        invalidRows += 1;
        return;
      }
      const price = Math.abs(priceValue);
      const amount = units * price;
      const type = units < 0 ? 'sell' : 'buy';
      const accountId = resolveAccountId(accountName);
      const key = [
        dateValue,
        normalizeLookup(fundName),
        accountId ?? 'none',
        normalizeLookup(spender || 'none'),
        units.toFixed(0),
        price.toFixed(6),
      ].join('|');
      if (seenKeys.has(key) || existingKeys.has(key)) {
        duplicateRows += 1;
        duplicateRowsList.push({
          id: generateId(),
          assetClass: 'fund',
          date: dateValue,
          fund: fundName,
          accountId,
          spender: spender || undefined,
          price,
          units,
          amount,
          type,
        });
        return;
      }
      seenKeys.add(key);

      const holdingKey = `${accountId ?? 'none'}|${normalizeLookup(fundName)}`;
      const payload = {
        id: generateId(),
        assetClass: 'fund',
        date: dateValue,
        fund: fundName,
        accountId,
        spender: spender || undefined,
        price,
        units,
        amount,
        type,
      };

      candidates.push({ rowIndex, key, payload, holdingKey, units });
    });

    const sortedCandidates = [...candidates].sort((a, b) =>
      a.payload.date === b.payload.date ? a.rowIndex - b.rowIndex : a.payload.date.localeCompare(b.payload.date)
    );
    const invalidKeys = new Set<string>();
    sortedCandidates.forEach(item => {
      const availableUnits = holdingsMap.get(item.holdingKey) ?? 0;
      if (item.units < 0 && Math.abs(item.units) > availableUnits + 1e-6) {
        errors.push(
          t('Row', language) +
            ` ${item.rowIndex + 2}: ` +
            t('Sell exceeds available units.', language),
        );
        invalidRows += 1;
        invalidKeys.add(item.key);
        return;
      }
      holdingsMap.set(item.holdingKey, availableUnits + item.units);
    });

    candidates
      .filter(item => !invalidKeys.has(item.key))
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .forEach(item => parsedRows.push(item.payload));

    setFundImportRows(parsedRows);
    setFundDuplicateRows(duplicateRowsList);
    setFundImportErrors(errors);
    setFundImportSummary({
      total: totalRows,
      imported: parsedRows.length,
      invalid: invalidRows,
      duplicates: duplicateRows,
      skipped: invalidRows + duplicateRows,
      warnings: errors.length,
    });
    setIsFundImportOpen(true);
  };

  const handleFundImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await handleFundExcelFile(file);
  };

  const handleDepositExcelFile = async (file: File) => {
    const errors: string[] = [];
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', raw: true });

    const headerRow = rows[0] as unknown[] | undefined;
    if (!headerRow || headerRow.length === 0) {
      setDepositImportRows([]);
      setDepositImportErrors([t('No header row found in the file.', language)]);
      setDepositImportSummary({ total: 0, valid: 0, invalid: 0, duplicates: 0, skipped: 0 });
      setIsDepositImportOpen(true);
      return;
    }

    const headerMap: Record<string, 'owner' | 'principal' | 'institution' | 'termDays' | 'grossRate' | 'withholdingTaxRate' | 'startDate'> = {
      'kişi': 'owner',
      'kisi': 'owner',
      'anapara': 'principal',
      'banka': 'institution',
      'vade': 'termDays',
      'vade%': 'grossRate',
      'stopaj': 'withholdingTaxRate',
      'vadebaşlangıç': 'startDate',
      'vadebaslangic': 'startDate',
    };

    const columnIndex: Partial<Record<'owner' | 'principal' | 'institution' | 'termDays' | 'grossRate' | 'withholdingTaxRate' | 'startDate', number>> = {};
    headerRow.forEach((cell, index) => {
      const key = normalizeHeader(String(cell ?? ''));
      const mapped = headerMap[key];
      if (mapped && columnIndex[mapped] === undefined) {
        columnIndex[mapped] = index;
      }
    });

    const requiredColumns: Array<'owner' | 'principal' | 'institution' | 'termDays' | 'grossRate' | 'withholdingTaxRate' | 'startDate'> = [
      'owner',
      'principal',
      'institution',
      'termDays',
      'grossRate',
      'withholdingTaxRate',
      'startDate',
    ];

    const missing = requiredColumns.filter(col => columnIndex[col] === undefined);
    if (missing.length > 0) {
      setDepositImportRows([]);
      setDepositImportErrors([t('Missing required columns:', language) + ' ' + missing.join(', ')]);
      setDepositImportSummary({ total: 0, valid: 0, invalid: 0, duplicates: 0, skipped: 0 });
      setIsDepositImportOpen(true);
      return;
    }

    const existingKeys = new Set(
      state.deposits.map(d => [
        (d.owner || '').toLowerCase(),
        (d.institution || '').toLowerCase(),
        d.principal.toFixed(2),
        d.termDays.toString(),
        d.grossRate.toFixed(4),
        d.withholdingTaxRate.toFixed(4),
        d.startDate,
      ].join('|'))
    );

    const seenKeys = new Set<string>();
    let totalRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    const parsedRows: DepositImportRow[] = [];

    rows.slice(1).forEach((row, rowIndex) => {
      const values = row as unknown[];
      const hasData = values.some(value => String(value ?? '').trim() !== '');
      if (!hasData) return;
      totalRows += 1;

      const owner = String(values[columnIndex.owner!] ?? '').trim();
      const institution = String(values[columnIndex.institution!] ?? '').trim();
      const principalValue = parseTurkishNumber(values[columnIndex.principal!]);
      const termDaysValue = parseTurkishNumber(values[columnIndex.termDays!]);
      const grossRateValue = parseTurkishPercent(values[columnIndex.grossRate!]);
      const withholdingValue = parseTurkishPercent(values[columnIndex.withholdingTaxRate!]);
      const startDateValue = parseDateOnly(values[columnIndex.startDate!]);

      const termDays = termDaysValue === null ? null : Math.round(termDaysValue);

      if (!owner || !institution || principalValue === null || !termDays || grossRateValue === null || withholdingValue === null || !startDateValue) {
        errors.push(
          t('Row', language) +
            ` ${rowIndex + 2}: ` +
            t('Missing or invalid required fields.', language),
        );
        invalidRows += 1;
        return;
      }

      const key = [
        owner.toLowerCase(),
        institution.toLowerCase(),
        principalValue.toFixed(2),
        termDays.toString(),
        grossRateValue.toFixed(4),
        withholdingValue.toFixed(4),
        startDateValue,
      ].join('|');
      if (seenKeys.has(key) || existingKeys.has(key)) {
        duplicateRows += 1;
        return;
      }
      seenKeys.add(key);

      parsedRows.push(
        deriveDepositFields({
          id: generateId(),
          owner,
          institution,
          principal: principalValue,
          termDays,
          grossRate: grossRateValue,
          withholdingTaxRate: withholdingValue,
          startDate: startDateValue,
          source: 'import',
        })
      );
    });

    setDepositImportRows(parsedRows);
    setDepositImportErrors(errors);
    setDepositImportSummary({
      total: totalRows,
      valid: parsedRows.length,
      invalid: invalidRows,
      duplicates: duplicateRows,
      skipped: invalidRows + duplicateRows,
    });
    setIsDepositImportOpen(true);
  };

  const handleDepositImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await handleDepositExcelFile(file);
  };

  const applyDepositImport = () => {
    if (depositImportRows.length === 0) {
      setIsDepositImportOpen(false);
      return;
    }
    addDeposits(depositImportRows);
    setDepositImportRows([]);
    setDepositImportErrors([]);
    setDepositImportSummary({ total: 0, valid: 0, invalid: 0, duplicates: 0, skipped: 0 });
    setIsDepositImportOpen(false);
  };

  const applyFundImport = () => {
    if (fundImportRows.length === 0) {
      setIsFundImportOpen(false);
      return;
    }
    const fundRows: FundTransaction[] = [];
    const cashTransactions: Transaction[] = [];

    fundImportRows.forEach(row => {
      const cashTransactionId = generateId();
      const cashType = row.units > 0 ? 'expense' : 'income';
      const categoryId = getOrCreateFundCategory(row.type);
      const cashFx = computeBaseAmount(
        row.accountId || undefined,
        Math.abs(row.amount),
        getAccountFxRate(row.accountId || undefined, row.date),
        row.date
      );
      cashTransactions.push({
        id: cashTransactionId,
        date: row.date,
        amount: cashFx.baseAmount,
        baseAmount: cashFx.baseAmount,
        accountAmount: cashFx.accountAmount,
        accountCurrency: cashFx.currency,
        fxRateToBase: cashFx.fxRateToBase,
        categoryId,
        accountId: row.accountId || undefined,
        description: `${row.fund} ${row.units > 0 ? 'buy' : 'sell'}`,
        type: cashType,
        spender: row.spender || undefined,
      });

      fundRows.push({
        ...row,
        cashTransactionId,
      });
    });

    addTransactions(cashTransactions);
    addFundTransactions(fundRows);
    setFundImportRows([]);
    setFundDuplicateRows([]);
    setFundImportErrors([]);
    setFundImportSummary({ total: 0, imported: 0, invalid: 0, duplicates: 0, skipped: 0, warnings: 0 });
    setIsFundImportOpen(false);
  };

  const applyImport = () => {
    const selectedDuplicates = duplicateImportRows.filter(row => selectedDuplicateKeys.has(row.key));
    const rowsToImport = [...importRows, ...selectedDuplicates];
    if (rowsToImport.length === 0) {
      setIsImportOpen(false);
      return;
    }

    const categoryByKey = new Map(
      state.categories.map(cat => [`${cat.type}:${normalizeLookup(cat.name)}`, cat]),
    );
    const categoryByName = new Map<string, typeof state.categories[number]>();
    state.categories.forEach(cat => {
      const key = normalizeLookup(cat.name);
      const existing = categoryByName.get(key);
      if (!existing || (existing.type === 'income' && cat.type === 'expense')) {
        categoryByName.set(key, cat);
      }
    });
    const accountByName = new Map(
      state.accounts.map(acc => [normalizeLookup(acc.name), acc]),
    );
    const familySet = new Set(state.settings.familyMembers.map(member => normalizeLookup(member)));

    const newFamilyMembers: string[] = [];
    const newTransactions: Transaction[] = [];

    rowsToImport.forEach(row => {
      const categoryKey = `${row.type}:${normalizeLookup(row.categoryName)}`;
      let category = categoryByKey.get(categoryKey);
      if (!category && row.type === 'income') {
        category = categoryByName.get(normalizeLookup(row.categoryName));
      }
      if (!category) {
        category = {
          id: generateId(),
          name: row.categoryName,
          type: row.type,
          classification: row.type === 'income' ? 'none' : 'wants',
          color: getRandomCategoryColor(row.type),
        };
        categoryByKey.set(categoryKey, category);
        addCategory(category);
      }

      let accountId: string | undefined;
      if (row.accountName) {
        const accountKey = normalizeLookup(row.accountName);
        let account = accountByName.get(accountKey);
        if (!account) {
          account = {
            id: generateId(),
            name: row.accountName,
            type: 'checking',
            openingBalance: 0,
            currentBalance: 0,
            isAsset: true,
            currency: state.settings.currency,
            isForeignCurrency: false,
            exchangeRate: 1,
            notes: '',
          };
          accountByName.set(accountKey, account);
          addAccount(account);
        }
        accountId = account.id;
      }

      if (row.spender && !familySet.has(normalizeLookup(row.spender))) {
        familySet.add(normalizeLookup(row.spender));
        newFamilyMembers.push(row.spender);
      }

      const accountCurrency = accountId ? getAccountCurrency(accountId) : baseCurrency;
      const fxRateToBase = accountCurrency === baseCurrency ? 1 : getAccountFxRate(accountId, row.date);
      const accountAmount = row.amount;
      const baseAmountValue = accountCurrency === baseCurrency ? accountAmount : accountAmount * fxRateToBase;

      newTransactions.push({
        id: generateId(),
        date: row.date,
        amount: baseAmountValue,
        baseAmount: baseAmountValue,
        accountAmount,
        accountCurrency,
        fxRateToBase,
        categoryId: category.id,
        accountId,
        description: row.description,
        type: row.type,
        spender: row.spender,
      });
    });

    if (newFamilyMembers.length > 0) {
      updateSettings({
        familyMembers: [...state.settings.familyMembers, ...newFamilyMembers],
      });
    }

    addTransactions(newTransactions);
    setImportRows([]);
    setDuplicateImportRows([]);
    setSelectedDuplicateKeys(new Set());
    setImportErrors([]);
    setImportSummary({
      total: 0,
      imported: 0,
      invalid: 0,
      duplicates: 0,
      skipped: 0,
      warnings: 0,
    });
    setIsImportOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('Transaction Log', language)}
            <BreadcrumbInline />
          </h1>
          <p className="text-gray-600">{t('Record all variable income and expenses', language)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'transactions' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          {t('Transactions', language)}
        </button>
        <button
          onClick={() => setActiveTab('funds')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'funds' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          {t('Funds', language)}
        </button>
        <button
          onClick={() => setActiveTab('deposits')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'deposits' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          {t('Deposits', language)}
        </button>
      </div>

      {activeTab === 'transactions' && (
        <AppCard>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">{t('Summary Totals', language)}</div>
            <div className="text-right text-xs text-gray-500">
              <div>{t('Based on current filters', language)}</div>
              <div className="text-gray-600">
                {t('Showing', language)} {filteredTransactions.length} {t('of', language)} {state.transactions.length} {t('items', language)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-6">
            <div>
              <div className="text-xs text-gray-600">{t('Total Income', language)}</div>
              <div className="text-lg font-semibold text-green-600">
                +{formatCurrency(filteredIncome, state.settings.currency, locale)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">{t('Total Expense', language)}</div>
              <div className="text-lg font-semibold text-red-600">
                -{formatCurrency(filteredExpenses, state.settings.currency, locale)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">{t('Net', language)}</div>
              <div className={`text-lg font-semibold ${filteredNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(filteredNet, state.settings.currency, locale)}
              </div>
            </div>
          </div>
        </AppCard>
      )}

      {activeTab === 'funds' && (
        <AppCard>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">{t('Summary Totals', language)}</div>
            <div className="text-right text-xs text-gray-500">
              <div>{t('Based on current filters', language)}</div>
              <div className="text-gray-600">
                {t('Showing', language)} {filteredFundTransactions.length} {t('of', language)} {state.fundTransactions.length} {t('items', language)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-6">
            <div>
              <div className="text-xs text-gray-600">{t('Total Income', language)}</div>
              <div className="text-lg font-semibold text-green-600">
                +{formatCurrency(filteredFundSellTotal, state.settings.currency, locale)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">{t('Total Expense', language)}</div>
              <div className="text-lg font-semibold text-red-600">
                -{formatCurrency(filteredFundBuyTotal, state.settings.currency, locale)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">{t('Net', language)}</div>
              <div className={`text-lg font-semibold ${filteredFundNetCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(filteredFundNetCash, state.settings.currency, locale)}
              </div>
            </div>
          </div>
        </AppCard>
      )}

      {activeTab === 'deposits' && (
        <AppCard>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">{t('Summary Totals', language)}</div>
            <div className="text-right text-xs text-gray-500">
              <div>{t('Based on current filters', language)}</div>
              <div className="text-gray-600">
                {t('Showing', language)} {filteredDeposits.length} {t('of', language)} {state.deposits.length} {t('items', language)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-6">
            <div>
              <div className="text-xs text-gray-600">{t('Total Income', language)}</div>
              <div className="text-lg font-semibold text-green-600">
                +{formatCurrency(filteredDepositMaturityTotal, state.settings.currency, locale)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">{t('Total Expense', language)}</div>
              <div className="text-lg font-semibold text-red-600">
                -{formatCurrency(filteredDepositPrincipalTotal, state.settings.currency, locale)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">{t('Net', language)}</div>
              <div className={`text-lg font-semibold ${filteredDepositNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(filteredDepositNet, state.settings.currency, locale)}
              </div>
            </div>
          </div>
        </AppCard>
      )}

      {activeTab === 'transactions' && (
        <>
          {/* Add/Edit Form */}
          <AppCard>
            <Accordion
              type="single"
              collapsible
              value={transactionFormOpen ? 'add-transaction' : ''}
              onValueChange={(value) => setTransactionFormOpen(value === 'add-transaction')}
            >
              <AccordionItem value="add-transaction" className="border-none">
                <AccordionTrigger className="py-0">
                  <span className="text-xl font-semibold text-gray-900">{t('Add New Transaction', language)}</span>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Date', language)} *</label>
                      <SmartDateInput
                        value={formData.date || ''}
                        onChange={(value) => setFormData({ ...formData, date: value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Type', language)} *</label>
                  <select
                    value={formData.type || 'expense'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense', categoryId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="income">{t('Income', language)}</option>
                    <option value="expense">{t('Expense', language)}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Category', language)} *</label>
                  <select
                    value={formData.categoryId || ''}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">{t('Select category...', language)}</option>
                      {(formData.type === 'income'
                        ? state.categories
                        : state.categories.filter(c => c.type === 'expense')
                      ).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Amount', language)} * ({formFx.currency})
                  </label>
                  <MoneyField
                    value={formData.amount || 0}
                    onValueChange={(value) => setFormData({ ...formData, amount: value })}
                    locale={locale}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {formFx.isForeign && (
                    <div className="mt-1 text-xs text-gray-500">
                      {t('Base Amount', language)}: {formatCurrency(formFx.baseAmount, baseCurrency, locale)}
                    </div>
                  )}
                </div>
                {formFx.isForeign && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('FX Rate to Base', language)} ({formFx.currency} â†’ {baseCurrency})
                    </label>
                    <UnitsInput
                      value={formData.fxRateToBase ?? 0}
                      onValueChange={(value) => {
                        setIsFxManualOverride(true);
                        setFormData({ ...formData, fxRateToBase: value });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description', language)} *</label>
                  <input
                    type="text"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('e.g., Grocery shopping at Walmart', language)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account (Optional)', language)}</label>
                  <select
                    value={formData.accountId || ''}
                    onChange={(e) => {
                      const accountId = e.target.value || undefined;
                      const fxRateToBase = accountId ? getAccountFxRate(accountId, formData.date) : 1;
                      setIsFxManualOverride(false);
                      setFormData({ ...formData, accountId, fxRateToBase });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">{t('No account', language)}</option>
                    {state.accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{getAccountLabel(acc.id)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Owner (Optional)', language)}</label>
                  <select
                    value={formData.spender || ''}
                    onChange={(e) => setFormData({ ...formData, spender: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">{t('Not specified', language)}</option>
                    {ownerOptions.map(member => (
                      <option key={member} value={member}>{member}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <PrimaryButton onClick={handleSubmit}>
                  <Plus className="w-4 h-4" />
                  {t('Add Transaction', language)}
                </PrimaryButton>
                <SecondaryButton onClick={resetForm}>
                  {t('Clear', language)}
                </SecondaryButton>
              </div>
            </AccordionContent>
          </AccordionItem>
            </Accordion>
          </AppCard>

          {/* Filters and Export */}
          <AppCard>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">{t('Filters:', language)}</span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search...', language)}
              className="px-3 py-1 pr-8 border border-gray-300 rounded-lg text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as 'all' | 'income' | 'expense');
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">{t('All Types', language)}</option>
            <option value="income">{t('Income Only', language)}</option>
            <option value="expense">{t('Expenses Only', language)}</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">{t('All Categories', language)}</option>
            {availableFilterCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select
            value={filterAccountId}
            onChange={(e) => {
              setFilterAccountId(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">{t('All Accounts', language)}</option>
            {state.accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{getAccountLabel(acc.id)}</option>
            ))}
          </select>

          <select
            value={filterOwner}
            onChange={(e) => {
              setFilterOwner(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">{t('All Owners', language)}</option>
            {ownerOptions.map(owner => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>

          <select
            value={datePreset}
            onChange={(e) => {
              const preset = e.target.value as typeof datePreset;
              setDatePreset(preset);
              applyDatePreset(preset);
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="custom">{t('Custom Range', language)}</option>
            <option value="last7">{t('Last 7 Days', language)}</option>
            <option value="last15">{t('Last 15 Days', language)}</option>
            <option value="lastMonth">{t('Last Month', language)}</option>
            <option value="lastYear">{t('Last Year', language)}</option>
            <option value="thisYear">{t('This Year', language)}</option>
          </select>

          <span className="text-sm text-gray-600">{t('Date Range', language)}</span>
          <div className="relative">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                setDatePreset('custom');
                setCurrentPage(1);
              }}
              className="px-3 py-1 pr-8 border border-gray-300 rounded-lg text-sm"
            />
            {filterDateFrom && (
              <button
                onClick={() => {
                  setFilterDateFrom('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                setDatePreset('custom');
                setCurrentPage(1);
              }}
              className="px-3 py-1 pr-8 border border-gray-300 rounded-lg text-sm"
            />
            {filterDateTo && (
              <button
                onClick={() => {
                  setFilterDateTo('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex-1"></div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportChange}
          />
          <PrimaryButton onClick={() => fileInputRef.current?.click()} size="sm">
            <Upload className="w-4 h-4" />
            {t('Import Excel', language)}
          </PrimaryButton>
          <SecondaryButton onClick={exportToCSV} size="sm">
            <Download className="w-4 h-4" />
            {t('Export CSV', language)}
          </SecondaryButton>
      </div>
        </AppCard>

      {/* Transactions List */}
      <AppCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <button
                    onClick={() => setTransactionSort(toggleSort(transactionSort, 'date'))}
                    className="flex items-center gap-1"
                  >
                    {t('Date', language)} <span>{sortIndicator(transactionSort, 'date')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <button
                    onClick={() => setTransactionSort(toggleSort(transactionSort, 'category'))}
                    className="flex items-center gap-1"
                  >
                    {t('Category', language)} <span>{sortIndicator(transactionSort, 'category')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <button
                    onClick={() => setTransactionSort(toggleSort(transactionSort, 'description'))}
                    className="flex items-center gap-1"
                  >
                    {t('Description', language)} <span>{sortIndicator(transactionSort, 'description')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <button
                    onClick={() => setTransactionSort(toggleSort(transactionSort, 'account'))}
                    className="flex items-center gap-1"
                  >
                    {t('Account', language)} <span>{sortIndicator(transactionSort, 'account')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <button
                    onClick={() => setTransactionSort(toggleSort(transactionSort, 'owner'))}
                    className="flex items-center gap-1"
                  >
                    {t('Owner', language)} <span>{sortIndicator(transactionSort, 'owner')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    onClick={() => setTransactionSort(toggleSort(transactionSort, 'amount'))}
                    className="flex items-center gap-1 justify-end w-full"
                  >
                    {t('Amount', language)} <span>{sortIndicator(transactionSort, 'amount')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Actions', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {t('No transactions found. Add your first transaction above.', language)}
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {editingId === transaction.id && rowEditData ? (
                        <input
                          type="date"
                          value={rowEditData.date || ''}
                          onChange={(e) => setRowEditData({ ...rowEditData, date: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                            formatDateDisplay(toLocalDate(transaction.date), language)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === transaction.id && rowEditData ? (
                        <select
                          value={rowEditData.categoryId || ''}
                          onChange={(e) => setRowEditData({ ...rowEditData, categoryId: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">{t('Select category...', language)}</option>
                          {(rowEditData.type === 'income'
                            ? state.categories
                            : state.categories.filter(c => c.type === 'expense')
                          ).map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getCategoryColor(transaction.categoryId) }}
                          />
                          <span className="text-sm">{getCategoryName(transaction.categoryId)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {editingId === transaction.id && rowEditData ? (
                        <input
                          type="text"
                          value={rowEditData.description || ''}
                          onChange={(e) => setRowEditData({ ...rowEditData, description: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        transaction.description
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600" title={getAccountLabel(transaction.accountId)}>
                      {editingId === transaction.id && rowEditData ? (
                        <select
                          value={rowEditData.accountId || ''}
                          onChange={(e) => {
                            const accountId = e.target.value || undefined;
                            const fxRateToBase = accountId ? getAccountFxRate(accountId, rowEditData.date) : 1;
                            setIsRowFxManualOverride(false);
                            setRowEditData({ ...rowEditData, accountId, fxRateToBase });
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">{t('No account', language)}</option>
                          {state.accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{getAccountLabel(acc.id)}</option>
                          ))}
                        </select>
                      ) : (
                        <span title={getAccountLabel(transaction.accountId)}>
                          {getAccountLabel(transaction.accountId)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {editingId === transaction.id && rowEditData ? (
                        <select
                          value={rowEditData.spender || ''}
                          onChange={(e) => setRowEditData({ ...rowEditData, spender: e.target.value || undefined })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">{t('Not specified', language)}</option>
                          {ownerOptions.map(member => (
                            <option key={member} value={member}>{member}</option>
                          ))}
                        </select>
                      ) : (
                        transaction.spender || '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {editingId === transaction.id && rowEditData ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={rowEditData.type || 'expense'}
                              onChange={(e) => setRowEditData({
                                ...rowEditData,
                                type: e.target.value as 'income' | 'expense',
                                categoryId: '',
                              })}
                              className="px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="income">{t('Income', language)}</option>
                              <option value="expense">{t('Expense', language)}</option>
                            </select>
                            <input
                              type="number"
                              value={rowEditData.accountAmount ?? rowEditData.amount ?? ''}
                              onChange={(e) => setRowEditData({
                                ...rowEditData,
                                accountAmount: parseFloat(e.target.value) || 0,
                              })}
                              step="0.01"
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                            />
                          </div>
                          {rowEditFx?.isForeign && (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-gray-500">{rowEditFx.currency} â†’ {baseCurrency}</span>
                              <input
                                type="number"
                                value={rowEditData.fxRateToBase ?? ''}
                                onChange={(e) => {
                                  setIsRowFxManualOverride(true);
                                  setRowEditData({
                                    ...rowEditData,
                                    fxRateToBase: parseFloat(e.target.value) || 0,
                                  });
                                }}
                                step="0.0001"
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className={transaction.type === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {transaction.type === 'income' ? '+' : '-'}
                            {formatCurrency(transaction.baseAmount ?? transaction.amount, state.settings.currency, locale, { hideDecimalsThreshold: Infinity })}
                          </span>
                          {transaction.accountCurrency && transaction.accountCurrency !== baseCurrency && Number.isFinite(transaction.accountAmount) && (
                            <span className="text-xs text-gray-500">
                              {formatLocalAmount(transaction.accountAmount as number, transaction.accountCurrency)}
                              {transaction.fxRateToBase ? ` @ ${transaction.fxRateToBase}` : ''}
                              {' → '}
                              {formatCurrency(transaction.baseAmount ?? transaction.amount, state.settings.currency, locale)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editingId === transaction.id ? (
                          <>
                            <button
                              onClick={saveRowEdit}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelRowEdit}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(transaction)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => repeatTransaction(transaction)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                              title={t('Repeat', language)}
                            >
                              <Repeat className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteTransaction(transaction.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <div className="text-sm text-gray-600">
            {t('Page', language)} {currentPageSafe} {t('of', language)} {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={currentPageSafe <= 1}
            >
              {t('Previous', language)}
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={currentPageSafe >= totalPages}
            >
              {t('Next', language)}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{t('Rows', language)}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </AppCard>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-6xl w-full max-h-[75vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('Import Preview', language)}</DialogTitle>
            <DialogDescription>
              {t('Review the rows and confirm to append transactions.', language)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-auto pr-1">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              <div>
                <div className="font-medium">{t('Total', language)}</div>
                <div>{importSummary.total}</div>
              </div>
              <div>
                <div className="font-medium">{t('Imported', language)}</div>
                <div>{importSummary.imported}</div>
              </div>
              <div>
                <div className="font-medium">{t('Invalid', language)}</div>
                <div>{importSummary.invalid}</div>
              </div>
              <div>
                <div className="font-medium">{t('Duplicates', language)}</div>
                <div>{importSummary.duplicates}</div>
              </div>
              <div>
                <div className="font-medium">{t('Skipped', language)}</div>
                <div>{importSummary.skipped}</div>
              </div>
              <div>
                <div className="font-medium">{t('Warnings', language)}</div>
                <div>{importSummary.warnings}</div>
              </div>
            </div>

            <Accordion type="multiple" defaultValue={['importable']} className="space-y-3">
              <AccordionItem value="importable" className="border border-gray-200 rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  {t('Importable', language)} ({importRows.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="max-h-[18rem] overflow-auto border border-gray-200 rounded-lg">
                    <table className="w-full table-auto text-xs">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left w-28">{t('Date', language)}</th>
                          <th className="px-3 py-2 text-left w-32">{t('Category', language)}</th>
                          <th className="px-3 py-2 text-left">{t('Description', language)}</th>
                          <th className="px-3 py-2 text-left w-32">{t('Account', language)}</th>
                          <th className="px-3 py-2 text-left w-28">{t('Owner', language)}</th>
                          <th className="px-3 py-2 text-right w-28">{t('Amount', language)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                              {t('No valid rows found to import.', language)}
                            </td>
                          </tr>
                        ) : (
                          importRows.map((row, index) => (
                            <tr key={`${row.date}-${row.description}-${index}`} className="border-b border-gray-100">
                              <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                              <td className="px-3 py-2 break-words">{row.categoryName}</td>
                              <td className="px-3 py-2 break-words">{row.description}</td>
                              <td className="px-3 py-2 break-words">{row.accountName || '-'}</td>
                              <td className="px-3 py-2 break-words">{row.spender || '-'}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                {row.type === 'income' ? '+' : '-'}
                                {formatCurrency(row.amount, state.settings.currency, locale, { hideDecimalsThreshold: Infinity })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="duplicates" className="border border-gray-200 rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  {t('Duplicates', language)} ({duplicateImportRows.length})
                </AccordionTrigger>
                <AccordionContent>
                  {duplicateImportRows.length === 0 ? (
                    <div className="text-sm text-gray-500 py-2">{t('No duplicates found.', language)}</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-gray-500">
                          {t('Selected', language)} {selectedDuplicateKeys.size} {t('of', language)} {duplicateImportRows.length}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <button
                            onClick={() => setSelectedDuplicateKeys(new Set(duplicateImportRows.map(row => row.key)))}
                            className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            {t('Select All', language)}
                          </button>
                          <button
                            onClick={() => setSelectedDuplicateKeys(new Set())}
                            className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            {t('Clear All', language)}
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[18rem] overflow-auto border border-gray-200 rounded-lg">
                        <table className="w-full table-auto text-xs">
                          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                            <tr>
                              <th className="px-3 py-2 text-left w-10"></th>
                              <th className="px-3 py-2 text-left w-28">{t('Date', language)}</th>
                              <th className="px-3 py-2 text-left w-32">{t('Category', language)}</th>
                              <th className="px-3 py-2 text-left">{t('Description', language)}</th>
                              <th className="px-3 py-2 text-left w-32">{t('Account', language)}</th>
                              <th className="px-3 py-2 text-left w-28">{t('Owner', language)}</th>
                              <th className="px-3 py-2 text-right w-28">{t('Amount', language)}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {duplicateImportRows.map((row, index) => (
                              <tr key={`${row.key}-${index}`} className="border-b border-gray-100">
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedDuplicateKeys.has(row.key)}
                                    onChange={() => {
                                      setSelectedDuplicateKeys(prev => {
                                        const next = new Set(prev);
                                        if (next.has(row.key)) next.delete(row.key);
                                        else next.add(row.key);
                                        return next;
                                      });
                                    }}
                                    className="h-4 w-4"
                                  />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                                <td className="px-3 py-2 break-words">{row.categoryName}</td>
                                <td className="px-3 py-2 break-words">{row.description}</td>
                                <td className="px-3 py-2 break-words">{row.accountName || '-'}</td>
                                <td className="px-3 py-2 break-words">{row.spender || '-'}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                  {row.type === 'income' ? '+' : '-'}
                                  {formatCurrency(row.amount, state.settings.currency, locale, { hideDecimalsThreshold: Infinity })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="invalid" className="border border-gray-200 rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  {t('Invalid', language)} ({importErrors.length})
                </AccordionTrigger>
                <AccordionContent>
                  {importErrors.length === 0 ? (
                    <div className="text-sm text-gray-500 py-2">{t('No invalid rows.', language)}</div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <div className="font-medium">{t('Import Warnings', language)}</div>
                      <ul className="mt-2 list-disc pl-5">
                        {importErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <SecondaryButton onClick={() => setIsImportOpen(false)}>
              {t('Cancel', language)}
            </SecondaryButton>
            <PrimaryButton
              onClick={applyImport}
              disabled={importRows.length === 0 && selectedDuplicateKeys.size === 0}
            >
              {t('Apply Import', language)}
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}

      {activeTab === 'funds' && (
        <>
          <AppCard>
            <Accordion type="single" collapsible>
              <AccordionItem value="add-fund-transaction" className="border-none">
                <AccordionTrigger className="py-0">
                  <span className="text-xl font-semibold text-gray-900">{t('Add Fund Transaction', language)}</span>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Date', language)} *</label>
                      <SmartDateInput
                        value={fundFormData.date}
                        onChange={(value) => setFundFormData({ ...fundFormData, date: value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Type', language)}</label>
                      <select
                        value={fundFormData.type}
                        onChange={(e) => setFundFormData({ ...fundFormData, type: e.target.value as FundTransaction['type'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="buy">{t('Buy', language)}</option>
                        <option value="sell">{t('Sell', language)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fund', language)} *</label>
                      <input
                        type="text"
                        value={fundFormData.fund}
                        onChange={(e) => setFundFormData({ ...fundFormData, fund: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account (Optional)', language)}</label>
                      <select
                        value={fundFormData.accountId}
                        onChange={(e) => setFundFormData({ ...fundFormData, accountId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">{t('No account', language)}</option>
                        {state.accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{getAccountLabel(acc.id)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Owner (Optional)', language)}</label>
                      <select
                        value={fundFormData.spender}
                        onChange={(e) => setFundFormData({ ...fundFormData, spender: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">{t('Not specified', language)}</option>
                        {ownerOptions.map(member => (
                          <option key={member} value={member}>{member}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Units', language)} *</label>
                      <UnitsInput
                        value={fundFormData.units}
                        onValueChange={(value) => setFundFormData({ ...fundFormData, units: value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Price', language)} *</label>
                      <UnitsInput
                        value={fundFormData.price}
                        onValueChange={(value) => setFundFormData({ ...fundFormData, price: value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Total', language)}</label>
                      <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        {formatCurrency(
                          Math.abs((fundFormData.units || 0) * (fundFormData.price || 0)),
                          state.settings.currency,
                          locale
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <PrimaryButton onClick={handleFundSubmit}>
                      <Plus className="w-4 h-4" />
                      {t('Add Fund Transaction', language)}
                    </PrimaryButton>
                  </div>
                  {fundFormError && (
                    <div className="mt-2 text-sm text-red-600">{fundFormError}</div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AppCard>

          
          <AppCard>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{t('Filters:', language)}</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={fundSearchQuery}
                  onChange={(e) => setFundSearchQuery(e.target.value)}
                  placeholder={t('Search...', language)}
                  className="px-3 py-1 pr-8 border border-gray-300 rounded-lg text-sm"
                />
                {fundSearchQuery && (
                  <button
                    onClick={() => setFundSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <select
                value={fundFilterAccountId}
                onChange={(e) => {
                  setFundFilterAccountId(e.target.value);
                  setFundCurrentPage(1);
                }}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">{t('All Accounts', language)}</option>
                {state.accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{getAccountLabel(acc.id)}</option>
                ))}
              </select>
              <select
                value={fundFilterSpender}
                onChange={(e) => {
                  setFundFilterSpender(e.target.value);
                  setFundCurrentPage(1);
                }}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">{t('All Owners', language)}</option>
                {ownerOptions.map(member => (
                  <option key={member} value={member}>{member}</option>
                ))}
              </select>
              <select
                value={fundDatePreset}
                onChange={(e) => {
                  const preset = e.target.value as typeof fundDatePreset;
                  setFundDatePreset(preset);
                  applyFundDatePreset(preset);
                  setFundCurrentPage(1);
                }}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="custom">{t('Custom Range', language)}</option>
                <option value="last7">{t('Last 7 Days', language)}</option>
                <option value="last15">{t('Last 15 Days', language)}</option>
                <option value="lastMonth">{t('Last Month', language)}</option>
                <option value="lastYear">{t('Last Year', language)}</option>
                <option value="thisYear">{t('This Year', language)}</option>
              </select>
              <span className="text-sm text-gray-600">{t('Date Range', language)}</span>
              <div className="relative">
                <input
                  type="date"
                  value={fundFilterDateFrom}
                  onChange={(e) => {
                    setFundFilterDateFrom(e.target.value);
                    setFundDatePreset('custom');
                    setFundCurrentPage(1);
                  }}
                  className="px-3 py-1 pr-8 border border-gray-300 rounded-lg text-sm"
                />
                {fundFilterDateFrom && (
                  <button
                    onClick={() => {
                      setFundFilterDateFrom('');
                      setFundCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="date"
                  value={fundFilterDateTo}
                  onChange={(e) => {
                    setFundFilterDateTo(e.target.value);
                    setFundDatePreset('custom');
                    setFundCurrentPage(1);
                  }}
                  className="px-3 py-1 pr-8 border border-gray-300 rounded-lg text-sm"
                />
                {fundFilterDateTo && (
                  <button
                    onClick={() => {
                      setFundFilterDateTo('');
                      setFundCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex-1"></div>
              <input
                ref={fundFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFundImportChange}
              />
              <PrimaryButton onClick={() => fundFileInputRef.current?.click()} size="sm">
                <Upload className="w-4 h-4" />
                {t('Import Funds', language)}
              </PrimaryButton>
              <SecondaryButton onClick={exportFundsToCSV} size="sm">
                <Download className="w-4 h-4" />
                {t('Export CSV', language)}
              </SecondaryButton>
              <SecondaryButton onClick={exportFundsToXLSX} size="sm">
                <Download className="w-4 h-4" />
                {t('Export XLSX', language)}
              </SecondaryButton>
            </div>
          </AppCard>

          {fundEditError && (
            <div className="text-sm text-red-600">{fundEditError}</div>
          )}

          <AppCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setFundSort(toggleSort(fundSort, 'date'))}
                        className="flex items-center gap-1"
                      >
                        {t('Date', language)} <span>{sortIndicator(fundSort, 'date')}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setFundSort(toggleSort(fundSort, 'fund'))}
                        className="flex items-center gap-1"
                      >
                        {t('Fund', language)} <span>{sortIndicator(fundSort, 'fund')}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setFundSort(toggleSort(fundSort, 'account'))}
                        className="flex items-center gap-1"
                      >
                        {t('Account', language)} <span>{sortIndicator(fundSort, 'account')}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setFundSort(toggleSort(fundSort, 'owner'))}
                        className="flex items-center gap-1"
                      >
                        {t('Owner', language)} <span>{sortIndicator(fundSort, 'owner')}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setFundSort(toggleSort(fundSort, 'units'))}
                        className="flex items-center gap-1 justify-end w-full"
                      >
                        {t('Units', language)} <span>{sortIndicator(fundSort, 'units')}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setFundSort(toggleSort(fundSort, 'price'))}
                        className="flex items-center gap-1 justify-end w-full"
                      >
                        {t('Price', language)} <span>{sortIndicator(fundSort, 'price')}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setFundSort(toggleSort(fundSort, 'amount'))}
                        className="flex items-center gap-1 justify-end w-full"
                      >
                        {t('Total', language)} <span>{sortIndicator(fundSort, 'amount')}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Actions', language)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedFundTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        {t('No fund transactions found.', language)}
                      </td>
                    </tr>
                  ) : (
                    paginatedFundTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {fundEditingId === tx.id && fundRowEditData ? (
                            <SmartDateInput
                              value={fundRowEditData.date || ''}
                              onChange={(value) => setFundRowEditData({ ...fundRowEditData, date: value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                          ) : (
                            formatDateDisplay(toLocalDate(tx.date), language)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {fundEditingId === tx.id && fundRowEditData ? (
                            <input
                              type="text"
                              value={fundRowEditData.fund || ''}
                              onChange={(e) => setFundRowEditData({ ...fundRowEditData, fund: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                          ) : (
                            tx.fund
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {fundEditingId === tx.id && fundRowEditData ? (
                            <select
                              value={fundRowEditData.accountId || ''}
                              onChange={(e) => setFundRowEditData({ ...fundRowEditData, accountId: e.target.value || undefined })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="">{t('No account', language)}</option>
                              {state.accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{getAccountLabel(acc.id)}</option>
                              ))}
                            </select>
                          ) : (
                            <span title={getAccountLabel(tx.accountId)}>
                              {getAccountLabel(tx.accountId)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {fundEditingId === tx.id && fundRowEditData ? (
                            <select
                              value={fundRowEditData.spender || ''}
                              onChange={(e) => setFundRowEditData({ ...fundRowEditData, spender: e.target.value || undefined })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="">{t('Not specified', language)}</option>
                              {ownerOptions.map(member => (
                                <option key={member} value={member}>{member}</option>
                              ))}
                            </select>
                          ) : (
                            tx.spender || '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {fundEditingId === tx.id && fundRowEditData ? (
                            <UnitsInput
                              value={fundRowEditData.units}
                              onValueChange={(value) => setFundRowEditData({ ...fundRowEditData, units: value })}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                            />
                          ) : (
                            formatUnits(tx.units)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {fundEditingId === tx.id && fundRowEditData ? (
                            <UnitsInput
                              value={fundRowEditData.price}
                              onValueChange={(value) => setFundRowEditData({ ...fundRowEditData, price: value })}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                            />
                          ) : (
                            tx.price.toFixed(4)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatCurrency(Math.abs(tx.amount), state.settings.currency, locale, { hideDecimalsThreshold: Infinity })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {fundEditingId === tx.id ? (
                              <>
                                <button
                                  onClick={saveFundEdit}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelFundEdit}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startFundEdit(tx)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (tx.cashTransactionId) {
                                      deleteTransaction(tx.cashTransactionId);
                                    }
                                    deleteFundTransaction(tx.id);
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
              <div className="text-sm text-gray-600">
                {t('Page', language)} {fundCurrentPageSafe} {t('of', language)} {fundTotalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFundCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={fundCurrentPageSafe <= 1}
                >
                  {t('Previous', language)}
                </button>
                <button
                  onClick={() => setFundCurrentPage(prev => Math.min(fundTotalPages, prev + 1))}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={fundCurrentPageSafe >= fundTotalPages}
                >
                  {t('Next', language)}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{t('Rows', language)}</span>
                <select
                  value={fundPageSize}
                  onChange={(e) => {
                    setFundPageSize(Number(e.target.value));
                    setFundCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </AppCard>
          

          <Dialog open={isFundImportOpen} onOpenChange={setIsFundImportOpen}>
            <DialogContent className="max-w-6xl w-full max-h-[75vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>{t('Fund Import Preview', language)}</DialogTitle>
                <DialogDescription>{t('Review the rows and confirm to append fund transactions.', language)}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 overflow-auto pr-1">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  <div>
                    <div className="font-medium">{t('Total', language)}</div>
                    <div>{fundImportSummary.total}</div>
                  </div>
                  <div>
                    <div className="font-medium">{t('Imported', language)}</div>
                    <div>{fundImportSummary.imported}</div>
                  </div>
                  <div>
                    <div className="font-medium">{t('Invalid', language)}</div>
                    <div>{fundImportSummary.invalid}</div>
                  </div>
                  <div>
                    <div className="font-medium">{t('Duplicates', language)}</div>
                    <div>{fundImportSummary.duplicates}</div>
                  </div>
                  <div>
                    <div className="font-medium">{t('Skipped', language)}</div>
                    <div>{fundImportSummary.skipped}</div>
                  </div>
                  <div>
                    <div className="font-medium">{t('Warnings', language)}</div>
                    <div>{fundImportSummary.warnings}</div>
                  </div>
                </div>

                <Accordion type="multiple" defaultValue={['fund-importable']} className="space-y-3">
                  <AccordionItem value="fund-importable" className="border border-gray-200 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-semibold">
                      {t('Import Data Preview', language)} ({fundImportRows.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="max-h-[18rem] overflow-auto border border-gray-200 rounded-lg">
                        <table className="w-full table-auto text-xs">
                          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                            <tr>
                              <th className="px-3 py-2 text-left w-28">{t('Date', language)}</th>
                              <th className="px-3 py-2 text-left w-32">{t('Fund', language)}</th>
                              <th className="px-3 py-2 text-left w-32">{t('Account', language)}</th>
                              <th className="px-3 py-2 text-left w-28">{t('Owner', language)}</th>
                              <th className="px-3 py-2 text-right w-24">{t('Units', language)}</th>
                              <th className="px-3 py-2 text-right w-24">{t('Price', language)}</th>
                              <th className="px-3 py-2 text-right w-28">{t('Total', language)}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fundImportRows.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                                  {t('No valid rows found to import.', language)}
                                </td>
                              </tr>
                            ) : (
                              fundImportRows.map((row) => (
                                <tr key={row.id} className="border-b border-gray-100">
                                  <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                                  <td className="px-3 py-2 break-words">{row.fund}</td>
                                  <td className="px-3 py-2 break-words" title={getAccountLabel(row.accountId)}>{getAccountLabel(row.accountId)}</td>
                                  <td className="px-3 py-2 break-words">{row.spender || '-'}</td>
                                  <td className="px-3 py-2 text-right">{formatUnits(row.units)}</td>
                                  <td className="px-3 py-2 text-right">{row.price.toFixed(4)}</td>
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    {formatCurrency(Math.abs(row.amount), state.settings.currency, locale, { hideDecimalsThreshold: Infinity })}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="fund-duplicates" className="border border-gray-200 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-semibold">
                      {t('Duplicates', language)} ({fundDuplicateRows.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      {fundDuplicateRows.length === 0 ? (
                        <div className="text-sm text-gray-500 py-2">{t('No duplicates found.', language)}</div>
                      ) : (
                        <div className="max-h-[18rem] overflow-auto border border-gray-200 rounded-lg">
                          <table className="w-full table-auto text-xs">
                            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                              <tr>
                                <th className="px-3 py-2 text-left w-28">{t('Date', language)}</th>
                                <th className="px-3 py-2 text-left w-32">{t('Fund', language)}</th>
                                <th className="px-3 py-2 text-left w-32">{t('Account', language)}</th>
                                <th className="px-3 py-2 text-left w-28">{t('Owner', language)}</th>
                                <th className="px-3 py-2 text-right w-24">{t('Units', language)}</th>
                                <th className="px-3 py-2 text-right w-24">{t('Price', language)}</th>
                                <th className="px-3 py-2 text-right w-28">{t('Total', language)}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fundDuplicateRows.map((row) => (
                                <tr key={row.id} className="border-b border-gray-100">
                                  <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                                  <td className="px-3 py-2 break-words">{row.fund}</td>
                                  <td className="px-3 py-2 break-words" title={getAccountLabel(row.accountId)}>{getAccountLabel(row.accountId)}</td>
                                  <td className="px-3 py-2 break-words">{row.spender || '-'}</td>
                                  <td className="px-3 py-2 text-right">{formatUnits(row.units)}</td>
                                  <td className="px-3 py-2 text-right">{row.price.toFixed(4)}</td>
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    {formatCurrency(Math.abs(row.amount), state.settings.currency, locale, { hideDecimalsThreshold: Infinity })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="fund-warnings" className="border border-gray-200 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-semibold">
                      {t('Import Warnings', language)} ({fundImportErrors.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      {fundImportErrors.length === 0 ? (
                        <div className="text-sm text-gray-500 py-2">{t('No invalid rows.', language)}</div>
                      ) : (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          <ul className="list-disc pl-5">
                            {fundImportErrors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <SecondaryButton onClick={() => setIsFundImportOpen(false)}>
                  {t('Cancel', language)}
                </SecondaryButton>
                <PrimaryButton onClick={applyFundImport} disabled={fundImportRows.length === 0}>
                  {t('Apply Import', language)}
                </PrimaryButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {activeTab === 'deposits' && (
        <>
          <AppCard>
            <Accordion type="single" collapsible>
              <AccordionItem value="add-deposit" className="border-none">
                <AccordionTrigger className="py-0">
                  <span className="text-xl font-semibold text-gray-900">{t('Add Deposit', language)}</span>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Owner', language)}</label>
                      <input
                        type="text"
                        value={depositFormData.owner || ''}
                        onChange={(e) => setDepositFormData({ ...depositFormData, owner: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Institution', language)}</label>
                      <input
                        type="text"
                        value={depositFormData.institution || ''}
                        onChange={(e) => setDepositFormData({ ...depositFormData, institution: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Principal', language)} *</label>
                      <MoneyField
                        value={depositFormData.principal}
                        onValueChange={(value) => setDepositFormData({ ...depositFormData, principal: value })}
                        locale={locale}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Term Days', language)} *</label>
                      <UnitsInput
                        value={depositFormData.termDays}
                        onValueChange={(value) => setDepositFormData({ ...depositFormData, termDays: Math.max(0, Math.round(value)) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Gross Rate %', language)}</label>
                      <RateField
                        value={depositFormData.grossRate}
                        onValueChange={(value) => setDepositFormData({ ...depositFormData, grossRate: value })}
                        locale={locale}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Stopaj %', language)}</label>
                      <RateField
                        value={depositFormData.withholdingTaxRate}
                        onValueChange={(value) => setDepositFormData({ ...depositFormData, withholdingTaxRate: value })}
                        locale={locale}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('Start Date', language)} *</label>
                      <SmartDateInput
                        value={depositFormData.startDate || ''}
                        onChange={(value) => setDepositFormData({ ...depositFormData, startDate: value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                    {(() => {
                      const preview = deriveDepositFields({
                        id: 'preview',
                        owner: depositFormData.owner || '',
                        institution: depositFormData.institution || '',
                        principal: depositFormData.principal || 0,
                        termDays: depositFormData.termDays || 0,
                        grossRate: depositFormData.grossRate || 0,
                        withholdingTaxRate: depositFormData.withholdingTaxRate || 0,
                        startDate: depositFormData.startDate || '',
                        source: 'manual',
                      });
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <div className="text-xs text-gray-500">{t('Maturity Date', language)}</div>
                            <div className="font-medium">{preview.maturityDate || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">{t('Net Interest', language)}</div>
                            <div className="font-medium">{formatCurrency(preview.netInterest, state.settings.currency, locale)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">{t('Maturity Value', language)}</div>
                            <div className="font-medium">{formatCurrency(preview.maturityValue, state.settings.currency, locale)}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <PrimaryButton onClick={handleDepositSubmit}>
                      <Plus className="w-4 h-4" />
                      {depositEditingId ? t('Update Deposit', language) : t('Add Deposit', language)}
                    </PrimaryButton>
                    <SecondaryButton onClick={resetDepositForm}>
                      {t('Clear', language)}
                    </SecondaryButton>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AppCard>

          <AppCard>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{t('Filters:', language)}</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={depositSearchQuery}
                  onChange={(e) => setDepositSearchQuery(e.target.value)}
                  placeholder={t('Search...', language)}
                  className="px-3 py-1 pr-8 border border-gray-300 rounded-lg text-sm"
                />
                {depositSearchQuery && (
                  <button
                    onClick={() => setDepositSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <select
                value={depositStatusFilter}
                onChange={(e) => setDepositStatusFilter(e.target.value as typeof depositStatusFilter)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="active">{t('Active', language)}</option>
                <option value="due-soon">{t('Due Soon', language)}</option>
                <option value="matured">{t('Matured', language)}</option>
                <option value="all">{t('All Statuses', language)}</option>
              </select>
              <div className="flex-1"></div>
              <input
                ref={depositFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleDepositImportChange}
                className="hidden"
              />
              <PrimaryButton onClick={() => depositFileInputRef.current?.click()} size="sm">
                <Upload className="w-4 h-4" />
                {t('Import Deposits', language)}
              </PrimaryButton>
              <SecondaryButton onClick={exportDepositsToCSV} size="sm">
                <Download className="w-4 h-4" />
                {t('Export CSV', language)}
              </SecondaryButton>
              <SecondaryButton onClick={exportDepositsToXLSX} size="sm">
                <Download className="w-4 h-4" />
                {t('Export XLSX', language)}
              </SecondaryButton>
            </div>
          </AppCard>

          <AppCard>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setDepositSort(toggleSort(depositSort, 'owner'))}
                        className="flex items-center gap-1"
                      >
                        {t('Owner', language)} <span>{sortIndicator(depositSort, 'owner')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setDepositSort(toggleSort(depositSort, 'institution'))}
                        className="flex items-center gap-1"
                      >
                        {t('Institution', language)} <span>{sortIndicator(depositSort, 'institution')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setDepositSort(toggleSort(depositSort, 'principal'))}
                        className="flex items-center gap-1 justify-end w-full"
                      >
                        {t('Principal', language)} <span>{sortIndicator(depositSort, 'principal')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Term Days', language)}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Gross Rate %', language)}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Stopaj %', language)}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setDepositSort(toggleSort(depositSort, 'startDate'))}
                        className="flex items-center gap-1"
                      >
                        {t('Start Date', language)} <span>{sortIndicator(depositSort, 'startDate')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setDepositSort(toggleSort(depositSort, 'maturityDate'))}
                        className="flex items-center gap-1"
                      >
                        {t('Maturity Date', language)} <span>{sortIndicator(depositSort, 'maturityDate')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Net Interest', language)}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Maturity Value', language)}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setDepositSort(toggleSort(depositSort, 'status'))}
                        className="flex items-center gap-1"
                      >
                        {t('Status', language)} <span>{sortIndicator(depositSort, 'status')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('Actions', language)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-6 text-center text-gray-500">
                        {t('No deposits added yet.', language)}
                      </td>
                    </tr>
                  ) : (
                    filteredDeposits.map(deposit => {
                      const status = getDepositStatus(deposit, depositToday, 7);
                      return (
                        <tr key={deposit.id}>
                          <td className="px-3 py-2">{deposit.owner || '-'}</td>
                          <td className="px-3 py-2">{deposit.institution || '-'}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(deposit.principal, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right">{deposit.termDays}</td>
                          <td className="px-3 py-2 text-right">{deposit.grossRate.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right">{deposit.withholdingTaxRate.toFixed(2)}%</td>
                          <td className="px-3 py-2">{deposit.startDate}</td>
                          <td className="px-3 py-2">{deposit.maturityDate}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(deposit.netInterest, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(deposit.maturityValue, state.settings.currency, locale)}</td>
                          <td className="px-3 py-2">{status}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEditDeposit(deposit)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteDeposit(deposit.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </AppCard>

          <Dialog open={isDepositImportOpen} onOpenChange={setIsDepositImportOpen}>
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>{t('Deposit Import Preview', language)}</DialogTitle>
                <DialogDescription>{t('Review the rows and confirm to append deposits.', language)}</DialogDescription>
              </DialogHeader>

              {depositImportErrors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="font-medium">{t('Import Warnings', language)}</div>
                  <ul className="mt-2 list-disc pl-5">
                    {depositImportErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>{t('Based on current filters', language)}</div>
                <div>
                  {t('Showing', language)} {depositImportSummary.valid} {t('of', language)} {depositImportSummary.total} {t('items', language)}
                </div>
              </div>

              <div className="max-h-72 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full table-fixed text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-1 text-left w-24">{t('Owner', language)}</th>
                      <th className="px-2 py-1 text-left w-24">{t('Institution', language)}</th>
                      <th className="px-2 py-1 text-right w-20">{t('Principal', language)}</th>
                      <th className="px-2 py-1 text-right w-16">{t('Term Days', language)}</th>
                      <th className="px-2 py-1 text-right w-16">{t('Gross Rate %', language)}</th>
                      <th className="px-2 py-1 text-right w-16">{t('Stopaj %', language)}</th>
                      <th className="px-2 py-1 text-left w-24">{t('Start Date', language)}</th>
                      <th className="px-2 py-1 text-left w-24">{t('Maturity Date', language)}</th>
                      <th className="px-2 py-1 text-right w-24">{t('Maturity Value', language)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depositImportRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                          {t('No valid rows found to import.', language)}
                        </td>
                      </tr>
                    ) : (
                      depositImportRows.map(row => (
                        <tr key={row.id} className="border-b border-gray-100">
                          <td className="px-2 py-1 truncate">{row.owner || '-'}</td>
                          <td className="px-2 py-1 truncate">{row.institution || '-'}</td>
                          <td className="px-2 py-1 text-right">{formatCurrency(row.principal, state.settings.currency, locale)}</td>
                          <td className="px-2 py-1 text-right">{row.termDays}</td>
                          <td className="px-2 py-1 text-right">{row.grossRate.toFixed(2)}%</td>
                          <td className="px-2 py-1 text-right">{row.withholdingTaxRate.toFixed(2)}%</td>
                          <td className="px-2 py-1">{row.startDate}</td>
                          <td className="px-2 py-1">{row.maturityDate}</td>
                          <td className="px-2 py-1 text-right">{formatCurrency(row.maturityValue, state.settings.currency, locale)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <SecondaryButton onClick={() => setIsDepositImportOpen(false)}>
                  {t('Cancel', language)}
                </SecondaryButton>
                <PrimaryButton onClick={applyDepositImport} disabled={depositImportRows.length === 0}>
                  {t('Apply Import', language)}
                </PrimaryButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
