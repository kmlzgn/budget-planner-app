import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useBudget } from '../context/BudgetContext';
import { Plus, Trash2, Edit2, Check, X, Download, Upload } from 'lucide-react';
import { BudgetState, Category, CategoryClassification, Transaction, FundTransaction, Deposit, Account, FundHoldingMeta } from '../types';
import { generateId } from '../utils/id';
import { getMonthNames, t } from '../utils/i18n';
import { format } from 'date-fns';
import { UnitsInput } from '../components/inputs/NumberInput';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { BreadcrumbInline } from '../components/BreadcrumbInline';

const currencies = ['$', '€', '£', '¥', '₹', 'R$', 'A$', 'C$', 'CHF', 'kr', 'zł', '₺'];
export function Setup() {
  const {
    state,
    updateSettings,
    addCategory,
    updateCategory,
    deleteCategory,
    setTransactions,
    setFundTransactions,
    setFundHoldingsMeta,
    setDeposits,
    setAccounts,
    setCategories,
    restoreState,
  } = useBudget();
  const language = state.settings.language;
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const datasetKeys = ['transactions', 'deposits', 'accounts', 'categories', 'funds', 'fundPrices', 'owners', 'spenders'] as const;
  type DatasetKey = (typeof datasetKeys)[number];
  const datasetLabels: Record<DatasetKey, string> = {
    transactions: 'Transactions',
    deposits: 'Deposits',
    accounts: 'Accounts',
    categories: 'Categories',
    funds: 'Funds',
    fundPrices: 'Fund Prices',
    owners: 'Owners',
    spenders: 'Spenders',
  };
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [exportSelection, setExportSelection] = useState<Record<DatasetKey, boolean>>(() =>
    datasetKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<DatasetKey, boolean>)
  );
  const [importSelection, setImportSelection] = useState<Record<DatasetKey, boolean>>(() =>
    datasetKeys.reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<DatasetKey, boolean>)
  );
  const [importAvailable, setImportAvailable] = useState<DatasetKey[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importSummary, setImportSummary] = useState<Record<DatasetKey, number>>({} as Record<DatasetKey, number>);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importPayload, setImportPayload] = useState<{ version: number; exportedAt?: string; data: Record<string, unknown> } | null>(null);
  const [importError, setImportError] = useState('');
  const [backupMeta, setBackupMeta] = useState<{ lastExportAt?: string; lastImportAt?: string; version?: number }>(() => {
    const raw = localStorage.getItem('budgetPlannerBackupMeta');
    if (!raw) return {};
    try {
      return JSON.parse(raw) as { lastExportAt?: string; lastImportAt?: string; version?: number };
    } catch {
      return {};
    }
  });
  const [dataMessage, setDataMessage] = useState('');
  const [dataMessageType, setDataMessageType] = useState<'success' | 'error'>('success');
  const [isFullRestoreOpen, setIsFullRestoreOpen] = useState(false);
  const [fullRestoreError, setFullRestoreError] = useState('');
  const [fullRestorePayload, setFullRestorePayload] = useState<{
    version?: number;
    exportedAt?: string;
    fullState: BudgetState;
  } | null>(null);
  const [fullRestoreSummary, setFullRestoreSummary] = useState<Record<string, number>>({});
  const [fullRestoreSelection, setFullRestoreSelection] = useState<Record<string, boolean>>({});
  const [fullRestoreAvailable, setFullRestoreAvailable] = useState<Record<string, boolean>>({});
  const fullImportFileInputRef = useRef<HTMLInputElement>(null);
  const [draftSettings, setDraftSettings] = useState(() => ({
    currency: state.settings.currency,
    startMonth: state.settings.startMonth,
    startYear: state.settings.startYear,
    budgetMethod: state.settings.budgetMethod,
    language: state.settings.language,
  }));
  const [newMember, setNewMember] = useState('');
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: '#3b82f6',
    classification: 'none' as CategoryClassification,
  });
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Category>>({});
  const monthNames = getMonthNames(draftSettings.language, 'long');
  const ownersCount = (state.settings.owners?.length ?? 0) || state.settings.familyMembers.length;
  const onboardingSteps = [
    { label: t('Currency & Locale', language), done: Boolean(state.settings.currency), to: '/setup' },
    { label: t('Users / Owners', language), done: ownersCount > 0, to: '/setup' },
    { label: t('Categories', language), done: state.categories.length > 0, to: '/setup' },
    { label: t('Accounts', language), done: state.accounts.length > 0, to: '/accounts' },
    { label: t('Import Transactions', language), done: state.transactions.length > 0, to: '/transactions' },
    { label: t('Investments / Deposits', language), done: state.fundTransactions.length > 0 || state.deposits.length > 0, to: '/transactions' },
  ];

  useEffect(() => {
    setDraftSettings({
      currency: state.settings.currency,
      startMonth: state.settings.startMonth,
      startYear: state.settings.startYear,
      budgetMethod: state.settings.budgetMethod,
      language: state.settings.language,
    });
  }, [state.settings.budgetMethod, state.settings.currency, state.settings.language, state.settings.startMonth, state.settings.startYear]);

  const applySettings = () => {
    updateSettings(draftSettings);
  };

  const updateBackupMeta = (updates: Partial<{ lastExportAt?: string; lastImportAt?: string; version?: number }>) => {
    const next = { ...backupMeta, ...updates };
    setBackupMeta(next);
    localStorage.setItem('budgetPlannerBackupMeta', JSON.stringify(next));
  };

  const selectAll = (setter: React.Dispatch<React.SetStateAction<Record<DatasetKey, boolean>>>, keys: DatasetKey[]) => {
    setter(keys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<DatasetKey, boolean>));
  };

  const clearAll = (setter: React.Dispatch<React.SetStateAction<Record<DatasetKey, boolean>>>, keys: DatasetKey[]) => {
    setter(keys.reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<DatasetKey, boolean>));
  };

  const handleExport = () => {
    const data: Record<string, unknown> = {};
    if (exportSelection.transactions) data.transactions = state.transactions;
    if (exportSelection.deposits) data.deposits = state.deposits;
    if (exportSelection.accounts) data.accounts = state.accounts;
    if (exportSelection.categories) data.categories = state.categories;
    if (exportSelection.funds) data.funds = state.fundTransactions;
    if (exportSelection.fundPrices) data.fundPrices = state.fundHoldingsMeta;
    if (exportSelection.owners) data.owners = state.settings.owners ?? [];
    if (exportSelection.spenders) data.spenders = state.settings.familyMembers;

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-planner-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    updateBackupMeta({ lastExportAt: new Date().toISOString(), version: 1 });
    setDataMessageType('success');
    setDataMessage(t('Export completed.', language));
    setIsExportOpen(false);
  };

  const handleFullExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      fullState: state,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-planner-full-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    updateBackupMeta({ lastExportAt: new Date().toISOString(), version: 1 });
    setDataMessageType('success');
    setDataMessage(t('Full backup exported.', language));
  };

  const handleImportFile = async (file: File) => {
    setImportError('');
    setImportWarnings([]);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { version?: number; exportedAt?: string; data?: Record<string, unknown> };
      if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
        setImportError(t('Invalid backup file structure.', language));
        return;
      }

      const validated = validateImportData(parsed.data as Record<string, unknown>);
      const available = datasetKeys.filter(key => Array.isArray(validated.data[key]) && (validated.data[key] as unknown[]).length > 0);
      if (available.length === 0) {
        setImportError(t('No valid rows found to import.', language));
        return;
      }

      const summary = available.reduce((acc, key) => {
        const rows = (validated.data as Record<string, unknown>)[key] as unknown[];
        acc[key] = Array.isArray(rows) ? rows.length : 0;
        return acc;
      }, {} as Record<DatasetKey, number>);

      setImportPayload({
        version: parsed.version ?? 1,
        exportedAt: parsed.exportedAt,
        data: validated.data as Record<string, unknown>,
      });
      setImportAvailable(available);
      setImportSelection(available.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<DatasetKey, boolean>));
      setImportSummary(summary);
      setImportWarnings(validated.warnings);
      setImportMode('merge');
      setDataMessage('');
      setIsImportOpen(true);
    } catch {
      setImportError(t('Invalid JSON file.', language));
    }
  };

  const summarizeFullState = (fullState: BudgetState) => ({
    transactions: Array.isArray(fullState.transactions) ? fullState.transactions.length : 0,
    deposits: Array.isArray(fullState.deposits) ? fullState.deposits.length : 0,
    accounts: Array.isArray(fullState.accounts) ? fullState.accounts.length : 0,
    categories: Array.isArray(fullState.categories) ? fullState.categories.length : 0,
    funds: Array.isArray(fullState.fundTransactions) ? fullState.fundTransactions.length : 0,
    fundPrices: Array.isArray(fullState.fundHoldingsMeta) ? fullState.fundHoldingsMeta.length : 0,
    debts: Array.isArray(fullState.debts) ? fullState.debts.length : 0,
    savingsGoals: Array.isArray(fullState.savingsGoals) ? fullState.savingsGoals.length : 0,
    recurringTransactions: Array.isArray(fullState.recurringTransactions) ? fullState.recurringTransactions.length : 0,
    wealthSnapshots: Array.isArray(fullState.wealthSnapshots) ? fullState.wealthSnapshots.length : 0,
  });

  const fullRestoreDatasets = [
    { key: 'transactions', label: t('Transactions', language) },
    { key: 'deposits', label: t('Deposits', language) },
    { key: 'accounts', label: t('Accounts', language) },
    { key: 'categories', label: t('Categories', language) },
    { key: 'funds', label: t('Funds', language) },
    { key: 'fundPrices', label: t('Fund Prices', language) },
    { key: 'debts', label: t('Debts', language) },
    { key: 'savingsGoals', label: t('Savings Goals', language) },
    { key: 'recurringTransactions', label: t('Recurring Transactions', language) },
    { key: 'wealthSnapshots', label: t('Wealth Snapshots', language) },
  ];

  const handleFullImportFile = async (file: File) => {
    setFullRestoreError('');
    setDataMessage('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { version?: number; exportedAt?: string; fullState?: BudgetState };
      if (!parsed || typeof parsed !== 'object' || !parsed.fullState) {
        setFullRestoreError(t('Invalid backup file structure.', language));
        return;
      }
      setFullRestorePayload({
        version: parsed.version ?? 1,
        exportedAt: parsed.exportedAt,
        fullState: parsed.fullState,
      });
      const summary = summarizeFullState(parsed.fullState);
      const available = Object.keys(summary).reduce((acc, key) => {
        acc[key] = summary[key as keyof typeof summary] >= 0;
        return acc;
      }, {} as Record<string, boolean>);
      const selection = Object.keys(summary).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setFullRestoreSummary(summary);
      setFullRestoreAvailable(available);
      setFullRestoreSelection(selection);
      setIsFullRestoreOpen(true);
    } catch {
      setFullRestoreError(t('Invalid JSON file.', language));
    }
  };

  const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]) => {
    const map = new Map(existing.map(item => [item.id, item]));
    incoming.forEach(item => {
      if (!map.has(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const mergeAccounts = (existing: Account[], incoming: Account[]) => {
    const map = new Map(existing.map(item => [item.id, item]));
    incoming.forEach(item => {
      const current = map.get(item.id);
      map.set(item.id, current ? { ...current, ...item } : item);
    });
    return Array.from(map.values());
  };

  const mergeCategories = (existing: Category[], incoming: Category[]) => {
    const map = new Map(existing.map(item => [item.id, item]));
    const nameMap = new Map(existing.map(item => [item.name.toLowerCase(), item.id]));
    incoming.forEach(item => {
      const byId = map.get(item.id);
      if (byId) {
        map.set(item.id, { ...byId, ...item });
        return;
      }
      const byNameId = nameMap.get(item.name.toLowerCase());
      if (byNameId) {
        const current = map.get(byNameId);
        if (current) map.set(byNameId, { ...current, ...item, id: current.id });
        return;
      }
      map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const mergeFundPrices = (existing: FundHoldingMeta[], incoming: FundHoldingMeta[]) => {
    const map = new Map(existing.map(item => [item.fund, item]));
    incoming.forEach(item => {
      const current = map.get(item.fund);
      map.set(item.fund, current ? { ...current, ...item } : item);
    });
    return Array.from(map.values());
  };

  const normalizeStringList = (list: unknown) =>
    Array.isArray(list) ? list.filter(item => typeof item === 'string' && item.trim()) as string[] : [];

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  const filterValidRows = <T>(
    rows: unknown,
    isValid: (row: Record<string, unknown>) => row is T
  ): { valid: T[]; invalid: number } => {
    if (!Array.isArray(rows)) return { valid: [], invalid: 0 };
    let invalid = 0;
    const valid = rows.filter((row): row is T => {
      if (!isRecord(row)) {
        invalid += 1;
        return false;
      }
      if (!isValid(row)) {
        invalid += 1;
        return false;
      }
      return true;
    });
    return { valid, invalid };
  };

  const validateImportData = (payload: Record<string, unknown>) => {
    const warnings: string[] = [];
    const invalidSummary = {} as Record<DatasetKey, number>;
    const data: Record<string, unknown> = { ...payload };

    const transactions = filterValidRows<Transaction>(payload.transactions, row =>
      typeof row.id === 'string'
      && typeof row.date === 'string'
      && typeof row.categoryId === 'string'
      && typeof row.type === 'string'
      && Number.isFinite(row.amount)
    );
    data.transactions = transactions.valid;
    invalidSummary.transactions = transactions.invalid;

    const deposits = filterValidRows<Deposit>(payload.deposits, row =>
      typeof row.id === 'string'
      && Number.isFinite(row.principal)
      && typeof row.startDate === 'string'
    );
    data.deposits = deposits.valid;
    invalidSummary.deposits = deposits.invalid;

    const accounts = filterValidRows<Account>(payload.accounts, row =>
      typeof row.id === 'string'
      && typeof row.name === 'string'
      && typeof row.type === 'string'
      && Number.isFinite(row.openingBalance)
      && Number.isFinite(row.currentBalance)
      && typeof row.isAsset === 'boolean'
    );
    data.accounts = accounts.valid;
    invalidSummary.accounts = accounts.invalid;

    const categories = filterValidRows<Category>(payload.categories, row =>
      typeof row.id === 'string'
      && typeof row.name === 'string'
      && typeof row.type === 'string'
    );
    data.categories = categories.valid;
    invalidSummary.categories = categories.invalid;

    const funds = filterValidRows<FundTransaction>(payload.funds, row =>
      typeof row.id === 'string'
      && typeof row.fund === 'string'
      && typeof row.date === 'string'
      && Number.isFinite(row.units)
      && Number.isFinite(row.price)
    );
    data.funds = funds.valid;
    invalidSummary.funds = funds.invalid;

    const fundPrices = filterValidRows<FundHoldingMeta>(payload.fundPrices, row =>
      typeof row.fund === 'string'
      && Number.isFinite(row.currentPrice)
    );
    data.fundPrices = fundPrices.valid;
    invalidSummary.fundPrices = fundPrices.invalid;

    datasetKeys.forEach(key => {
      const invalidCount = invalidSummary[key] ?? 0;
      if (invalidCount > 0) {
        warnings.push(`${t(datasetLabels[key], language)}: ${invalidCount} ${t('Invalid', language)} ${t('rows', language)}`);
      }
    });

    return { data, warnings, invalidSummary };
  };

  const handleApplyImport = () => {
    if (!importPayload) return;
    const data = importPayload.data;

    const incomingTransactions = (data.transactions ?? []) as Transaction[];
    const incomingDeposits = (data.deposits ?? []) as Deposit[];
    const incomingAccounts = (data.accounts ?? []) as Account[];
    const incomingCategories = (data.categories ?? []) as Category[];
    const incomingFunds = (data.funds ?? []) as FundTransaction[];
    const incomingFundPrices = (data.fundPrices ?? []) as FundHoldingMeta[];
    const incomingOwners = normalizeStringList(data.owners);
    const incomingSpenders = normalizeStringList(data.spenders);

    if (importSelection.transactions) {
      if (importMode === 'replace') setTransactions(incomingTransactions);
      else setTransactions(mergeById(state.transactions, incomingTransactions));
    }

    if (importSelection.deposits) {
      if (importMode === 'replace') setDeposits(incomingDeposits);
      else setDeposits(mergeById(state.deposits, incomingDeposits));
    }

    if (importSelection.accounts) {
      if (importMode === 'replace') setAccounts(incomingAccounts);
      else setAccounts(mergeAccounts(state.accounts, incomingAccounts));
    }

    if (importSelection.categories) {
      if (importMode === 'replace') setCategories(incomingCategories);
      else setCategories(mergeCategories(state.categories, incomingCategories));
    }

    if (importSelection.funds) {
      if (importMode === 'replace') setFundTransactions(incomingFunds);
      else setFundTransactions(mergeById(state.fundTransactions, incomingFunds));
    }

    if (importSelection.fundPrices) {
      if (importMode === 'replace') setFundHoldingsMeta(incomingFundPrices);
      else setFundHoldingsMeta(mergeFundPrices(state.fundHoldingsMeta, incomingFundPrices));
    }

    if (importSelection.owners) {
      if (importMode === 'replace') updateSettings({ owners: incomingOwners });
      else updateSettings({ owners: Array.from(new Set([...(state.settings.owners ?? []), ...incomingOwners])) });
    }

    if (importSelection.spenders) {
      if (importMode === 'replace') updateSettings({ familyMembers: incomingSpenders });
      else updateSettings({ familyMembers: Array.from(new Set([...state.settings.familyMembers, ...incomingSpenders])) });
    }

    updateBackupMeta({ lastImportAt: new Date().toISOString(), version: importPayload.version ?? 1 });
    setDataMessageType('success');
    setDataMessage(t('Import completed.', language));
    setIsImportOpen(false);
  };

  const handleApplyFullRestore = () => {
    if (!fullRestorePayload) return;
    const selectedKeys = Object.entries(fullRestoreSelection).filter(([, selected]) => selected);
    if (selectedKeys.length === 0) return;

    const incoming = fullRestorePayload.fullState;
    const mergedState: BudgetState = {
      ...state,
      transactions: fullRestoreSelection.transactions ? incoming.transactions : state.transactions,
      deposits: fullRestoreSelection.deposits ? incoming.deposits : state.deposits,
      accounts: fullRestoreSelection.accounts ? incoming.accounts : state.accounts,
      categories: fullRestoreSelection.categories ? incoming.categories : state.categories,
      fundTransactions: fullRestoreSelection.funds ? incoming.fundTransactions : state.fundTransactions,
      fundHoldingsMeta: fullRestoreSelection.fundPrices ? incoming.fundHoldingsMeta : state.fundHoldingsMeta,
      debts: fullRestoreSelection.debts ? incoming.debts : state.debts,
      savingsGoals: fullRestoreSelection.savingsGoals ? incoming.savingsGoals : state.savingsGoals,
      recurringTransactions: fullRestoreSelection.recurringTransactions ? incoming.recurringTransactions : state.recurringTransactions,
      wealthSnapshots: fullRestoreSelection.wealthSnapshots ? incoming.wealthSnapshots : state.wealthSnapshots,
    };

    const ok = restoreState(mergedState);
    if (!ok) {
      setFullRestoreError(t('Invalid backup file structure.', language));
      return;
    }
    updateBackupMeta({ lastImportAt: new Date().toISOString(), version: fullRestorePayload.version ?? 1 });
    setDataMessageType('success');
    setDataMessage(t('Backup restored successfully.', language));
    setIsFullRestoreOpen(false);
    setFullRestorePayload(null);
  };

  const handleAddMember = () => {
    if (newMember.trim()) {
      updateSettings({ familyMembers: [...state.settings.familyMembers, newMember.trim()] });
      setNewMember('');
    }
  };

  const handleRemoveMember = (member: string) => {
    updateSettings({ familyMembers: state.settings.familyMembers.filter(m => m !== member) });
  };

  const handleAddCategory = () => {
    if (newCategory.name.trim()) {
      addCategory({
        id: generateId(),
        name: newCategory.name.trim(),
        type: newCategory.type,
        classification: newCategory.type === 'expense' ? newCategory.classification : 'none',
        color: newCategory.color,
      });
      setNewCategory({ name: '', type: 'expense', color: '#3b82f6', classification: 'none' });
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category.id);
    setEditData({ name: category.name, color: category.color, classification: category.classification });
  };

  const saveEdit = (id: string) => {
    if (editData.name?.trim()) {
      const category = state.categories.find(c => c.id === id);
      if (category?.type === 'income') {
        updateCategory(id, { ...editData, classification: 'none' });
      } else {
        updateCategory(id, editData);
      }
    }
    setEditingCategory(null);
    setEditData({});
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditData({});
  };

  const incomeCategories = state.categories.filter(c => c.type === 'income');
  const expenseCategories = state.categories.filter(c => c.type === 'expense');
  const classificationLabel = (value?: CategoryClassification) => {
    if (value === 'needs') return t('Needs', language);
    if (value === 'wants') return t('Wants', language);
    if (value === 'savings') return t('Savings', language);
    return t('Other', language);
  };

  const classificationBadge = (value?: CategoryClassification) => {
    const label = classificationLabel(value);
    const colorClass = value === 'needs'
      ? 'bg-amber-100 text-amber-800'
      : value === 'wants'
        ? 'bg-purple-100 text-purple-800'
        : value === 'savings'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-gray-100 text-gray-700';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('Setup & Configuration', language)}
          <BreadcrumbInline />
        </h1>
        <p className="text-gray-600">{t('Configure your budget settings and customize categories', language)}</p>
      </div>

      {/* Getting Started */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('Getting Started', language)}</h2>
          <p className="text-sm text-gray-600">{t('Complete the basics to personalize your plan.', language)}</p>
        </div>
        <div className="space-y-2">
          {onboardingSteps.map(step => (
            <div key={step.label} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-800">{step.label}</span>
              </div>
              {step.to && (
                <Link
                  to={step.to}
                  className="text-xs text-emerald-700 hover:underline"
                >
                  {t('Go', language)}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Basic Settings */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">{t('Basic Settings', language)}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Currency Symbol', language)} *
            </label>
            <select
              value={draftSettings.currency}
              onChange={(e) => setDraftSettings({ ...draftSettings, currency: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {currencies.map(curr => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Budget Start Month', language)} *
            </label>
            <select
              value={draftSettings.startMonth}
              onChange={(e) => setDraftSettings({ ...draftSettings, startMonth: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {monthNames.map((month, idx) => (
                <option key={idx} value={idx}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Budget Start Year', language)} *
            </label>
            <UnitsInput
              value={draftSettings.startYear}
              onValueChange={(value) => setDraftSettings({ ...draftSettings, startYear: Math.max(0, Math.round(value)) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Budget Method', language)} *
            </label>
            <select
              value={draftSettings.budgetMethod}
              onChange={(e) => setDraftSettings({ ...draftSettings, budgetMethod: e.target.value as 'zero-based' | 'carryover' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="zero-based">{t('Zero-Based (Every dollar assigned)', language)}</option>
              <option value="carryover">{t('Carryover (Roll over surplus)', language)}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Language', language)}
            </label>
            <select
              value={draftSettings.language}
              onChange={(e) => setDraftSettings({ ...draftSettings, language: e.target.value as 'en' | 'tr' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="en">{t('English', language)}</option>
              <option value="tr">{t('Turkish', language)}</option>
            </select>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-sm text-blue-900">
            <strong>{t('Zero-Based:', language)}</strong> {t('Assign every dollar a purpose each month. Budget equals income.', language)}
            <br />
            <strong>{t('Carryover:', language)}</strong> {t('Unspent money carries over to the next month.', language)}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={applySettings}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            {t('Apply Settings', language)}
          </button>
        </div>
      </div>

      {/* Family Members */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{t('Family Members / Spenders', language)}</h2>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
            placeholder={t('Add family member name...', language)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            onClick={handleAddMember}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('Add', language)}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {state.settings.familyMembers.map((member, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full"
            >
              <span>{member}</span>
              {state.settings.familyMembers.length > 1 && (
                <button
                  onClick={() => handleRemoveMember(member)}
                  className="hover:bg-emerald-200 rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Income Categories */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{t('Income Categories', language)}</h2>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 text-xs font-semibold text-gray-500 uppercase">
            <span className="w-10"></span>
            <span className="flex-1">{t('Category Name', language)}</span>
            <span className="w-28">{t('Type', language)}</span>
            <span className="w-20 text-right">{t('Actions', language)}</span>
          </div>
          {incomeCategories.map(category => (
            <div key={category.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              {editingCategory === category.id ? (
                <>
                  <input
                    type="color"
                    value={editData.color || category.color}
                    onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    autoFocus
                  />
                  <div className="w-28">{classificationBadge(category.classification)}</div>
                  <button onClick={() => saveEdit(category.id)} className="p-2 text-green-600 hover:bg-green-50 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEdit} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded" style={{ backgroundColor: category.color }}></div>
                  <span className="flex-1 font-medium">{category.name}</span>
                  <div className="w-28">{classificationBadge(category.classification)}</div>
                  <button onClick={() => startEdit(category)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCategory(category.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <input
            type="color"
            value={newCategory.type === 'income' ? newCategory.color : '#10b981'}
            onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer"
            disabled={newCategory.type !== 'income'}
          />
          <input
            type="text"
            value={newCategory.type === 'income' ? newCategory.name : ''}
            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value, type: 'income', classification: 'none' })}
            onKeyPress={(e) => e.key === 'Enter' && newCategory.type === 'income' && handleAddCategory()}
            placeholder={t('New income category...', language)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            onClick={() => {
              setNewCategory({ ...newCategory, type: 'income', classification: 'none' });
              handleAddCategory();
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('Add Income', language)}
          </button>
        </div>
      </div>

      {/* Expense Categories */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{t('Expense Categories', language)}</h2>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 text-xs font-semibold text-gray-500 uppercase">
            <span className="w-10"></span>
            <span className="flex-1">{t('Category Name', language)}</span>
            <span className="w-28">{t('Type', language)}</span>
            <span className="w-20 text-right">{t('Actions', language)}</span>
          </div>
          {expenseCategories.map(category => (
            <div key={category.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              {editingCategory === category.id ? (
                <>
                  <input
                    type="color"
                    value={editData.color || category.color}
                    onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    autoFocus
                  />
                  <select
                    value={(editData.classification as CategoryClassification) || category.classification}
                    onChange={(e) => setEditData({ ...editData, classification: e.target.value as CategoryClassification })}
                    className="px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="needs">{t('Needs', language)}</option>
                    <option value="wants">{t('Wants', language)}</option>
                    <option value="savings">{t('Savings', language)}</option>
                    <option value="none">{t('Other', language)}</option>
                  </select>
                  <button onClick={() => saveEdit(category.id)} className="p-2 text-green-600 hover:bg-green-50 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEdit} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded" style={{ backgroundColor: category.color }}></div>
                  <span className="flex-1 font-medium">{category.name}</span>
                  <div className="w-28">{classificationBadge(category.classification)}</div>
                  <button onClick={() => startEdit(category)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCategory(category.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <input
            type="color"
            value={newCategory.type === 'expense' ? newCategory.color : '#ef4444'}
            onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer"
            disabled={newCategory.type !== 'expense'}
          />
          <input
            type="text"
            value={newCategory.type === 'expense' ? newCategory.name : ''}
            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value, type: 'expense' })}
            onKeyPress={(e) => e.key === 'Enter' && newCategory.type === 'expense' && handleAddCategory()}
            placeholder={t('New expense category...', language)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <select
            value={newCategory.type === 'expense' ? newCategory.classification : 'none'}
            onChange={(e) => setNewCategory({ ...newCategory, classification: e.target.value as CategoryClassification, type: 'expense' })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="needs">{t('Needs', language)}</option>
            <option value="wants">{t('Wants', language)}</option>
            <option value="savings">{t('Savings', language)}</option>
            <option value="none">{t('Other', language)}</option>
          </select>
          <button
            onClick={() => {
              setNewCategory({ ...newCategory, type: 'expense' });
              handleAddCategory();
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('Add Expense', language)}
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('Data Management', language)}</h2>
          <p className="text-sm text-gray-600">{t('Export or import backup data safely.', language)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('Export Data', language)}
          </button>
          <button
            onClick={handleFullExport}
            className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('Export Full Backup', language)}
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) handleImportFile(file);
            }}
          />
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t('Import Data', language)}
          </button>
          <input
            ref={fullImportFileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) handleFullImportFile(file);
            }}
          />
          <button
            onClick={() => fullImportFileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t('Restore Full Backup', language)}
          </button>
        </div>
        {(backupMeta.lastExportAt || backupMeta.lastImportAt) && (
          <div className="text-xs text-gray-500">
            {backupMeta.lastExportAt && (
              <div>{t('Last export', language)}: {backupMeta.lastExportAt}</div>
            )}
            {backupMeta.lastImportAt && (
              <div>{t('Last import', language)}: {backupMeta.lastImportAt}</div>
            )}
            {backupMeta.version && (
              <div>{t('Backup version', language)}: {backupMeta.version}</div>
            )}
          </div>
        )}
        {dataMessage && (
          <div className={`text-sm ${dataMessageType === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
            {dataMessage}
          </div>
        )}
        {importError && (
          <div className="text-sm text-red-600">{importError}</div>
        )}
        {fullRestoreError && (
          <div className="text-sm text-red-600">{fullRestoreError}</div>
        )}
      </div>

      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Export Data', language)}</DialogTitle>
            <DialogDescription>{t('What would you like to export?', language)}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <button
              onClick={() => selectAll(setExportSelection, datasetKeys)}
              className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              {t('Select All', language)}
            </button>
            <button
              onClick={() => clearAll(setExportSelection, datasetKeys)}
              className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              {t('Clear All', language)}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {datasetKeys.map(key => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exportSelection[key]}
                  onChange={(e) => setExportSelection({ ...exportSelection, [key]: e.target.checked })}
                />
                <span>{t(datasetLabels[key], language)}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <button
              onClick={() => setIsExportOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('Cancel', language)}
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              {t('Export', language)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Import Data', language)}</DialogTitle>
            <DialogDescription>{t('What would you like to import?', language)}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <button
              onClick={() => selectAll(setImportSelection, importAvailable)}
              className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              disabled={importAvailable.length === 0}
            >
              {t('Select All', language)}
            </button>
            <button
              onClick={() => clearAll(setImportSelection, importAvailable)}
              className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              disabled={importAvailable.length === 0}
            >
              {t('Clear All', language)}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {importAvailable.map(key => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={importSelection[key]}
                  onChange={(e) => setImportSelection({ ...importSelection, [key]: e.target.checked })}
                />
                <span>{t(datasetLabels[key], language)}</span>
              </label>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700">
            {importAvailable.map(key => (
              <div key={key}>
                {t(datasetLabels[key], language)}: {importSummary[key] ?? 0} {t('rows', language)}
              </div>
            ))}
          </div>
          {importWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1">
              <div className="font-medium">{t('Import Warnings', language)}</div>
              {importWarnings.map((warning, index) => (
                <div key={`${warning}-${index}`}>{warning}</div>
              ))}
            </div>
          )}
          <div className="text-sm">
            <div className="font-medium mb-2">{t('Import Mode', language)}</div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                />
                {t('Merge', language)}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                />
                {t('Replace Selected', language)}
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <button
              onClick={() => setIsImportOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('Cancel', language)}
            </button>
            <button
              onClick={handleApplyImport}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              {t('Apply Import', language)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFullRestoreOpen} onOpenChange={setIsFullRestoreOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Restore Full Backup', language)}</DialogTitle>
            <DialogDescription>
              {t('Select which datasets to restore. Unselected data will remain unchanged.', language)}
            </DialogDescription>
          </DialogHeader>
          {fullRestorePayload && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700">
                {t('Exported At', language)}: {fullRestorePayload.exportedAt || '-'}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{t('Datasets', language)}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const next = Object.keys(fullRestoreSelection).reduce((acc, key) => {
                        acc[key] = true;
                        return acc;
                      }, {} as Record<string, boolean>);
                      setFullRestoreSelection(next);
                    }}
                    className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    {t('Select All', language)}
                  </button>
                  <button
                    onClick={() => {
                      const next = Object.keys(fullRestoreSelection).reduce((acc, key) => {
                        acc[key] = false;
                        return acc;
                      }, {} as Record<string, boolean>);
                      setFullRestoreSelection(next);
                    }}
                    className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    {t('Clear All', language)}
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 space-y-2">
                {fullRestoreDatasets.map(dataset => {
                  const count = fullRestoreSummary[dataset.key] ?? 0;
                  const available = fullRestoreAvailable[dataset.key] ?? false;
                  const checked = fullRestoreSelection[dataset.key] ?? false;
                  return (
                    <label key={dataset.key} className={`flex items-center justify-between gap-2 ${available ? '' : 'opacity-50'}`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!available}
                          onChange={() => {
                            setFullRestoreSelection(prev => ({ ...prev, [dataset.key]: !checked }));
                          }}
                        />
                        <span>{dataset.label}</span>
                      </div>
                      <span className="text-gray-500">{count}</span>
                    </label>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500">
                {t('Only selected datasets will be replaced.', language)}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <button
              onClick={() => setIsFullRestoreOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('Cancel', language)}
            </button>
            <button
              onClick={handleApplyFullRestore}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              disabled={!Object.values(fullRestoreSelection).some(Boolean)}
            >
              {t('Restore Selected', language)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
