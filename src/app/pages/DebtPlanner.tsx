import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Plus, Trash2, Edit2, Check, TrendingDown } from 'lucide-react';
import { Account, Debt, DebtInstallment, DebtStrategy, TransactionFrequency } from '../types';
import { generateId } from '../utils/id';
import { buildDebtInstallments, calculateDebtPayoffTimeline, calculateInstallmentAmount } from '../utils/budgetCalculations';
import { formatDateDisplay, t } from '../utils/i18n';
import { formatCurrency } from '../utils/formatting';

export function DebtPlanner() {
  const { state, addDebt, updateDebt, deleteDebt, addTransaction, deleteTransaction } = useBudget();
  const language = state.settings.language;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const installmentFrequencies: { value: TransactionFrequency; label: string }[] = [
    { value: 'once', label: t('Once', language) },
    { value: 'weekly', label: t('Weekly', language) },
    { value: 'bi-weekly', label: t('Bi-weekly', language) },
    { value: 'monthly', label: t('Monthly', language) },
    { value: 'quarterly', label: t('Quarterly', language) },
    { value: 'annually', label: t('Annually', language) },
  ];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openDebtId, setOpenDebtId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<DebtStrategy>('snowball');
  const [extraPayment, setExtraPayment] = useState(0);
  const [monthlyInterestRateInput, setMonthlyInterestRateInput] = useState('');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const expenseCategories = state.categories.filter(c => c.type === 'expense');
  const defaultPaymentCategoryId = expenseCategories.find(c => c.name === 'Debt Payment')?.id ?? expenseCategories[0]?.id;
  const paymentAccounts = state.accounts.filter(account => account.isAsset && account.type !== 'credit-card');
  const getAccountLabel = (account: Account) =>
    account.institution ? `${account.institution} • ${account.name}` : account.name;
  const [formData, setFormData] = useState<Partial<Debt>>({
    name: '',
    totalAmount: 0,
    currentBalance: 0,
    interestRate: 0,
    minimumPayment: 0,
    alreadyPaidAmount: 0,
    alreadyPaidInstallments: 0,
    oneTimeFee: 0,
    oneTimeFeeNote: '',
    accountId: '',
    installmentFrequency: 'monthly',
    installmentCount: 0,
    installmentAmount: 0,
  });
  const decimalSeparator = locale.startsWith('tr') ? ',' : '.';
  const groupSeparator = locale.startsWith('tr') ? '.' : ',';
  const parseLocaleNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = locale.startsWith('tr')
      ? trimmed.replace(/\./g, '').replace(/,/g, '.')
      : trimmed.replace(/,/g, '');
    const cleaned = normalized.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatGroupedInteger = (digits: string) => {
    if (!digits) return '';
    const numberValue = Number(digits);
    if (!Number.isFinite(numberValue)) return digits;
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(numberValue);
  };
  const formatMoneyTyping = (raw: string) => {
    const sanitized = raw.replace(new RegExp(`[^0-9${decimalSeparator}\\.\\-]`, 'g'), '');
    const hasDot = sanitized.includes('.');
    const hasComma = sanitized.includes(',');
    const decimalIndex = Math.max(sanitized.lastIndexOf('.'), sanitized.lastIndexOf(','));
    const sign = sanitized.startsWith('-') ? '-' : '';
    const integerRaw = (decimalIndex >= 0 ? sanitized.slice(0, decimalIndex) : sanitized).replace(/[^0-9]/g, '');
    const fractionalRaw = decimalIndex >= 0 ? sanitized.slice(decimalIndex + 1).replace(/[^0-9]/g, '') : '';
    const groupedInt = formatGroupedInteger(integerRaw);
    if (decimalIndex >= 0 || (hasDot || hasComma)) {
      return `${sign}${groupedInt}${decimalSeparator}${fractionalRaw}`;
    }
    return `${sign}${groupedInt}`;
  };
  const normalizeMoneyOnBlur = (value: number) => formatMoneyValue(value);
  const normalizeRateOnBlur = (value: number) => (value ? formatRateValue(value) : '');
  const monthlyRateValue = parseLocaleNumber(monthlyInterestRateInput);
  const formatMoneyValue = (value: number) =>
    formatCurrency(value, state.settings.currency, locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      hideDecimalsThreshold: Infinity,
    });
  const formatRateValue = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const setInputValue = (key: string, value: string) =>
    setInputValues(prev => ({ ...prev, [key]: value }));
  const getInputValue = (key: string, fallback: number, formatter: (value: number) => string) =>
    inputValues[key] ?? formatter(fallback);
  const getPeriodicRatePercent = (monthlyRatePercent: number, frequency: TransactionFrequency) => {
    if (monthlyRatePercent <= 0) return 0;
    if (frequency === 'monthly') return monthlyRatePercent;
    const monthlyRate = monthlyRatePercent / 100;
    const annualRate = Math.pow(1 + monthlyRate, 12) - 1;
    const periods =
      frequency === 'weekly' ? 52 :
      frequency === 'bi-weekly' ? 26 :
      frequency === 'quarterly' ? 4 :
      frequency === 'annually' ? 1 :
      12;
    const periodRate = Math.pow(1 + annualRate, 1 / periods) - 1;
    return periodRate * 100;
  };

  const handleSubmit = () => {
    const name = formData.name?.trim() || '';
    const totalAmount = Number.isFinite(formData.totalAmount) ? (formData.totalAmount as number) : 0;
    const alreadyPaidAmount = Number.isFinite(formData.alreadyPaidAmount)
      ? (formData.alreadyPaidAmount as number)
      : 0;
    const alreadyPaidInstallments = Number.isFinite(formData.alreadyPaidInstallments)
      ? (formData.alreadyPaidInstallments as number)
      : 0;
    const principal = Math.max(0, totalAmount);
    const currentBalanceValue = Number.isFinite(formData.currentBalance)
      ? (formData.currentBalance as number)
      : totalAmount;
    if (!name || totalAmount <= 0) return;

    const installmentFrequency = formData.installmentFrequency ?? 'monthly';
    const installmentCount = formData.installmentCount ?? 0;
    const periodicRate = getPeriodicRatePercent(monthlyRateValue, installmentFrequency);
    const calculatedInstallment = calculateInstallmentAmount(principal, periodicRate, installmentCount);
    const manualInstallment = Number.isFinite(formData.installmentAmount)
      ? (formData.installmentAmount as number)
      : 0;
    const installmentAmount = manualInstallment > 0
      ? manualInstallment
      : (installmentCount > 0 ? calculatedInstallment : (formData.minimumPayment ?? 0));
    const remainingAfterInstallments = Math.max(
      0,
      principal - alreadyPaidAmount - (alreadyPaidInstallments * installmentAmount)
    );
    const currentBalance = currentBalanceValue > 0 ? currentBalanceValue : remainingAfterInstallments;
    const installments = buildDebtInstallments(
      formData.installmentStartDate,
      installmentCount,
      installmentAmount,
      installmentFrequency,
      formData.installments ?? []
    );
    const annualRate = monthlyRateValue * 12;
    const paymentCategoryId = formData.paymentCategoryId ?? defaultPaymentCategoryId;
    const payload: Partial<Debt> = {
      ...formData,
      name,
      totalAmount,
      currentBalance,
      interestRate: annualRate,
      minimumPayment: formData.minimumPayment ?? 0,
      alreadyPaidAmount,
      alreadyPaidInstallments,
      oneTimeFee: formData.oneTimeFee ?? 0,
      oneTimeFeeNote: formData.oneTimeFeeNote ?? '',
      accountId: formData.accountId || undefined,
      paymentCategoryId: paymentCategoryId || undefined,
      installmentFrequency,
      installmentCount,
      installmentAmount,
      installments,
    };

    if (editingId) {
      updateDebt(editingId, payload);
      setEditingId(null);
    } else {
      addDebt({
        ...payload,
        id: generateId(),
      } as Debt);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      totalAmount: 0,
      currentBalance: 0,
      interestRate: 0,
      minimumPayment: 0,
      alreadyPaidAmount: 0,
      alreadyPaidInstallments: 0,
      oneTimeFee: 0,
      oneTimeFeeNote: '',
      accountId: '',
      paymentCategoryId: defaultPaymentCategoryId,
      installmentStartDate: '',
      installmentFrequency: 'monthly',
      installmentCount: 0,
      installmentAmount: 0,
      installments: [],
    });
    setMonthlyInterestRateInput('');
    setInputValues({
      totalAmount: formatMoneyValue(0),
      currentBalance: formatMoneyValue(0),
      minimumPayment: formatMoneyValue(0),
      installmentAmount: formatMoneyValue(0),
      alreadyPaidAmount: formatMoneyValue(0),
      oneTimeFee: formatMoneyValue(0),
    });
    setEditingId(null);
  };

  const startEdit = (debt: Debt) => {
    setFormData(debt);
    const monthly = debt.interestRate ? debt.interestRate / 12 : 0;
    setMonthlyInterestRateInput(monthly ? formatRateValue(monthly) : '');
    setInputValues({
      totalAmount: formatMoneyValue(debt.totalAmount ?? 0),
      currentBalance: formatMoneyValue(debt.currentBalance ?? 0),
      minimumPayment: formatMoneyValue(debt.minimumPayment ?? 0),
      installmentAmount: formatMoneyValue(debt.installmentAmount ?? 0),
      alreadyPaidAmount: formatMoneyValue(debt.alreadyPaidAmount ?? 0),
      oneTimeFee: formatMoneyValue(debt.oneTimeFee ?? 0),
    });
    setEditingId(debt.id);
  };

  const getDebtSchedule = (debt: Debt): DebtInstallment[] => {
    const count = debt.installmentCount ?? 0;
    const amount = debt.installmentAmount ?? debt.minimumPayment;
    const frequency = debt.installmentFrequency ?? 'monthly';
    return buildDebtInstallments(debt.installmentStartDate, count, amount, frequency, debt.installments ?? []);
  };

  const toggleInstallmentPayment = (debt: Debt, installment: DebtInstallment) => {
    const existingTransaction = state.transactions.find(
      t => t.debtId === debt.id && t.installmentId === installment.id
    );
    let transactionId = installment.transactionId ?? existingTransaction?.id;
    const categoryId = debt.paymentCategoryId || defaultPaymentCategoryId;
    const paymentAccountId = debt.accountId;
    const isPaying = installment.status !== 'paid';

    if (isPaying && !paymentAccountId) return;

    if (isPaying && !existingTransaction && !transactionId && categoryId) {
      const newTransactionId = generateId();
      const paymentAccount = paymentAccountId ? state.accounts.find(a => a.id === paymentAccountId) : undefined;
      const accountCurrency = paymentAccount?.currency ?? state.settings.currency;
      const fxRateToBase = accountCurrency === state.settings.currency ? 1 : (paymentAccount?.exchangeRate ?? 1);
      const accountAmount = installment.amount;
      const baseAmountValue = accountCurrency === state.settings.currency ? accountAmount : accountAmount * fxRateToBase;
      addTransaction({
        id: newTransactionId,
        date: installment.dueDate,
        amount: baseAmountValue,
        baseAmount: baseAmountValue,
        accountAmount,
        accountCurrency,
        fxRateToBase,
        categoryId,
        accountId: paymentAccountId,
        description: `Debt payment - ${debt.name}`,
        type: 'expense',
        debtId: debt.id,
        installmentId: installment.id,
      });
      transactionId = newTransactionId;
    } else if (!isPaying && existingTransaction) {
      deleteTransaction(existingTransaction.id);
      transactionId = undefined;
    }

    const schedule = getDebtSchedule(debt);
    const updatedInstallments = schedule.map(i =>
      i.id === installment.id
        ? { ...i, status: isPaying ? 'paid' : 'pending', transactionId }
        : i
    );
    const newBalance = Math.max(
      0,
      (debt.currentBalance || 0) + (isPaying ? -installment.amount : installment.amount)
    );
    updateDebt(debt.id, { installments: updatedInstallments, currentBalance: newBalance });
  };

  const previewTotalAmount = Number.isFinite(formData.totalAmount)
    ? (formData.totalAmount as number)
    : 0;
  const previewPaidAmount = Number.isFinite(formData.alreadyPaidAmount)
    ? (formData.alreadyPaidAmount as number)
    : 0;
  const previewPaidInstallments = Number.isFinite(formData.alreadyPaidInstallments)
    ? (formData.alreadyPaidInstallments as number)
    : 0;
  const previewPrincipal = Math.max(0, previewTotalAmount);
  const previewInstallmentCount = formData.installmentCount ?? 0;
  const previewManualInstallment = Number.isFinite(formData.installmentAmount)
    ? (formData.installmentAmount as number)
    : 0;
  const previewComputedInstallment = previewInstallmentCount > 0
    ? calculateInstallmentAmount(
        previewPrincipal,
        getPeriodicRatePercent(monthlyRateValue, formData.installmentFrequency ?? 'monthly'),
        previewInstallmentCount
      )
    : 0;
  const previewInstallmentAmount = previewManualInstallment > 0
    ? previewManualInstallment
    : (previewInstallmentCount > 0 ? previewComputedInstallment : formData.minimumPayment ?? 0);
  const previewRemainingBalance = Math.max(
    0,
    previewPrincipal - previewPaidAmount - (previewPaidInstallments * previewInstallmentAmount)
  );
  const previewMonthlyInterest = previewRemainingBalance * (monthlyRateValue / 100);
  const previewOneTimeFee = formData.oneTimeFee ?? 0;
  const previewTotalRepayment = previewInstallmentCount > 0 && previewInstallmentAmount > 0
    ? (previewInstallmentAmount * previewInstallmentCount) + previewOneTimeFee
    : previewRemainingBalance + previewOneTimeFee;

  const debtsForTimeline = state.debts.map(debt => {
    const paidAmount = debt.alreadyPaidAmount ?? 0;
    const paidInstallments = debt.alreadyPaidInstallments ?? 0;
    const installmentAmount = debt.installmentAmount ?? debt.minimumPayment ?? 0;
    const fallbackBalance = Math.max(
      0,
      (debt.totalAmount || 0) - paidAmount - (paidInstallments * installmentAmount)
    );
    const shouldFallback = debt.currentBalance <= 0 && debt.totalAmount > 0;
    return {
      ...debt,
      currentBalance: shouldFallback ? fallbackBalance : debt.currentBalance,
    };
  });
  const payoffTimeline = calculateDebtPayoffTimeline(debtsForTimeline, strategy, extraPayment);
  const totalDebt = debtsForTimeline.reduce((sum, d) => sum + d.currentBalance, 0);
  const totalMinimumPayments = debtsForTimeline.reduce((sum, d) => sum + d.minimumPayment, 0);
  const totalInterestPaid = payoffTimeline.reduce((sum, t) => sum + t.totalInterest, 0);
  const monthsToDebtFree = Math.max(...payoffTimeline.map(t => t.monthsToPayoff));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('Debt Planner', language)}</h1>
        <p className="text-gray-600">{t('Strategize your debt payoff using Snowball or Avalanche method', language)}</p>
      </div>

      {/* Debt Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100">{t('Total Debt', language)}</span>
            <TrendingDown className="w-5 h-5 text-red-100" />
          </div>
          <div className="text-3xl font-bold">
            {formatMoneyValue(totalDebt)}
          </div>
          <div className="text-sm text-red-100 mt-1">
            {state.debts.length} {t('debts', language)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">{t('Min. Payments', language)}</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatMoneyValue(totalMinimumPayments)}
          </div>
          <div className="text-sm text-gray-600 mt-1">{t('per month', language)}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">{t('Est. Interest', language)}</div>
          <div className="text-2xl font-bold text-orange-600">
            {formatMoneyValue(totalInterestPaid)}
          </div>
          <div className="text-sm text-gray-600 mt-1">{t('total paid', language)}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">{t('Debt-Free In', language)}</div>
          <div className="text-2xl font-bold text-blue-600">
            {monthsToDebtFree < 500 ? `${monthsToDebtFree} ${t('months', language)}` : '∞'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {monthsToDebtFree < 500 ? `${(monthsToDebtFree / 12).toFixed(1)} ${t('years', language)}` : t('Never', language)}
          </div>
        </div>
      </div>

      {/* Add/Edit Debt Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {editingId ? t('Edit Debt', language) : t('Add Debt', language)}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Debt Name', language)} *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('e.g., Credit Card', language)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Total Amount', language)} * ({state.settings.currency})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={getInputValue('totalAmount', formData.totalAmount ?? 0, formatMoneyValue)}
              onFocus={() => setInputValue('totalAmount', formatMoneyTyping(getInputValue('totalAmount', formData.totalAmount ?? 0, formatMoneyValue)))}
              onBlur={() => setInputValue('totalAmount', normalizeMoneyOnBlur(formData.totalAmount ?? 0))}
              onChange={(e) => {
                const formatted = formatMoneyTyping(e.target.value);
                setInputValue('totalAmount', formatted);
                setFormData({ ...formData, totalAmount: parseLocaleNumber(e.target.value) });
              }}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Current Balance', language)} * ({state.settings.currency})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={getInputValue('currentBalance', formData.currentBalance ?? 0, formatMoneyValue)}
              onFocus={() => setInputValue('currentBalance', formatMoneyTyping(getInputValue('currentBalance', formData.currentBalance ?? 0, formatMoneyValue)))}
              onBlur={() => setInputValue('currentBalance', normalizeMoneyOnBlur(formData.currentBalance ?? 0))}
              onChange={(e) => {
                const formatted = formatMoneyTyping(e.target.value);
                setInputValue('currentBalance', formatted);
                setFormData({ ...formData, currentBalance: parseLocaleNumber(e.target.value) });
              }}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Monthly Interest Rate (%)', language)} *</label>
            <input
              type="text"
              inputMode="decimal"
              value={monthlyInterestRateInput}
              onFocus={() => setMonthlyInterestRateInput(monthlyRateValue ? String(monthlyRateValue) : '')}
              onBlur={() => setMonthlyInterestRateInput(normalizeRateOnBlur(monthlyRateValue))}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.,-]/g, '');
                const normalized = locale.startsWith('tr') ? raw.replace(/\./g, ',') : raw;
                setMonthlyInterestRateInput(normalized);
              }}
              placeholder={formatRateValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Min. Payment', language)} ({state.settings.currency})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={getInputValue('minimumPayment', formData.minimumPayment ?? 0, formatMoneyValue)}
              onFocus={() => setInputValue('minimumPayment', formatMoneyTyping(getInputValue('minimumPayment', formData.minimumPayment ?? 0, formatMoneyValue)))}
              onBlur={() => setInputValue('minimumPayment', normalizeMoneyOnBlur(formData.minimumPayment ?? 0))}
              onChange={(e) => {
                const formatted = formatMoneyTyping(e.target.value);
                setInputValue('minimumPayment', formatted);
                setFormData({ ...formData, minimumPayment: parseLocaleNumber(e.target.value) });
              }}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Payment Category', language)}</label>
            <select
              value={formData.paymentCategoryId || ''}
              onChange={(e) => setFormData({ ...formData, paymentCategoryId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">{t('Select category...', language)}</option>
              {expenseCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Payment Account', language)}</label>
            <select
              value={formData.accountId || ''}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">{t('Select account...', language)}</option>
              {paymentAccounts.map(account => (
                <option key={account.id} value={account.id}>{getAccountLabel(account)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Installment Start Date', language)}</label>
            <input
              type="date"
              value={formData.installmentStartDate || ''}
              onChange={(e) => setFormData({ ...formData, installmentStartDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Frequency', language)}</label>
            <select
              value={formData.installmentFrequency || 'monthly'}
              onChange={(e) => setFormData({ ...formData, installmentFrequency: e.target.value as TransactionFrequency })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {installmentFrequencies.map(freq => (
                <option key={freq.value} value={freq.value}>{freq.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Installment Count', language)}</label>
            <input
              type="number"
              value={formData.installmentCount || ''}
              onChange={(e) => {
                const count = parseInt(e.target.value, 10) || 0;
                const base = Math.max(
                  0,
                  formData.totalAmount || 0
                );
                const periodicRate = getPeriodicRatePercent(
                  monthlyRateValue,
                  formData.installmentFrequency ?? 'monthly'
                );
                const computedAmount = count > 0
                  ? calculateInstallmentAmount(base, periodicRate, count)
                  : 0;
                setFormData({
                  ...formData,
                  installmentCount: count,
                  installmentAmount: count > 0 ? computedAmount : formData.installmentAmount,
                });
                if (count > 0) {
                  setInputValue('installmentAmount', formatMoneyValue(computedAmount));
                }
              }}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Installment Amount', language)} ({state.settings.currency})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={getInputValue('installmentAmount', formData.installmentAmount ?? 0, formatMoneyValue)}
              onFocus={() => setInputValue('installmentAmount', formatMoneyTyping(getInputValue('installmentAmount', formData.installmentAmount ?? 0, formatMoneyValue)))}
              onBlur={() => setInputValue('installmentAmount', normalizeMoneyOnBlur(formData.installmentAmount ?? 0))}
              onChange={(e) => {
                const formatted = formatMoneyTyping(e.target.value);
                setInputValue('installmentAmount', formatted);
                setFormData({ ...formData, installmentAmount: parseLocaleNumber(e.target.value) });
              }}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Already Paid Amount', language)} ({state.settings.currency})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={getInputValue('alreadyPaidAmount', formData.alreadyPaidAmount ?? 0, formatMoneyValue)}
              onFocus={() => setInputValue('alreadyPaidAmount', formatMoneyTyping(getInputValue('alreadyPaidAmount', formData.alreadyPaidAmount ?? 0, formatMoneyValue)))}
              onBlur={() => setInputValue('alreadyPaidAmount', normalizeMoneyOnBlur(formData.alreadyPaidAmount ?? 0))}
              onChange={(e) => {
                const formatted = formatMoneyTyping(e.target.value);
                setInputValue('alreadyPaidAmount', formatted);
                setFormData({ ...formData, alreadyPaidAmount: parseLocaleNumber(e.target.value) });
              }}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Already Paid Installments', language)}</label>
            <input
              type="number"
              value={formData.alreadyPaidInstallments || ''}
              onChange={(e) => setFormData({ ...formData, alreadyPaidInstallments: parseInt(e.target.value, 10) || 0 })}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('One-time Fee', language)} ({state.settings.currency})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={getInputValue('oneTimeFee', formData.oneTimeFee ?? 0, formatMoneyValue)}
              onFocus={() => setInputValue('oneTimeFee', formatMoneyTyping(getInputValue('oneTimeFee', formData.oneTimeFee ?? 0, formatMoneyValue)))}
              onBlur={() => setInputValue('oneTimeFee', normalizeMoneyOnBlur(formData.oneTimeFee ?? 0))}
              onChange={(e) => {
                const formatted = formatMoneyTyping(e.target.value);
                setInputValue('oneTimeFee', formatted);
                setFormData({ ...formData, oneTimeFee: parseLocaleNumber(e.target.value) });
              }}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fee Note (Optional)', language)}</label>
            <input
              type="text"
              value={formData.oneTimeFeeNote || ''}
              onChange={(e) => setFormData({ ...formData, oneTimeFeeNote: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">{t('Live Summary', language)}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">{t('Principal', language)}</div>
              <div className="font-semibold text-gray-900">
                {formatMoneyValue(previewPrincipal)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t('Monthly Interest', language)}</div>
              <div className="font-semibold text-gray-900">
                {formatMoneyValue(previewMonthlyInterest)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t('Installment Count', language)}</div>
              <div className="font-semibold text-gray-900">{previewInstallmentCount}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t('Estimated Installment', language)}</div>
              <div className="font-semibold text-gray-900">
                {formatMoneyValue(previewInstallmentAmount)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t('One-time Fee', language)}</div>
              <div className="font-semibold text-gray-900">
                {formatMoneyValue(previewOneTimeFee)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t('Total Repayment', language)}</div>
              <div className="font-semibold text-gray-900">
                {formatMoneyValue(previewTotalRepayment)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? t('Update', language) : t('Add', language)} {t('Debt', language)}
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

      {/* Strategy Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Payoff Strategy', language)}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => setStrategy('snowball')}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              strategy === 'snowball' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-lg mb-2">❄️ {t('Snowball Method', language)}</div>
            <p className="text-sm text-gray-600">
              {t('Pay off smallest balances first for quick wins and motivation. Builds momentum as you eliminate debts.', language)}
            </p>
          </button>

          <button
            onClick={() => setStrategy('avalanche')}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              strategy === 'avalanche' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-lg mb-2">🏔️ {t('Avalanche Method', language)}</div>
            <p className="text-sm text-gray-600">
              {t('Pay off highest interest rates first to save money long-term. Mathematically optimal approach.', language)}
            </p>
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('Extra Payment Amount', language)} ({state.settings.currency}/{t('month', language)})
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={getInputValue('extraPayment', extraPayment, formatMoneyValue)}
            onFocus={() => setInputValue('extraPayment', formatMoneyTyping(getInputValue('extraPayment', extraPayment, formatMoneyValue)))}
            onBlur={() => setInputValue('extraPayment', normalizeMoneyOnBlur(extraPayment))}
            onChange={(e) => {
              const formatted = formatMoneyTyping(e.target.value);
              setInputValue('extraPayment', formatted);
              setExtraPayment(parseLocaleNumber(e.target.value));
            }}
            placeholder={formatMoneyValue(0)}
            className="max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            {t('Additional amount you can pay beyond minimum payments each month', language)}
          </p>
        </div>
      </div>

      {/* Payoff Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Payoff Timeline', language)}</h2>
        
        {state.debts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('No debts added yet. Add your first debt above!', language)}</p>
        ) : payoffTimeline.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('All debts are paid off!', language)} 🎉</p>
        ) : (
          <div className="space-y-4">
            {payoffTimeline.map((item, index) => {
              const { debt, monthsToPayoff, totalInterest, totalPaid } = item;
              const progress = debt.totalAmount > 0 ? ((debt.totalAmount - debt.currentBalance) / debt.totalAmount) * 100 : 0;
              const schedule = getDebtSchedule(debt);
              const isOpen = openDebtId === debt.id;

              return (
                <div key={debt.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-lg">{debt.name}</div>
                        <div className="text-sm text-gray-600">
                          {t('Monthly Interest Rate (%)', language)}: {formatRateValue(debt.interestRate / 12)}% • {t('Min. Payment', language)}: {formatMoneyValue(debt.minimumPayment)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setOpenDebtId(prev => (prev === debt.id ? null : debt.id))}
                        className="px-3 py-2 text-xs text-gray-700 hover:bg-gray-200 rounded"
                      >
                        {isOpen ? t('Hide', language) : t('View', language)}
                      </button>
                      <button
                        onClick={() => startEdit(debt)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteDebt(debt.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                        <div className="text-xs text-gray-500">{t('Current Balance', language)}</div>
                      <div className="font-semibold text-red-600">
                        {formatMoneyValue(debt.currentBalance)}
                      </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">{t('Payoff Time', language)}</div>
                      <div className="font-semibold text-gray-900">
                        {monthsToPayoff < 500 ? `${monthsToPayoff} ${t('months', language)}` : t('Never', language)}
                      </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">{t('Interest Paid', language)}</div>
                      <div className="font-semibold text-orange-600">
                        {formatMoneyValue(totalInterest)}
                      </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">{t('Total Paid', language)}</div>
                      <div className="font-semibold text-gray-900">
                        {formatMoneyValue(totalPaid)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{t('Progress', language)}</span>
                      <span>{progress.toFixed(1)}% {t('paid', language)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-red-500 to-green-500 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {isOpen && schedule.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <div className="text-sm font-medium text-gray-700">{t('Payment Account', language)}</div>
                        <select
                          value={debt.accountId || ''}
                          onChange={(e) => updateDebt(debt.id, { accountId: e.target.value || undefined })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">{t('Select account...', language)}</option>
                          {paymentAccounts.map(account => (
                            <option key={account.id} value={account.id}>{getAccountLabel(account)}</option>
                          ))}
                        </select>
                        {!debt.accountId && (
                          <span className="text-xs text-amber-600">{t('Select an account to record payments.', language)}</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-700 mb-2">{t('Installment Schedule', language)}</div>
                      <div className="space-y-2">
                        {schedule.map(installment => (
                          <div key={installment.id} className="flex items-center justify-between text-sm">
                            <div className="text-gray-700">{formatDateDisplay(new Date(installment.dueDate), language)}</div>
                            <div className="text-gray-700">
                              {formatMoneyValue(installment.amount)}
                            </div>
                            <div className={`text-xs px-2 py-1 rounded ${
                              installment.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {installment.status === 'paid' ? t('Paid', language) : t('Pending', language)}
                            </div>
                            <button
                              onClick={() => toggleInstallmentPayment(debt, installment)}
                              disabled={!debt.accountId && installment.status !== 'paid'}
                              className={`px-3 py-1 rounded text-xs ${
                                installment.status === 'paid'
                                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {installment.status === 'paid' ? t('Undo', language) : t('Mark Paid', language)}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-2 text-blue-900">💡 {t('Debt Payoff Tips', language)}</h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li>• <strong>{t('Snowball Method', language)}:</strong> {t('Pay off smallest balances first for quick wins and motivation. Builds momentum as you eliminate debts.', language)}</li>
          <li>• <strong>{t('Avalanche Method', language)}:</strong> {t('Pay off highest interest rates first to save money long-term. Mathematically optimal approach.', language)}</li>
          <li>• {t('Consider increasing your extra payment amount to pay off debts faster', language)}</li>
          <li>• {t('Keep making minimum payments on all debts while focusing extra payments on the priority debt', language)}</li>
          <li>• {t('After paying off one debt, roll that payment into the next debt for accelerated payoff', language)}</li>
        </ul>
      </div>
    </div>
  );
}
