import { Outlet } from 'react-router';
import { useEffect, useState } from 'react';
import { Navigation } from './Navigation';
import { useBudget } from '../context/BudgetContext';
import { RotateCcw } from 'lucide-react';
import { t } from '../utils/i18n';
import { Button } from './ui/button';
import { SidebarInset, SidebarProvider, useSidebar } from './ui/sidebar';
import { MenuOpen as MenuOpenIcon } from '@mui/icons-material';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

function MobileSidebarToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="fixed left-3 top-3 z-20 md:hidden">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 bg-white/90 shadow"
        onClick={toggleSidebar}
      >
        <MenuOpenIcon className="h-5 w-5" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    </div>
  );
}

export function Layout() {
  const { resetData, state } = useBudget();
  const language = state.settings.language;
  const resetKeys = [
    'transactions',
    'deposits',
    'accounts',
    'categories',
    'funds',
    'fundPrices',
    'debts',
    'savingsGoals',
    'recurringTransactions',
    'wealthSnapshots',
  ] as const;
  type ResetKey = (typeof resetKeys)[number];
  const resetLabels: Record<ResetKey, string> = {
    transactions: 'Transactions',
    deposits: 'Deposits',
    accounts: 'Accounts',
    categories: 'Categories',
    funds: 'Funds',
    fundPrices: 'Fund Prices',
    debts: 'Debts',
    savingsGoals: 'Savings Goals',
    recurringTransactions: 'Recurring Transactions',
    wealthSnapshots: 'Wealth Snapshots',
  };
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetSelection, setResetSelection] = useState<Record<ResetKey, boolean>>(() =>
    resetKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<ResetKey, boolean>)
  );

  useEffect(() => {
    if (isResetOpen) {
      setResetSelection(
        resetKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<ResetKey, boolean>)
      );
    }
  }, [isResetOpen]);

  const resetCounts: Record<ResetKey, number> = {
    transactions: state.transactions.length,
    deposits: state.deposits.length,
    accounts: state.accounts.length,
    categories: state.categories.length,
    funds: state.fundTransactions.length,
    fundPrices: state.fundHoldingsMeta.length,
    debts: state.debts.length,
    savingsGoals: state.savingsGoals.length,
    recurringTransactions: state.recurringTransactions.length,
    wealthSnapshots: state.wealthSnapshots.length,
  };

  const handleResetSelected = () => {
    resetData(resetSelection);
    setIsResetOpen(false);
  };

  return (
    <SidebarProvider>
      <Navigation />
      <SidebarInset className="min-h-screen bg-gray-50">
        <MobileSidebarToggle />
        <main className="pb-8">
          <Outlet />
        </main>
        <footer className="fixed bottom-4 right-4 z-10">
          <button
            onClick={() => setIsResetOpen(true)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
            title={t('Reset Data', language)}
          >
            <RotateCcw className="w-4 h-4" />
            {t('Reset Data', language)}
          </button>
        </footer>
      </SidebarInset>
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Reset Data', language)}</DialogTitle>
            <DialogDescription>
              {t('Select which datasets to delete. Only selected data will be removed.', language)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <button
              onClick={() => setResetSelection(resetKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<ResetKey, boolean>))}
              className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              {t('Select All', language)}
            </button>
            <button
              onClick={() => setResetSelection(resetKeys.reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<ResetKey, boolean>))}
              className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              {t('Clear All', language)}
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 space-y-2">
            {resetKeys.map(key => (
              <label key={key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={resetSelection[key]}
                    onChange={() => setResetSelection(prev => ({ ...prev, [key]: !prev[key] }))}
                  />
                  <span>{t(resetLabels[key], language)}</span>
                </div>
                <span className="text-gray-500">{resetCounts[key]}</span>
              </label>
            ))}
          </div>
          <div className="text-xs text-gray-500">
            {t('This action cannot be undone.', language)}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <button
              onClick={() => setIsResetOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('Cancel', language)}
            </button>
            <button
              onClick={handleResetSelected}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              disabled={!Object.values(resetSelection).some(Boolean)}
            >
              {t('Delete Selected Data', language)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
