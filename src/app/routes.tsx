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
      { index: true, Component: Instructions },
      { path: 'settings', Component: Setup },
      { path: 'recurring', Component: RecurringTransactions },
      { path: 'transactions', Component: TransactionLog },
      { path: 'cash-flow', Component: MonthlyOverview },
      { path: 'overview', Component: AnnualDashboard },
      { path: 'net-worth', Component: AccountsWealth },
      { path: 'portfolio', Component: MarketData },
      { path: 'debt', Component: DebtPlanner },
      { path: 'planning', Component: FiftyThirtyTwenty },
      { path: 'setup', Component: () => <Redirect to="/settings" /> },
      { path: 'monthly', Component: () => <Redirect to="/cash-flow" /> },
      { path: 'dashboard', Component: () => <Redirect to="/overview" /> },
      { path: 'accounts', Component: () => <Redirect to="/net-worth" /> },
      { path: 'market', Component: () => <Redirect to="/portfolio" /> },
      { path: '503020', Component: () => <Redirect to="/planning" /> },
      { path: 'tools', Component: () => <Redirect to="/" /> },
      { path: 'tools/instructions', Component: () => <Redirect to="/" /> },
      { path: 'tools/transactions', Component: () => <Redirect to="/transactions" /> },
      { path: 'tools/recurring', Component: () => <Redirect to="/recurring" /> },
    ],
  },
]);
