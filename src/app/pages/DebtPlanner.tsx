import { useMemo, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Plus, Trash2, Edit2, Check, TrendingDown } from 'lucide-react';
import { Account, Debt, DebtInstallment, DebtStrategy, TransactionFrequency } from '../types';
import { generateId } from '../utils/id';
import { addMonths } from 'date-fns';
import { buildDebtInstallments, calculateInstallmentAmount } from '../utils/budgetCalculations';
import { formatDateDisplay, t, tKey } from '../utils/i18n';
import { formatCurrency } from '../utils/formatting';
import { BreadcrumbInline } from '../components/BreadcrumbInline';
import { MoneyField } from '../components/inputs/MoneyField';
import { RateField } from '../components/inputs/RateField';
import { getMonthlyCashFlowSummary, getDebtSummary } from '../utils/financeSummaries';
import { getDebtDecisionSummary } from '../utils/debtSummaries';
import { AppCard } from '../components/ui/app-card';
import { SectionHeader } from '../components/ui/section-header';
import { PrimaryButton, SecondaryButton } from '../components/ui/app-buttons';
import { InlineEmptyState } from '../components/ui/inline-empty-state';

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
  const [monthlyRatePercent, setMonthlyRatePercent] = useState(0);
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
  const monthlyRateValue = monthlyRatePercent;
  const formatMoneyValue = (value: number) =>
    formatCurrency(value, state.settings.currency, locale, {
      maximumFractionDigits: 2,
    });
  const formatRateValue = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
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
    setMonthlyRatePercent(0);
    setEditingId(null);
  };

  const startEdit = (debt: Debt) => {
    setFormData(debt);
    const monthly = debt.interestRate ? debt.interestRate / 12 : 0;
    setMonthlyRatePercent(monthly);
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

  const decisionSummary = getDebtDecisionSummary(state.debts, strategy, extraPayment);
  const payoffTimeline = decisionSummary.simulation;
  const totalDebt = decisionSummary.totalDebt;
  const totalMinimumPayments = decisionSummary.totalMinimumPayments;
  const totalInterestPaid = decisionSummary.totalInterestEstimate;
  const monthsToDebtFree = decisionSummary.monthsToDebtFree;
  const today = new Date();
  const cashFlow = getMonthlyCashFlowSummary(
    state.transactions,
    state.recurringTransactions,
    today.getFullYear(),
    today.getMonth()
  );
  const debtSummary = getDebtSummary(state.debts, cashFlow.actualIncome);
  const urgencyFlags: string[] = [];
  if (decisionSummary.missingPaymentCount > 0) {
    urgencyFlags.push(t('Minimum payments missing for some debts.', language));
  }
  if (decisionSummary.missingRatesCount > 0) {
    urgencyFlags.push(t('Interest rates missing for some debts.', language));
  }
  if (decisionSummary.insufficientPaymentCount > 0) {
    urgencyFlags.push(t('Payments do not cover monthly interest.', language));
  }
  if (decisionSummary.invalidBalanceCount > 0) {
    urgencyFlags.push(t('Some debts have invalid balances.', language));
  }
  if (debtSummary.debtRatio !== null && debtSummary.debtRatio >= 30) {
    urgencyFlags.push(t('Debt payments high vs income', language));
  }
  if (monthsToDebtFree !== null && monthsToDebtFree >= 120) {
    urgencyFlags.push(t('Long payoff horizon (10+ years).', language));
  }

  const simulationStatus = decisionSummary.simulation.status;
  const debtFreeDateLabel = monthsToDebtFree !== null
    ? formatDateDisplay(addMonths(today, monthsToDebtFree), language, { month: 'short', year: 'numeric' })
    : null;

  const headerSummary = useMemo(() => {
    if (state.debts.length === 0) {
      return t('Add a debt to start building a payoff plan.', language);
    }
    if (simulationStatus === 'ok' && monthsToDebtFree !== null) {
      return `${t('At your current pace, debt payoff will take', language)} ${monthsToDebtFree} ${t('months', language)}.`;
    }
    if (simulationStatus === 'impossible') {
      return t('Payments do not cover monthly interest. Increase payments.', language);
    }
    if (decisionSummary.missingPaymentCount > 0 || decisionSummary.missingRatesCount > 0) {
      return t('Simulation is incomplete. Add minimum payments and interest rates.', language);
    }
    return t('Simulation unavailable with current data.', language);
  }, [decisionSummary.missingPaymentCount, decisionSummary.missingRatesCount, language, monthsToDebtFree, simulationStatus, state.debts.length]);

  const debtById = useMemo(() => new Map(state.debts.map(debt => [debt.id, debt])), [state.debts]);
  const strategyInsight = useMemo(() => {
    if (!decisionSummary.strategyComparison) return null;
    const { monthsDifference, interestDifference } = decisionSummary.strategyComparison;
    if (interestDifference > 0) {
      return `${t('Avalanche saves', language)} ${formatMoneyValue(interestDifference)} ${t('in interest vs snowball.', language)}`;
    }
    if (interestDifference < 0) {
      return `${t('Snowball saves', language)} ${formatMoneyValue(Math.abs(interestDifference))} ${t('in interest vs avalanche.', language)}`;
    }
    if (monthsDifference !== 0) {
      const faster = monthsDifference > 0 ? t('Avalanche', language) : t('Snowball', language);
      return `${faster} ${t('is faster by', language)} ${Math.abs(monthsDifference)} ${t('months', language)}.`;
    }
    return null;
  }, [decisionSummary.strategyComparison, formatMoneyValue, language]);

  const dynamicTips = useMemo(() => {
    const tips: string[] = [];
    if (decisionSummary.missingPaymentCount > 0) {
      tips.push(t('Add minimum payments to unlock payoff simulation.', language));
    }
    if (decisionSummary.missingRatesCount > 0) {
      tips.push(t('Add interest rates to estimate total interest.', language));
    }
    if (decisionSummary.extraPaymentImpact && decisionSummary.extraPaymentImpact.monthsSaved > 0) {
      tips.push(`${t('Extra payments could save', language)} ${decisionSummary.extraPaymentImpact.monthsSaved} ${t('months', language)}.`);
    }
    if (decisionSummary.strategyComparison && decisionSummary.strategyComparison.interestDifference > 0) {
      tips.push(t('Avalanche appears to reduce interest cost.', language));
    }
    return tips;
  }, [decisionSummary, language]);

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title mb-2">
            {tKey('Debt', language)}
            <BreadcrumbInline />
          </h1>
          <p className="app-page-subtitle">{tKey('Strategize your debt payoff using Snowball or Avalanche method', language)}</p>
          <div className="mt-3 text-sm text-gray-600">{headerSummary}</div>
          {debtFreeDateLabel && simulationStatus === 'ok' && (
            <div className="mt-2 text-xs text-gray-500">
              {t('Estimated debt-free date', language)}: {debtFreeDateLabel}
            </div>
          )}
        </div>
      </div>

      {/* Debt Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AppCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{t('Total Debt', language)}</span>
            <TrendingDown className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatMoneyValue(totalDebt)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {state.debts.length} {t('debts', language)}
          </div>
        </AppCard>

        <AppCard>
          <div className="text-sm text-gray-600 mb-1">{t('Monthly Obligation', language)}</div>
          {totalMinimumPayments !== null ? (
            <>
              <div className="text-2xl font-bold text-gray-900">
                {formatMoneyValue(totalMinimumPayments)}
              </div>
              <div className="text-sm text-gray-600 mt-1">{t('per month', language)}</div>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              {t('Add payment amounts to estimate obligation.', language)}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-2">
            {debtSummary.debtRatio !== null
              ? `${t('Debt-to-Income', language)}: ${debtSummary.debtRatio.toFixed(1)}%`
              : t('Add income data to calculate burden.', language)}
          </div>
        </AppCard>

        <AppCard>
          <div className="text-sm text-gray-600 mb-1">{t('Estimated Interest Cost', language)}</div>
          {totalInterestPaid !== null ? (
            <div className="text-2xl font-bold text-orange-600">
              {formatMoneyValue(totalInterestPaid)}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {t('Interest estimate unavailable.', language)}
            </div>
          )}
          {decisionSummary.missingRatesCount > 0 && (
            <div className="text-xs text-amber-700 mt-2">
              {t('Some interest rates are missing; estimate is low confidence.', language)}
            </div>
          )}
        </AppCard>

        <AppCard>
          <div className="text-sm text-gray-600 mb-1">{t('Debt-Free In', language)}</div>
          {monthsToDebtFree !== null ? (
            <>
              <div className="text-2xl font-bold text-blue-600">
                {monthsToDebtFree} {t('months', language)}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {(monthsToDebtFree / 12).toFixed(1)} {t('years', language)}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              {t('Payoff timeline unavailable.', language)}
            </div>
          )}
          {extraPayment > 0 && decisionSummary.monthsSaved !== null && decisionSummary.monthsSaved > 0 && (
            <div className="text-xs text-emerald-700 mt-2">
              {t('Extra payment saves', language)} {decisionSummary.monthsSaved} {t('months', language)}
            </div>
          )}
        </AppCard>
      </div>

      {/* Decision Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AppCard>
          <div className="text-sm text-gray-500 mb-2">{t('Payoff Order', language)}</div>
          <div className="text-xs text-gray-500 mb-3">
            {strategy === 'snowball'
              ? t('Smallest balances first for momentum.', language)
              : t('Highest interest rates first to save more.', language)}
          </div>
          <div className="space-y-2 text-sm">
            {decisionSummary.payoffOrder.length === 0 ? (
              <InlineEmptyState>{t('No debts added yet. Add your first debt above!', language)}</InlineEmptyState>
            ) : (
              decisionSummary.payoffOrder.slice(0, 4).map((debt, index) => (
                <div key={debt.id} className="flex items-center justify-between text-gray-700">
                  <div className="truncate">
                    {index + 1}. {debt.name}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {strategy === 'snowball'
                      ? `${t('Balance', language)}: ${formatMoneyValue(debt.currentBalance)}`
                      : `${t('Rate', language)}: ${(debt.interestRate ?? 0).toFixed(2)}%`}
                  </div>
                </div>
              ))
            )}
          </div>
        </AppCard>

        <AppCard>
          <div className="text-sm text-gray-500 mb-2">{t('Early Payment Impact', language)}</div>
          {decisionSummary.extraPaymentImpact ? (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                {t('Extra payment', language)}: {formatMoneyValue(extraPayment)}
              </div>
              <div className="text-emerald-700">
                {t('Interest saved estimate', language)}: {formatMoneyValue(decisionSummary.extraPaymentImpact.interestSaved)}
              </div>
              <div>
                {t('Time saved', language)}: {decisionSummary.extraPaymentImpact.monthsSaved} {t('months', language)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {extraPayment > 0
                ? t('Add valid payment details to preview impact.', language)
                : t('Add an extra payment to preview payoff impact.', language)}
            </div>
          )}
        </AppCard>

        <AppCard>
          <div className="text-sm text-gray-500 mb-2">{t('Urgency Flags', language)}</div>
          {urgencyFlags.length === 0 ? (
            <div className="text-sm text-gray-500">{t('No urgent items right now.', language)}</div>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {urgencyFlags.map(flag => (
                <li key={flag} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      </div>

      {/* Add/Edit Debt Form */}
      <AppCard>
        <SectionHeader
          title={editingId ? t('Edit Debt', language) : t('Add Debt', language)}
          className="mb-4"
        />

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('Core Inputs', language)}
        </div>
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
            <MoneyField
              value={formData.totalAmount ?? 0}
              onValueChange={(value) => setFormData({ ...formData, totalAmount: value })}
              locale={locale}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Current Balance', language)} * ({state.settings.currency})
            </label>
            <MoneyField
              value={formData.currentBalance ?? 0}
              onValueChange={(value) => setFormData({ ...formData, currentBalance: value })}
              locale={locale}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Monthly Interest Rate (%)', language)} *</label>
            <RateField
              value={monthlyRateValue}
              onValueChange={(value) => setMonthlyRatePercent(value)}
              locale={locale}
              placeholder={formatRateValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Min. Payment', language)} ({state.settings.currency})
            </label>
            <MoneyField
              value={formData.minimumPayment ?? 0}
              onValueChange={(value) => setFormData({ ...formData, minimumPayment: value })}
              locale={locale}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-2">
          {t('Payment & Schedule', language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              }}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Installment Amount', language)} ({state.settings.currency})
            </label>
            <MoneyField
              value={formData.installmentAmount ?? 0}
              onValueChange={(value) => setFormData({ ...formData, installmentAmount: value })}
              locale={locale}
              placeholder={formatMoneyValue(0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-2">
          {t('Progress & History', language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Already Paid Amount', language)} ({state.settings.currency})
            </label>
            <MoneyField
              value={formData.alreadyPaidAmount ?? 0}
              onValueChange={(value) => setFormData({ ...formData, alreadyPaidAmount: value })}
              locale={locale}
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

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-2">
          {t('Advanced Details', language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('One-time Fee', language)} ({state.settings.currency})
            </label>
            <MoneyField
              value={formData.oneTimeFee ?? 0}
              onValueChange={(value) => setFormData({ ...formData, oneTimeFee: value })}
              locale={locale}
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
          <PrimaryButton onClick={handleSubmit}>
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? t('Update', language) : t('Add', language)} {t('Debt', language)}
          </PrimaryButton>
          {editingId && (
            <SecondaryButton onClick={resetForm}>{t('Cancel', language)}</SecondaryButton>
          )}
        </div>
      </AppCard>

      {/* Strategy Selection */}
      <AppCard>
        <SectionHeader title={t('Payoff Strategy', language)} className="mb-4" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => setStrategy('snowball')}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              strategy === 'snowball' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-lg mb-2">{t('Snowball Method', language)}</div>
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
            <div className="font-semibold text-lg mb-2">{t('Avalanche Method', language)}</div>
            <p className="text-sm text-gray-600">
              {t('Pay off highest interest rates first to save money long-term. Mathematically optimal approach.', language)}
            </p>
          </button>
        </div>
        {strategyInsight && (
          <div className="text-sm text-gray-600 mb-4">{strategyInsight}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('Extra Payment Amount', language)} ({state.settings.currency}/{t('month', language)})
          </label>
          <MoneyField
            value={extraPayment}
            onValueChange={setExtraPayment}
            locale={locale}
            placeholder={formatMoneyValue(0)}
            className="max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            {t('Additional amount you can pay beyond minimum payments each month', language)}
          </p>
        </div>
      </AppCard>

      {/* Payoff Timeline */}
      <AppCard>
        <SectionHeader title={t('Payoff Timeline', language)} className="mb-4" />
        
        {state.debts.length === 0 ? (
          <InlineEmptyState className="text-center py-8">
            {t('No debts added yet. Add your first debt above!', language)}
          </InlineEmptyState>
        ) : payoffTimeline.status !== 'ok' ? (
          <InlineEmptyState className="text-center py-8">
            {payoffTimeline.status === 'impossible'
              ? t('Payoff will not progress under current assumptions.', language)
              : t('Simulation is incomplete. Add missing data to see payoff timing.', language)}
          </InlineEmptyState>
        ) : payoffTimeline.debtResults.length === 0 ? (
          <InlineEmptyState className="text-center py-8">
            {t('All debts are paid off!', language)}
          </InlineEmptyState>
        ) : (
          <div className="space-y-4">
            {payoffTimeline.debtResults.map((result, index) => {
              const debt = debtById.get(result.debtId);
              if (!debt) return null;
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
                        {result.monthsToPayoff !== null ? `${result.monthsToPayoff} ${t('months', language)}` : t('Not available', language)}
                      </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">{t('Interest Paid', language)}</div>
                      <div className="font-semibold text-orange-600">
                        {formatMoneyValue(result.interestPaid)}
                      </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">{t('Total Paid', language)}</div>
                      <div className="font-semibold text-gray-900">
                        {formatMoneyValue(result.totalPaid)}
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
      </AppCard>

      {/* Tips */}
      <AppCard className="border-blue-200 bg-blue-50">
        <h3 className="font-semibold text-lg mb-2 text-blue-900">{t('Debt Payoff Tips', language)}</h3>
        {dynamicTips.length > 0 && (
          <>
            <div className="text-sm font-medium text-blue-900 mb-2">{t('Priority guidance', language)}</div>
            <ul className="space-y-2 text-blue-900 text-sm mb-3">
              {dynamicTips.map(tip => (
                <li key={tip}>• {tip}</li>
              ))}
            </ul>
          </>
        )}
        <ul className="space-y-2 text-blue-800 text-sm">
          <li>• <strong>{t('Snowball Method', language)}:</strong> {t('Pay off smallest balances first for quick wins and motivation. Builds momentum as you eliminate debts.', language)}</li>
          <li>• <strong>{t('Avalanche Method', language)}:</strong> {t('Pay off highest interest rates first to save money long-term. Mathematically optimal approach.', language)}</li>
          <li>• {t('Consider increasing your extra payment amount to pay off debts faster', language)}</li>
          <li>• {t('Keep making minimum payments on all debts while focusing extra payments on the priority debt', language)}</li>
          <li>• {t('After paying off one debt, roll that payment into the next debt for accelerated payoff', language)}</li>
        </ul>
      </AppCard>
    </div>
  );
}


