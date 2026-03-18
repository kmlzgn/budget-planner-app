import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Plus, Trash2, Edit2, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { RecurringTransaction, TransactionFrequency } from '../types';
import { generateId } from '../utils/id';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { formatDateDisplay, t } from '../utils/i18n';
import { formatCurrency } from '../utils/formatting';

export function RecurringTransactions() {
  const { state, addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction } = useBudget();
  const language = state.settings.language;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const frequencies: { value: TransactionFrequency; label: string }[] = [
    { value: 'once', label: t('Once', language) },
    { value: 'weekly', label: t('Weekly', language) },
    { value: 'bi-weekly', label: t('Bi-weekly', language) },
    { value: 'monthly', label: t('Monthly', language) },
    { value: 'quarterly', label: t('Quarterly', language) },
    { value: 'annually', label: t('Annually', language) },
  ];
  const frequencyLabelByValue = new Map(frequencies.map(freq => [freq.value, freq.label]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<Partial<RecurringTransaction>>({
    name: '',
    amount: 0,
    categoryId: '',
    frequency: 'monthly',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'expense',
    isActive: true,
  });

  const handleSubmit = () => {
    if (formData.name && formData.amount && formData.categoryId && formData.startDate) {
      if (editingId) {
        updateRecurringTransaction(editingId, formData);
        setEditingId(null);
      } else {
        addRecurringTransaction({
          ...formData,
          id: generateId(),
        } as RecurringTransaction);
      }
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      amount: 0,
      categoryId: '',
      frequency: 'monthly',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      type: 'expense',
      isActive: true,
    });
    setEditingId(null);
  };

  const startEdit = (transaction: RecurringTransaction) => {
    setFormData(transaction);
    setEditingId(transaction.id);
  };

  const toggleActive = (id: string, isActive: boolean) => {
    updateRecurringTransaction(id, { isActive: !isActive });
  };

  const normalizeLookup = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

  const inferRecurringFrequency = (days: number): TransactionFrequency | null => {
    if (days >= 26 && days <= 35) return 'monthly';
    if (days >= 6 && days <= 9) return 'weekly';
    if (days >= 12 && days <= 18) return 'bi-weekly';
    if (days >= 80 && days <= 100) return 'quarterly';
    if (days >= 350 && days <= 380) return 'annually';
    return null;
  };

  const recurringSuggestions = (() => {
    const groups = new Map<string, typeof state.transactions>();
    state.transactions.forEach(transaction => {
      if (transaction.transactionKind === 'credit-card-payment') return;
      const descriptionKey = normalizeLookup(transaction.description || '');
      if (!descriptionKey) return;
      const key = `${descriptionKey}|${Math.abs(transaction.amount).toFixed(2)}|${transaction.type}`;
      const existing = groups.get(key);
      if (existing) existing.push(transaction);
      else groups.set(key, [transaction]);
    });

    const existingRecurringKeys = new Set(
      state.recurringTransactions.map(transaction =>
        `${normalizeLookup(transaction.name)}|${Math.abs(transaction.amount).toFixed(2)}|${transaction.type}`
      )
    );

    const suggestions: Array<{
      key: string;
      name: string;
      amount: number;
      type: 'income' | 'expense';
      frequency: TransactionFrequency;
      startDate: string;
      categoryId: string;
      accountId?: string;
    }> = [];

    groups.forEach((items, key) => {
      if (items.length < 3) return;
      if (existingRecurringKeys.has(key)) return;
      if (dismissedSuggestions.has(key)) return;
      const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
      const deltas = sorted.slice(1).map((item, idx) =>
        Math.abs(differenceInCalendarDays(parseISO(item.date), parseISO(sorted[idx].date)))
      );
      if (deltas.length === 0) return;
      const median = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
      const frequency = inferRecurringFrequency(median);
      if (!frequency) return;
      const base = sorted[0];
      suggestions.push({
        key,
        name: base.description,
        amount: base.amount,
        type: base.type,
        frequency,
        startDate: base.date,
        categoryId: base.categoryId,
        accountId: base.accountId,
      });
    });

    return suggestions;
  })();

  const handleAddRecurringSuggestion = (suggestion: (typeof recurringSuggestions)[number]) => {
    addRecurringTransaction({
      id: generateId(),
      name: suggestion.name,
      amount: suggestion.amount,
      categoryId: suggestion.categoryId,
      frequency: suggestion.frequency,
      startDate: suggestion.startDate,
      type: suggestion.type,
      accountId: suggestion.accountId,
      isActive: true,
    });
    setDismissedSuggestions(prev => {
      const next = new Set(prev);
      next.add(suggestion.key);
      return next;
    });
  };

  const dismissSuggestion = (key: string) => {
    setDismissedSuggestions(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const incomeTransactions = state.recurringTransactions.filter(t =>
    t.type === 'income' && (filterCategoryId === 'all' || t.categoryId === filterCategoryId)
  );
  const expenseTransactions = state.recurringTransactions.filter(t =>
    t.type === 'expense' && (filterCategoryId === 'all' || t.categoryId === filterCategoryId)
  );

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
    return institution ? `${institution} • ${account.name}` : account.name;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('Recurring Transactions', language)}</h1>
        <p className="text-gray-600">{t('Manage automatic income, bills, subscriptions, and scheduled payments', language)}</p>
      </div>   

      {/* Add/Edit Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {editingId ? t('Edit Transaction', language) : t('Add Recurring Transaction', language)}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Name', language)} *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('e.g., Rent, Salary, Netflix', language)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Amount', language)} * ({state.settings.currency})</label>
            <input
              type="number"
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              step="0.01"
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
              {state.categories
                .filter(c => c.type === formData.type)
                .map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Frequency', language)}</label>
            <select
              value={formData.frequency || 'monthly'}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as TransactionFrequency })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {frequencies.map(freq => (
                <option key={freq.value} value={freq.value}>{freq.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Start Date', language)} *</label>
            <input
              type="date"
              value={formData.startDate || ''}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('End Date (Optional)', language)}</label>
            <input
              type="date"
              value={formData.endDate || ''}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account (Optional)', language)}</label>
            <select
              value={formData.accountId || ''}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">{t('No account', language)}</option>
              {state.accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{getAccountLabel(acc.id)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? t('Update', language) : t('Add Transaction', language)}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('Cancel', language)}
            </button>
          )}
        </div>
      </div>

      {/* Income Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Recurring Income', language)}</h2>
        <div className="space-y-2">
          {incomeTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('No recurring income added yet', language)}</p>
          ) : (
            incomeTransactions.map(transaction => (
              <div
                key={transaction.id}
                className={`flex items-center gap-3 p-4 rounded-lg border ${
                  transaction.isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div
                  className="w-1 h-12 rounded"
                  style={{ backgroundColor: getCategoryColor(transaction.categoryId) }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{transaction.name}</div>
                  <div className="text-sm text-gray-600">
                    {getCategoryName(transaction.categoryId)} • {frequencies.find(f => f.value === transaction.frequency)?.label}
                    {' '} • {t('Starts', language)} {formatDateDisplay(new Date(transaction.startDate), language)}
                    {transaction.endDate && ` • ${t('Ends', language)} ${formatDateDisplay(new Date(transaction.endDate), language)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600 text-lg">
                    +{state.settings.currency}{transaction.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-green-700">{t('Money In', language)}</div>
                </div>
                <button
                  onClick={() => toggleActive(transaction.id, transaction.isActive)}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                  title={transaction.isActive ? t('Deactivate', language) : t('Activate', language)}
                >
                  {transaction.isActive ? (
                    <ToggleRight className="w-5 h-5 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => startEdit(transaction)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteRecurringTransaction(transaction.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Expense Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Recurring Expenses', language)}</h2>
        <div className="space-y-2">
          {expenseTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('No recurring expenses added yet', language)}</p>
          ) : (
            expenseTransactions.map(transaction => (
              <div
                key={transaction.id}
                className={`flex items-center gap-3 p-4 rounded-lg border ${
                  transaction.isActive ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div
                  className="w-1 h-12 rounded"
                  style={{ backgroundColor: getCategoryColor(transaction.categoryId) }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{transaction.name}</div>
                  <div className="text-sm text-gray-600">
                    {getCategoryName(transaction.categoryId)} • {frequencies.find(f => f.value === transaction.frequency)?.label}
                    {' '} • {t('Starts', language)} {formatDateDisplay(new Date(transaction.startDate), language)}
                    {transaction.endDate && ` • ${t('Ends', language)} ${formatDateDisplay(new Date(transaction.endDate), language)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600 text-lg">
                    -{state.settings.currency}{transaction.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-red-700">{t('Money Out', language)}</div>
                </div>
                <button
                  onClick={() => toggleActive(transaction.id, transaction.isActive)}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                  title={transaction.isActive ? t('Deactivate', language) : t('Activate', language)}
                >
                  {transaction.isActive ? (
                    <ToggleRight className="w-5 h-5 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => startEdit(transaction)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteRecurringTransaction(transaction.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {recurringSuggestions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">{t('Recurring Suggestions', language)}</div>
            <div className="text-xs text-gray-500">{t('Based on transaction history', language)}</div>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {recurringSuggestions.map(suggestion => (
              <div key={suggestion.key} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2">
                <div className="text-gray-700">
                  <span className="font-medium">{suggestion.name}</span> | {formatCurrency(suggestion.amount, state.settings.currency, locale)} | {frequencyLabelByValue.get(suggestion.frequency)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddRecurringSuggestion(suggestion)}
                    className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    {t('Add to Recurring', language)}
                  </button>
                  <button
                    onClick={() => dismissSuggestion(suggestion.key)}
                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    {t('Dismiss', language)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}






