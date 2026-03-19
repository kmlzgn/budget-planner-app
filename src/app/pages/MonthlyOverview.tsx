import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { 
  calculateRecurringForMonth, 
  calculateActualForMonth, 
  calculateByCategoryForMonth,
  getRecurringDatesForMonth
} from '../utils/budgetCalculations';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parseISO, getDay } from 'date-fns';
import { getMonthNames, getWeekdayNames, t } from '../utils/i18n';
import { BreadcrumbInline } from '../components/BreadcrumbInline';

export function MonthlyOverview() {
  const { state } = useBudget();
  const language = state.settings.language;
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(state.settings.startYear);
  const [viewMode, setViewMode] = useState<'summary' | 'calendar'>('summary');
  const monthNames = getMonthNames(language, 'long');
  const weekdayNames = getWeekdayNames(language, 'short');

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

  // Category breakdown
  const categoryBreakdown = state.categories.map(category => {
    const { planned, actual } = calculateByCategoryForMonth(
      state.transactions,
      state.recurringTransactions,
      selectedYear,
      selectedMonth,
      category.id
    );
    return {
      category,
      planned,
      actual,
      variance: actual - planned,
    };
  }).filter(item => item.planned > 0 || item.actual > 0);

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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header with month selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('Monthly Overview', language)}
            <BreadcrumbInline />
          </h1>
          <p className="text-gray-600">{t('Track your planned vs actual budget performance', language)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded-lg ${viewMode === 'summary' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {t('Summary', language)}
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'calendar' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            <CalendarIcon className="w-4 h-4" />
            {t('Calendar', language)}
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-lg shadow p-4">
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">{t('Planned Income', language)}</div>
              <div className="text-2xl font-bold text-green-600">
                {state.settings.currency}{plannedIncome.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">{t('Actual Income', language)}</div>
              <div className="text-2xl font-bold text-green-600">
                {state.settings.currency}{actualIncome.toFixed(2)}
              </div>
              <div className={`text-sm mt-1 ${actualIncome >= plannedIncome ? 'text-green-600' : 'text-red-600'}`}>
                {actualIncome >= plannedIncome ? '↑' : '↓'} {state.settings.currency}{Math.abs(actualIncome - plannedIncome).toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">{t('Planned Expenses', language)}</div>
              <div className="text-2xl font-bold text-red-600">
                {state.settings.currency}{plannedExpenses.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">{t('Actual Expenses', language)}</div>
              <div className="text-2xl font-bold text-red-600">
                {state.settings.currency}{actualExpenses.toFixed(2)}
              </div>
              <div className={`text-sm mt-1 ${actualExpenses <= plannedExpenses ? 'text-green-600' : 'text-red-600'}`}>
                {actualExpenses <= plannedExpenses ? '↓' : '↑'} {state.settings.currency}{Math.abs(actualExpenses - plannedExpenses).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Balance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">{t('Planned Balance', language)}</div>
              <div className={`text-2xl font-bold ${plannedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {state.settings.currency}{plannedBalance.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">{t('Actual Balance', language)}</div>
              <div className={`text-2xl font-bold ${actualBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {state.settings.currency}{actualBalance.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">{t('Variance', language)}</div>
              <div className={`text-2xl font-bold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {variance >= 0 ? '+' : ''}{state.settings.currency}{variance.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {variance >= 0 ? t('Better than planned', language) : t('Worse than planned', language)}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('Category Breakdown', language)}</h3>
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
                  {categoryBreakdown.map(({ category, planned, actual, variance }) => {
                    const isGood = category.type === 'income' ? variance >= 0 : variance <= 0;
                    const percentUsed = planned > 0 ? (actual / planned) * 100 : 0;

                    return (
                      <tr key={category.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                            <span className="font-medium">{category.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {state.settings.currency}{planned.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {state.settings.currency}{actual.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                          {variance >= 0 ? '+' : ''}{state.settings.currency}{variance.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${percentUsed > 100 ? 'bg-red-500' : percentUsed > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 w-12 text-right">
                              {percentUsed.toFixed(0)}%
                            </span>
                          </div>
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('Calendar View', language)}</h3>
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
              const hasItems = transactions.length > 0 || recurringItems.length > 0;

              return (
                <div
                  key={date.toISOString()}
                  className={`aspect-square border rounded-lg p-2 ${hasItems ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                >
                  <div className="text-sm font-semibold text-gray-900 mb-1">
                    {format(date, 'd')}
                  </div>
                  {hasItems && (
                    <div className="space-y-1">
                      {totalIncome > 0 && (
                        <div className="text-xs text-green-600 truncate" title={`${t('Income', language)}: ${state.settings.currency}${totalIncome.toFixed(2)}`}>
                          +{state.settings.currency}{totalIncome.toFixed(0)}
                        </div>
                      )}
                      {totalExpenses > 0 && (
                        <div className="text-xs text-red-600 truncate" title={`${t('Expenses', language)}: ${state.settings.currency}${totalExpenses.toFixed(2)}`}>
                          -{state.settings.currency}{totalExpenses.toFixed(0)}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {transactions.length + recurringItems.length} {t('item', language)}{transactions.length + recurringItems.length !== 1 ? 's' : ''}
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
