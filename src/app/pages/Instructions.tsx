import { BookOpen, Settings, Repeat, FileText, Calendar, BarChart3, Wallet, CreditCard, PieChart } from 'lucide-react';
import { BreadcrumbInline } from '../components/BreadcrumbInline';

export function Instructions() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg p-8">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-10 h-10" />
          <h1 className="text-3xl font-bold">
            Welcome to Your Annual Budget Planner
            <BreadcrumbInline />
          </h1>
        </div>
        <p className="text-emerald-50">
          A comprehensive tool to manage your finances, track expenses, and achieve your financial goals throughout 2026.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">How to Use This Planner</h2>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">1. Setup & Configuration</h3>
              <p className="text-gray-600">
                Start by configuring your budget settings. Choose your currency, set your budget start month/year, 
                select your budget method (Zero-based or Carryover), add family members, and customize your income 
                and expense categories.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Repeat className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">2. Recurring Transactions</h3>
              <p className="text-gray-600">
                Add all your recurring transactions including salary, bills, subscriptions, and automatic savings. 
                Set the frequency (weekly, monthly, etc.) and the system will automatically calculate your planned 
                budget for each month.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">3. Transaction Log</h3>
              <p className="text-gray-600">
                Record all your variable expenses and one-time income here. Each transaction can be assigned to 
                a category, account, and family member. This is where you track your actual spending versus your plan.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">4. Monthly Overview</h3>
              <p className="text-gray-600">
                View detailed breakdowns for each month showing planned vs actual income and expenses. 
                The calendar view displays all your transactions and recurring items visually for easy tracking.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">5. Annual Dashboard</h3>
              <p className="text-gray-600">
                See your complete financial picture for the year with automatic totals, spending distribution charts, 
                year-over-year comparisons, and insights into your financial habits.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">6. Accounts & Wealth Tracking</h3>
              <p className="text-gray-600">
                Track multiple bank accounts, credit cards, and investments. Monitor your net worth, 
                set up sinking funds, and track progress toward your savings goals.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">7. Debt Planner</h3>
              <p className="text-gray-600">
                Manage your debts with either the Snowball or Avalanche method. Track loan balances, 
                interest rates, and see visual payoff timelines to stay motivated.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <PieChart className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">8. 50/30/20 Rule</h3>
              <p className="text-gray-600">
                Analyze your spending against the popular 50/30/20 budgeting rule: 50% for needs, 
                30% for wants, and 20% for savings. Get insights on how to balance your budget.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-2 text-amber-900">💡 Pro Tips</h3>
        <ul className="space-y-2 text-amber-800">
          <li>• <strong>Start with Setup:</strong> Configure all your settings and categories before adding transactions</li>
          <li>• <strong>Use Recurring Transactions:</strong> Set up all predictable income and expenses to automate your planning</li>
          <li>• <strong>Regular Updates:</strong> Update your Transaction Log regularly to keep actual data current</li>
          <li>• <strong>Review Monthly:</strong> Check your Monthly Overview at the end of each month to see how you're tracking</li>
          <li>• <strong>Data Persistence:</strong> All your data is saved automatically in your browser's local storage</li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-2 text-blue-900">📊 Color Coding</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-blue-800">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Under budget / Positive balance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Over budget / Negative balance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Warning / Close to limit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Income / Assets</span>
          </div>
        </div>
      </div>

      <div className="text-center text-gray-500 text-sm pt-4">
        <p>Ready to take control of your finances? Navigate to <strong>Setup & Configuration</strong> to begin!</p>
      </div>
    </div>
  );
}
