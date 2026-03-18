import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateRecurringForMonth, calculateActualForMonth } from '../utils/budgetCalculations';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { formatDateDisplay, getMonthNames, t } from '../utils/i18n';
import { parseISO } from 'date-fns';
import { formatCurrency } from '../utils/formatting';

export function AnnualDashboard() {
  const { state } = useBudget();
  const language = state.settings.language;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const monthNames = getMonthNames(language, 'short');
  const [selectedYear, setSelectedYear] = useState(state.settings.startYear);

  const availableYears = Array.from(
    new Set([
      state.settings.startYear,
      ...state.transactions.map(t => parseISO(t.date).getFullYear()),
    ])
  ).sort((a, b) => b - a);

  const transactionsForYear = state.transactions.filter(
    t => parseISO(t.date).getFullYear() === selectedYear
  );

  // Calculate monthly data for the year
  const monthlyData = monthNames.map((month, index) => {
    const plannedIncome = calculateRecurringForMonth(state.recurringTransactions, selectedYear, index, 'income');
    const plannedExpenses = calculateRecurringForMonth(state.recurringTransactions, selectedYear, index, 'expense');
    const actualIncome = calculateActualForMonth(transactionsForYear, selectedYear, index, 'income');
    const actualExpenses = calculateActualForMonth(transactionsForYear, selectedYear, index, 'expense');

    return {
      month,
      plannedIncome,
      plannedExpenses,
      actualIncome,
      actualExpenses,
      plannedBalance: plannedIncome - plannedExpenses,
      actualBalance: actualIncome - actualExpenses,
    };
  });

  // Annual totals
  const totalPlannedIncome = monthlyData.reduce((sum, m) => sum + m.plannedIncome, 0);
  const totalPlannedExpenses = monthlyData.reduce((sum, m) => sum + m.plannedExpenses, 0);
  const totalActualIncome = monthlyData.reduce((sum, m) => sum + m.actualIncome, 0);
  const totalActualExpenses = monthlyData.reduce((sum, m) => sum + m.actualExpenses, 0);
  const totalPlannedBalance = totalPlannedIncome - totalPlannedExpenses;
  const totalActualBalance = totalActualIncome - totalActualExpenses;

  const snapshotsForYear = state.wealthSnapshots
    .filter(snapshot => parseISO(snapshot.date).getFullYear() === selectedYear)
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstSnapshot = snapshotsForYear[0];
  const lastSnapshot = snapshotsForYear[snapshotsForYear.length - 1];
  const hasWealthChange = snapshotsForYear.length >= 2 && firstSnapshot && lastSnapshot;
  const wealthChange = hasWealthChange ? lastSnapshot.netWealth - firstSnapshot.netWealth : 0;
  const wealthChangePct = hasWealthChange && firstSnapshot.netWealth
    ? (wealthChange / firstSnapshot.netWealth) * 100
    : 0;

  // Spending by category
  const categoryData = state.categories
    .filter(c => c.type === 'expense')
    .map(category => {
      const total = transactionsForYear
        .filter(t => t.transactionKind !== 'credit-card-payment' && t.categoryId === category.id)
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        name: category.name,
        value: total,
        color: category.color,
      };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Income by category
  const incomeData = state.categories
    .filter(c => c.type === 'income')
    .map(category => {
      const total = transactionsForYear
        .filter(t => t.transactionKind !== 'credit-card-payment' && t.categoryId === category.id)
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        name: category.name,
        value: total,
        color: category.color,
      };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Calculate savings rate
  const savingsRate = totalActualIncome > 0 ? ((totalActualIncome - totalActualExpenses) / totalActualIncome) * 100 : 0;

  // Fixed vs Variable expenses
  const fixedExpenses = state.recurringTransactions
    .filter(rt => rt.type === 'expense' && rt.isActive)
    .reduce((sum, rt) => sum + (rt.amount * 12), 0); // Approximate annual amount

  const variableExpenses = totalActualExpenses - (fixedExpenses / 12 * monthlyData.filter(m => m.actualExpenses > 0).length);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('Annual Dashboard', language)} {selectedYear}</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{t('Year', language)}</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-gray-600">{t('Comprehensive overview of your financial year', language)}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100">{t('Total Income', language)}</span>
            <TrendingUp className="w-5 h-5 text-green-100" />
          </div>
          <div className="text-3xl font-bold">
            {formatCurrency(totalActualIncome, state.settings.currency, locale)}
          </div>
          <div className="text-sm text-green-100 mt-1">
            {t('Planned:', language)} {formatCurrency(totalPlannedIncome, state.settings.currency, locale)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100">{t('Total Expenses', language)}</span>
            <TrendingDown className="w-5 h-5 text-red-100" />
          </div>
          <div className="text-3xl font-bold">
            {formatCurrency(totalActualExpenses, state.settings.currency, locale)}
          </div>
          <div className="text-sm text-red-100 mt-1">
            {t('Planned:', language)} {formatCurrency(totalPlannedExpenses, state.settings.currency, locale)}
          </div>
        </div>

        <div className={`bg-gradient-to-br ${totalActualBalance >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} text-white rounded-lg shadow p-6`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/90">{t('Net Balance', language)}</span>
            <DollarSign className="w-5 h-5 text-white/90" />
          </div>
          <div className="text-3xl font-bold">
            {formatCurrency(totalActualBalance, state.settings.currency, locale)}
          </div>
          <div className="text-sm text-white/90 mt-1">
            {t('Planned:', language)} {formatCurrency(totalPlannedBalance, state.settings.currency, locale)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-100">{t('Savings Rate', language)}</span>
            <Target className="w-5 h-5 text-purple-100" />
          </div>
          <div className="text-3xl font-bold">
            {savingsRate.toFixed(1)}%
          </div>
          <div className="text-sm text-purple-100 mt-1">
            {savingsRate >= 20 ? t('Excellent!', language) : savingsRate >= 10 ? t('Good', language) : t('Room to improve', language)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600">{t('Wealth Change', language)}</span>
          <TrendingUp className={`w-5 h-5 ${wealthChange >= 0 ? 'text-green-500' : 'text-red-500'}`} />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {hasWealthChange ? formatCurrency(wealthChange, state.settings.currency, locale) : '-'}
          {hasWealthChange && (
            <span className="text-sm text-gray-500 ml-2">
              ({wealthChangePct.toFixed(1)}%)
            </span>
          )}
        </div>
        {hasWealthChange && (
          <div className="text-xs text-gray-500 mt-1">
            {formatDateDisplay(parseISO(firstSnapshot.date), language)} â†’ {formatDateDisplay(parseISO(lastSnapshot.date), language)}
          </div>
        )}
        {!hasWealthChange && (
          <div className="text-xs text-gray-500 mt-1">
            {t('No snapshots yet. Capture a snapshot to start tracking history.', language)}
          </div>
        )}
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Monthly Income vs Expenses', language)}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => formatCurrency(value, state.settings.currency, locale)} />
            <Legend />
            <Bar dataKey="actualIncome" fill="#10b981" name={t('Income', language)} />
            <Bar dataKey="actualExpenses" fill="#ef4444" name={t('Expenses', language)} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Planned vs Actual Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Planned vs Actual Balance', language)}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => formatCurrency(value, state.settings.currency, locale)} />
            <Legend />
            <Line type="monotone" dataKey="plannedBalance" stroke="#3b82f6" name={t('Planned Balance', language)} strokeWidth={2} />
            <Line type="monotone" dataKey="actualBalance" stroke="#8b5cf6" name={t('Actual Balance', language)} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Spending Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categoryData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Spending by Category', language)}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, state.settings.currency, locale)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {categoryData.slice(0, 5).map(cat => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(cat.value, state.settings.currency, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {incomeData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Income Sources', language)}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={incomeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {incomeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, state.settings.currency, locale)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {incomeData.map(cat => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(cat.value, state.settings.currency, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed vs Variable Expenses */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('Expense Breakdown', language)}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 mb-1">{t('Fixed Expenses (Annual)', language)}</div>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(fixedExpenses, state.settings.currency, locale)}
            </div>
            <div className="text-sm text-blue-600 mt-1">
              {state.recurringTransactions.filter(rt => rt.type === 'expense' && rt.isActive).length} {t('recurring items', language)}
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-orange-600 mb-1">{t('Variable Expenses (Estimated)', language)}</div>
            <div className="text-2xl font-bold text-orange-700">
              {formatCurrency(Math.max(0, variableExpenses), state.settings.currency, locale)}
            </div>
            <div className="text-sm text-orange-600 mt-1">
              {transactionsForYear.filter(t => t.type === 'expense' && t.transactionKind !== 'credit-card-payment').length} {t('transactions logged', language)}
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Financial Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5" />
            <div>
              <strong>Spending Variance:</strong> You've spent{' '}
              {totalActualExpenses > totalPlannedExpenses ? (
                <span className="text-red-600">
                  {state.settings.currency}{(totalActualExpenses - totalPlannedExpenses).toFixed(2)} more
                </span>
              ) : (
                <span className="text-green-600">
                  {state.settings.currency}{(totalPlannedExpenses - totalActualExpenses).toFixed(2)} less
                </span>
              )}{' '}
              than planned.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5" />
            <div>
              <strong>Average Monthly Spending:</strong> {state.settings.currency}
              {(totalActualExpenses / 12).toFixed(2)} per month
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-pink-500 rounded-full mt-1.5" />
            <div>
              <strong>Top Expense Category:</strong>{' '}
              {categoryData.length > 0 ? categoryData[0].name : 'None'}{' '}
              {categoryData.length > 0 && `(${state.settings.currency}${categoryData[0].value.toFixed(2)})`}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
            <div>
              <strong>Budget Performance:</strong>{' '}
              {savingsRate >= 20 ? '🎉 Excellent saving!' : savingsRate >= 10 ? '👍 Good progress' : '⚠️ Consider cutting expenses'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
