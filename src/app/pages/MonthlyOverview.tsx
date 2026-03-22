import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { 
  calculateRecurringForMonth, 
  calculateActualForMonth, 
  calculateByCategoryForMonth,
  getRecurringDatesForMonth
} from '../utils/budgetCalculations';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { formatDateDisplay, getMonthNames, getWeekdayNames, t, tKey } from '../utils/i18n';
import { BreadcrumbInline } from '../components/BreadcrumbInline';
import { formatCurrency } from '../utils/formatting';

export function MonthlyOverview() {
  const { state } = useBudget();
  const language = state.settings.language;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(state.settings.startYear);
  const [viewMode, setViewMode] = useState<'summary' | 'calendar'>('summary');
  const monthNames = getMonthNames(language, 'long');
  const weekdayNames = getWeekdayNames(language, 'short');
  const today = new Date();

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Calculate planned income/expenses from recurring transactions
  const plannedIncome = calculateRecurringForMonth(state.recurringTransactions, selectedYear, selectedMonth, 'income');
  const plannedExpenses = calculateRecurringForMonth(state.recurringTransactions, selectedYear, selectedMonth, 'expense');
  
  // Calculate actual income/expenses from transactions
  const actualIncome = calculateActualForMonth(state.transactions, selectedYear, selectedMonth, 'income');
  const actualExpenses = calculateActualForMonth(state.transactions, selectedYear, selectedMonth, 'expense');

  const plannedBalance = plannedIncome - plannedExpenses;
  const actualBalance = actualIncome - actualExpenses;
  const variance = actualBalance - plannedBalance;

  const formatCurrencyLeadSign = (value: number) => {
    const absFormatted = formatCurrency(Math.abs(value), state.settings.currency, locale);
    if (value < 0) {
      return `-${absFormatted.replace(`${state.settings.currency} `, `${state.settings.currency}`)}`;
    }
    return absFormatted;
  };

  const formatCompactCurrency = (value: number) =>
    `${value < 0 ? '-' : ''}${state.settings.currency}${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(Math.abs(value))}`;

  const plannedAvailable = plannedIncome > 0 || plannedExpenses > 0;
  const savingsRate = actualIncome > 0 ? (actualBalance / actualIncome) * 100 : null;
  const netCashFlowStatus = actualBalance >= 0
    ? t('Positive month so far', language)
    : t('Negative month so far', language);
  const varianceStatus = variance >= 0 ? t('Better than plan', language) : t('Worse than plan', language);
  const headerSummary = plannedAvailable
    ? `${netCashFlowStatus}. ${varianceStatus}.`
    : `${netCashFlowStatus}. ${t('Plan data is limited this month', language)}.`;

  // Category breakdown (normalized by name + type)
  const normalizedCategoryMap = new Map<string, {
    name: string;
    type: 'income' | 'expense';
    color: string;
    planned: number;
    actual: number;
  }>();
  state.categories.forEach(category => {
    const { planned, actual } = calculateByCategoryForMonth(
      state.transactions,
      state.recurringTransactions,
      selectedYear,
      selectedMonth,
      category.id
    );
    if (planned === 0 && actual === 0) return;
    const key = `${category.type}-${category.name.trim().toLowerCase()}`;
    const existing = normalizedCategoryMap.get(key);
    if (existing) {
      existing.planned += planned;
      existing.actual += actual;
      return;
    }
    normalizedCategoryMap.set(key, {
      name: category.name,
      type: category.type,
      color: category.color,
      planned,
      actual,
    });
  });
  const categoryBreakdown = Array.from(normalizedCategoryMap.values()).map(item => ({
    ...item,
    variance: item.actual - item.planned,
  }));

  const expenseCategories = categoryBreakdown.filter(item => item.type === 'expense');
  const plannedExpenseCategories = expenseCategories.filter(item => item.planned > 0);
  const topVarianceCategories = (plannedExpenseCategories.length > 0 ? plannedExpenseCategories : expenseCategories)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 3);

  const topActualExpenses = expenseCategories
    .sort((a, b) => b.actual - a.actual)
    .filter(item => item.actual > 0);
  const largestExpense = topActualExpenses[0];
  const overspendTotal = plannedExpenseCategories
    .filter(item => item.variance > 0)
    .reduce((sum, item) => sum + item.variance, 0);
  const topOverspendShare = overspendTotal > 0
    ? (topVarianceCategories.filter(item => item.variance > 0).reduce((sum, item) => sum + item.variance, 0) / overspendTotal) * 100
    : null;

  const insights: string[] = [];
  if (actualExpenses > actualIncome && actualIncome > 0) {
    insights.push(`${t('Expenses exceeded income by', language)} ${formatCurrencyLeadSign(actualExpenses - actualIncome)}.`);
  }
  if (actualIncome > 0 && actualExpenses > 0) {
    const coverage = (actualIncome / actualExpenses) * 100;
    insights.push(`${t('Income covered', language)} ${coverage.toFixed(0)}% ${t('of expenses', language)}.`);
  }
  if (largestExpense) {
    insights.push(`${t('Largest expense category', language)}: ${largestExpense.name}.`);
  }
  if (topOverspendShare !== null && topOverspendShare > 0) {
    insights.push(`${t('Top variances explain', language)} ${topOverspendShare.toFixed(0)}% ${t('of overspend', language)}.`);
  }

  // Calendar view data
  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth, 1));
  const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth, 1));
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  // Get transactions and recurring items for each day
  const getItemsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const transactions = state.transactions.filter(t => t.date === dateStr);
    
    const recurringItems = state.recurringTransactions
      .filter(rt => rt.isActive)
      .flatMap(rt => {
        const dates = getRecurringDatesForMonth(rt, selectedYear, selectedMonth);
        return dates.filter(d => format(d, 'yyyy-MM-dd') === dateStr).map(() => rt);
      });

    return { transactions, recurringItems };
  };

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title mb-2">
            {tKey('Cash Flow', language)}
            <BreadcrumbInline />
          </h1>
          <div className="text-sm text-gray-600">{headerSummary}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            {t('Period', language)}: {monthNames[selectedMonth]} {selectedYear}
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            {t('Currency', language)}: {state.settings.currency}
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            {tKey('As of', language)} {formatDateDisplay(today, language)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${viewMode === 'summary' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {t('Summary', language)}
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${viewMode === 'calendar' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            <CalendarIcon className="w-4 h-4" />
            {t('Calendar', language)}
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="app-card app-card-padding">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            {monthNames[selectedMonth]} {selectedYear}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="app-card app-card-padding lg:col-span-5">
              <div className="text-sm font-semibold text-gray-500">{t('Net Cash Flow', language)}</div>
              <div className={`mt-3 text-4xl font-semibold tabular-nums ${actualBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrencyLeadSign(actualBalance)}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {plannedAvailable ? varianceStatus : t('Plan data is limited this month', language)}
              </div>
              {plannedAvailable && (
                <div className="mt-3 text-xs text-gray-500">
                  {t('Planned', language)}: {formatCurrency(plannedBalance, state.settings.currency, locale)}
                </div>
              )}
            </div>

            <div className="app-card app-card-padding lg:col-span-3">
              <div className="text-sm font-semibold text-gray-500">{t('Actual Income', language)}</div>
              <div className="mt-3 text-2xl font-semibold text-emerald-600 tabular-nums">
                {formatCurrency(actualIncome, state.settings.currency, locale)}
              </div>
              {plannedIncome > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {t('Planned', language)}: {formatCurrency(plannedIncome, state.settings.currency, locale)}
                </div>
              )}
            </div>

            <div className="app-card app-card-padding lg:col-span-2">
              <div className="text-sm font-semibold text-gray-500">{t('Actual Expenses', language)}</div>
              <div className="mt-3 text-2xl font-semibold text-rose-600 tabular-nums">
                {formatCurrency(actualExpenses, state.settings.currency, locale)}
              </div>
              {plannedExpenses > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {t('Planned', language)}: {formatCurrency(plannedExpenses, state.settings.currency, locale)}
                </div>
              )}
            </div>

            <div className="app-card app-card-padding lg:col-span-2">
              <div className="text-sm font-semibold text-gray-500">{t('Variance vs Plan', language)}</div>
              <div className={`mt-3 text-2xl font-semibold tabular-nums ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrencyLeadSign(variance)}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {plannedAvailable ? varianceStatus : t('No plan available', language)}
              </div>
              {savingsRate !== null && actualIncome > 0 && (
                <div className="mt-3 text-xs text-gray-500">
                  {t('Savings Rate', language)}: {savingsRate.toFixed(0)}%
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-card app-card-padding">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-500">{t('Budget Drift', language)}</span>
              </div>
              {topVarianceCategories.length > 0 ? (
                <div className="space-y-3">
                  {topVarianceCategories.map(item => {
                    const isOver = item.variance > 0;
                    return (
                      <div key={item.name} className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500">
                            {t('Planned', language)}: {formatCurrency(item.planned, state.settings.currency, locale)} · {t('Actual', language)}: {formatCurrency(item.actual, state.settings.currency, locale)}
                          </div>
                        </div>
                        <div className={`text-sm font-semibold ${isOver ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {isOver ? '+' : '-'}
                          {formatCurrency(Math.abs(item.variance), state.settings.currency, locale)} {t(isOver ? 'Over plan' : 'Under plan', language)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500">{t('No material variance detected.', language)}</div>
              )}
            </div>

            <div className="app-card app-card-padding">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-500">{t('Cash Flow Insights', language)}</span>
              </div>
              {insights.length > 0 ? (
                <ul className="space-y-2 text-sm text-gray-700">
                  {insights.slice(0, 4).map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">{t('No insights available yet.', language)}</div>
              )}
            </div>
          </div>

          <div className="app-card app-card-padding">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('Category Breakdown', language)}</h3>
              <span className="text-xs text-gray-500">{t('Sorted by actual spend', language)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Category', language)}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Planned', language)}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Actual', language)}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Variance', language)}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Status', language)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {categoryBreakdown
                    .sort((a, b) => b.actual - a.actual)
                    .map(item => {
                      const isUnplanned = item.planned === 0 && item.actual > 0;
                      const isExpense = item.type === 'expense';
                      const varianceLabel = isUnplanned
                        ? t(isExpense ? 'Unplanned spend' : 'Unplanned income', language)
                        : item.variance > 0
                          ? t('Over plan', language)
                          : item.variance < 0
                            ? t('Under plan', language)
                            : t('On track', language);
                      const varianceTone = isUnplanned
                        ? 'text-amber-600'
                        : item.variance > 0
                          ? 'text-rose-600'
                          : item.variance < 0
                            ? 'text-emerald-600'
                            : 'text-gray-500';
                      return (
                        <tr key={`${item.type}-${item.name}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="font-medium">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(item.planned, state.settings.currency, locale)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(item.actual, state.settings.currency, locale)}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${varianceTone}`}>
                            {item.variance >= 0 ? '+' : '-'}{formatCurrency(Math.abs(item.variance), state.settings.currency, locale)}
                          </td>
                          <td className={`px-4 py-3 text-right text-xs font-semibold ${varianceTone}`}>
                            {varianceLabel}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Calendar View */
        <div className="app-card app-card-padding">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Calendar View', language)}</h3>
          <div className="grid grid-cols-7 gap-2">
            {weekdayNames.map(day => (
              <div key={day} className="text-center font-semibold text-sm text-gray-600 py-2">
                {day}
              </div>
            ))}
            
            {/* Empty cells for days before month starts */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {/* Days of the month */}
            {daysInMonth.map(date => {
              const { transactions, recurringItems } = getItemsForDay(date);
              const dayIncome = transactions
                .filter(t => t.type === 'income' && t.transactionKind !== 'credit-card-payment')
                .reduce((sum, t) => sum + t.amount, 0);
              const dayExpenses = transactions
                .filter(t => t.type === 'expense' && t.transactionKind !== 'credit-card-payment')
                .reduce((sum, t) => sum + t.amount, 0);
              const recurringExpenses = recurringItems.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
              const recurringIncome = recurringItems.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
              
              const totalIncome = dayIncome + recurringIncome;
              const totalExpenses = dayExpenses + recurringExpenses;
              const net = totalIncome - totalExpenses;
              const hasItems = transactions.length > 0 || recurringItems.length > 0;
              const activityCount = transactions.length + recurringItems.length;
              const highlight = hasItems && (Math.abs(net) >= Math.max(actualExpenses / daysInMonth.length, actualIncome / daysInMonth.length) * 2);

              return (
                <div
                  key={date.toISOString()}
                  className={`min-h-[110px] border rounded-lg p-2 ${hasItems ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'} ${highlight ? 'ring-1 ring-emerald-200' : ''}`}
                >
                  <div className="text-sm font-semibold text-gray-900 mb-1">
                    {format(date, 'd')}
                  </div>
                  {hasItems && (
                    <div className="space-y-1">
                      <div className={`text-xs font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCompactCurrency(net)}
                      </div>
                      {totalIncome > 0 && (
                        <div className="text-[11px] text-emerald-600 truncate" title={`${t('Income', language)}: ${formatCurrency(totalIncome, state.settings.currency, locale)}`}>
                          {t('Income', language)} {formatCompactCurrency(totalIncome)}
                        </div>
                      )}
                      {totalExpenses > 0 && (
                        <div className="text-[11px] text-rose-600 truncate" title={`${t('Expenses', language)}: ${formatCurrency(totalExpenses, state.settings.currency, locale)}`}>
                          {t('Expenses', language)} {formatCompactCurrency(totalExpenses)}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-500">
                        {activityCount} {t(activityCount === 1 ? 'item' : 'items', language)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 flex gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
              <span>{t('Has transactions', language)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border border-gray-200 rounded"></div>
              <span>{t('No transactions', language)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
