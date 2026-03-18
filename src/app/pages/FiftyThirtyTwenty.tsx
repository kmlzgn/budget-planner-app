import { useBudget } from '../context/BudgetContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { calculate503020 } from '../utils/budgetCalculations';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

export function FiftyThirtyTwenty() {
  const { state } = useBudget();

  const totalIncome = state.transactions
    .filter(t => t.type === 'income' && t.transactionKind !== 'credit-card-payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const breakdown = calculate503020(state.transactions, state.categories);

  const idealNeeds = totalIncome * 0.5;
  const idealWants = totalIncome * 0.3;
  const idealSavings = totalIncome * 0.2;

  const needsVariance = breakdown.needs - idealNeeds;
  const wantsVariance = breakdown.wants - idealWants;
  const savingsVariance = breakdown.savings - idealSavings;

  const chartData = [
    { name: 'Needs', value: breakdown.needs, color: '#ef4444', ideal: 50 },
    { name: 'Wants', value: breakdown.wants, color: '#f59e0b', ideal: 30 },
    { name: 'Savings', value: breakdown.savings, color: '#10b981', ideal: 20 },
  ];

  const idealChartData = [
    { name: 'Needs (50%)', value: 50, color: '#ef4444' },
    { name: 'Wants (30%)', value: 30, color: '#f59e0b' },
    { name: 'Savings (20%)', value: 20, color: '#10b981' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">50/30/20 Budgeting Rule</h1>
        <p className="text-gray-600">Analyze your spending against the popular 50/30/20 budget framework</p>
      </div>

      {/* Rule Explanation */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">What is the 50/30/20 Rule?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-white rounded-lg border-l-4 border-red-500">
            <div className="font-semibold text-lg text-red-600 mb-1">50% Needs</div>
            <p className="text-gray-600">
              Essential expenses like housing, utilities, groceries, transportation, healthcare, and minimum debt payments.
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg border-l-4 border-orange-500">
            <div className="font-semibold text-lg text-orange-600 mb-1">30% Wants</div>
            <p className="text-gray-600">
              Discretionary spending on entertainment, dining out, hobbies, subscriptions, and other non-essentials.
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg border-l-4 border-green-500">
            <div className="font-semibold text-lg text-green-600 mb-1">20% Savings</div>
            <p className="text-gray-600">
              Financial goals including emergency fund, retirement savings, investments, and extra debt payments.
            </p>
          </div>
        </div>
      </div>

      {/* Income Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Income</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 mb-1">Total Income</div>
            <div className="text-2xl font-bold text-blue-700">
              {state.settings.currency}{totalIncome.toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-sm text-red-600 mb-1">Ideal Needs (50%)</div>
            <div className="text-2xl font-bold text-red-700">
              {state.settings.currency}{idealNeeds.toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-orange-600 mb-1">Ideal Wants (30%)</div>
            <div className="text-2xl font-bold text-orange-700">
              {state.settings.currency}{idealWants.toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600 mb-1">Ideal Savings (20%)</div>
            <div className="text-2xl font-bold text-green-700">
              {state.settings.currency}{idealSavings.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Current vs Ideal Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Current Breakdown</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Needs */}
          <div className="p-6 bg-red-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-700">Needs</span>
              {needsVariance <= 0 ? (
                <TrendingDown className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingUp className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div className="text-3xl font-bold text-red-700 mb-1">
              {breakdown.needsPercent.toFixed(1)}%
            </div>
            <div className="text-lg font-semibold text-red-600 mb-2">
              {state.settings.currency}{breakdown.needs.toFixed(2)}
            </div>
            <div className={`text-sm ${needsVariance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {needsVariance > 0 ? '+' : ''}{state.settings.currency}{needsVariance.toFixed(2)} vs ideal
            </div>
            <div className="mt-3">
              <div className="w-full bg-red-200 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{ width: `${Math.min((breakdown.needsPercent / 50) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-red-600 mt-1">
                Target: 50% • {breakdown.needsPercent > 50 ? 'Over' : 'Under'} by {Math.abs(breakdown.needsPercent - 50).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Wants */}
          <div className="p-6 bg-orange-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-700">Wants</span>
              {wantsVariance <= 0 ? (
                <TrendingDown className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingUp className="w-5 h-5 text-orange-600" />
              )}
            </div>
            <div className="text-3xl font-bold text-orange-700 mb-1">
              {breakdown.wantsPercent.toFixed(1)}%
            </div>
            <div className="text-lg font-semibold text-orange-600 mb-2">
              {state.settings.currency}{breakdown.wants.toFixed(2)}
            </div>
            <div className={`text-sm ${wantsVariance <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {wantsVariance > 0 ? '+' : ''}{state.settings.currency}{wantsVariance.toFixed(2)} vs ideal
            </div>
            <div className="mt-3">
              <div className="w-full bg-orange-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ width: `${Math.min((breakdown.wantsPercent / 30) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-orange-600 mt-1">
                Target: 30% • {breakdown.wantsPercent > 30 ? 'Over' : 'Under'} by {Math.abs(breakdown.wantsPercent - 30).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Savings */}
          <div className="p-6 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-700">Savings</span>
              {savingsVariance >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div className="text-3xl font-bold text-green-700 mb-1">
              {breakdown.savingsPercent.toFixed(1)}%
            </div>
            <div className="text-lg font-semibold text-green-600 mb-2">
              {state.settings.currency}{breakdown.savings.toFixed(2)}
            </div>
            <div className={`text-sm ${savingsVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {savingsVariance > 0 ? '+' : ''}{state.settings.currency}{savingsVariance.toFixed(2)} vs ideal
            </div>
            <div className="mt-3">
              <div className="w-full bg-green-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min((breakdown.savingsPercent / 20) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-green-600 mt-1">
                Target: 20% • {breakdown.savingsPercent > 20 ? 'Over' : 'Under'} by {Math.abs(breakdown.savingsPercent - 20).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Actual Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${state.settings.currency}${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ideal 50/30/20 Split</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={idealChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name }) => name}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {idealChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Recommendations</h2>
        <div className="space-y-3">
          {breakdown.needsPercent > 50 && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <div className="font-semibold text-red-800 mb-1">⚠️ Needs are too high</div>
              <p className="text-sm text-red-700">
                Your essential expenses are {breakdown.needsPercent.toFixed(1)}% of income. Consider reducing housing costs, 
                refinancing loans, or finding ways to lower utilities and transportation expenses.
              </p>
            </div>
          )}
          
          {breakdown.wantsPercent > 30 && (
            <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded">
              <div className="font-semibold text-orange-800 mb-1">💸 Want spending is high</div>
              <p className="text-sm text-orange-700">
                You're spending {breakdown.wantsPercent.toFixed(1)}% on wants. Try cutting back on dining out, 
                entertainment subscriptions, or shopping to redirect funds toward savings and debt payoff.
              </p>
            </div>
          )}
          
          {breakdown.savingsPercent < 20 && (
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <div className="font-semibold text-yellow-800 mb-1">📉 Savings rate is low</div>
              <p className="text-sm text-yellow-700">
                You're only saving {breakdown.savingsPercent.toFixed(1)}% of income. Aim to increase this to at least 20% 
                by automating savings, reducing discretionary spending, or finding ways to increase income.
              </p>
            </div>
          )}

          {breakdown.needsPercent <= 50 && breakdown.wantsPercent <= 30 && breakdown.savingsPercent >= 20 && (
            <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded">
              <div className="font-semibold text-green-800 mb-1">🎉 Excellent budget balance!</div>
              <p className="text-sm text-green-700">
                Your spending aligns well with the 50/30/20 rule. Keep up the great work! Continue monitoring 
                and adjusting as your income and circumstances change.
              </p>
            </div>
          )}

          {totalIncome === 0 && (
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <div className="font-semibold text-blue-800 mb-1">ℹ️ No income data yet</div>
              <p className="text-sm text-blue-700">
                Add income transactions to see your 50/30/20 breakdown. Go to the Transaction Log to get started!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Category Assignment Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-2 text-blue-900">How Categories are Assigned</h3>
        <p className="text-sm text-blue-800">
          Categories are assigned to Needs, Wants, or Savings in Setup. Edit any expense category to change its
          50/30/20 classification.
        </p>
      </div>
    </div>
  );
}
