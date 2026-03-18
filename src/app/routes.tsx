import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Instructions } from './pages/Instructions';
import { Setup } from './pages/Setup';
import { RecurringTransactions } from './pages/RecurringTransactions';
import { TransactionLog } from './pages/TransactionLog';
import { MonthlyOverview } from './pages/MonthlyOverview';
import { AnnualDashboard } from './pages/AnnualDashboard';
import { AccountsWealth } from './pages/AccountsWealth';
import { DebtPlanner } from './pages/DebtPlanner';
import { FiftyThirtyTwenty } from './pages/FiftyThirtyTwenty';
import { MarketData } from './pages/MarketData';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Instructions },
      { path: 'setup', Component: Setup },
      { path: 'recurring', Component: RecurringTransactions },
      { path: 'transactions', Component: TransactionLog },
      { path: 'monthly', Component: MonthlyOverview },
      { path: 'dashboard', Component: AnnualDashboard },
      { path: 'accounts', Component: AccountsWealth },
      { path: 'market', Component: MarketData },
      { path: 'debt', Component: DebtPlanner },
      { path: '503020', Component: FiftyThirtyTwenty },
    ],
  },
]);
