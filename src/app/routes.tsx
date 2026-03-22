import { createBrowserRouter, Navigate } from 'react-router';
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

const Redirect = ({ to }: { to: string }) => <Navigate to={to} replace />;

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: () => <Redirect to="/overview" /> },
      { path: 'settings', Component: Setup },
      { path: 'recurring', Component: () => <Redirect to="/tools/recurring" /> },
      { path: 'transactions', Component: () => <Redirect to="/tools/transactions" /> },
      { path: 'cash-flow', Component: MonthlyOverview },
      { path: 'overview', Component: AnnualDashboard },
      { path: 'net-worth', Component: AccountsWealth },
      { path: 'portfolio', Component: MarketData },
      { path: 'debt', Component: DebtPlanner },
      { path: 'planning', Component: FiftyThirtyTwenty },
      // Legacy aliases for backward compatibility.
      { path: 'setup', Component: () => <Redirect to="/settings" /> },
      { path: 'monthly', Component: () => <Redirect to="/cash-flow" /> },
      { path: 'dashboard', Component: () => <Redirect to="/overview" /> },
      { path: 'accounts', Component: () => <Redirect to="/net-worth" /> },
      { path: 'market', Component: () => <Redirect to="/portfolio" /> },
      { path: '503020', Component: () => <Redirect to="/planning" /> },
      // Tools (canonical).
      { path: 'tools', Component: () => <Redirect to="/tools/instructions" /> },
      { path: 'tools/instructions', Component: Instructions },
      { path: 'tools/transactions', Component: TransactionLog },
      { path: 'tools/recurring', Component: RecurringTransactions },
    ],
  },
]);
