import { useBudget } from './BudgetContext';

export const useBudgetState = () => useBudget().state;

export const useSettingsDomain = () => {
  const { state, updateSettings } = useBudget();
  return { settings: state.settings, updateSettings };
};

export const useAccountsDomain = () => {
  const { state, addAccount, updateAccount, deleteAccount } = useBudget();
  return { accounts: state.accounts, addAccount, updateAccount, deleteAccount };
};

export const useSavingsGoalsDomain = () => {
  const { state, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useBudget();
  return { savingsGoals: state.savingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal };
};

export const useWealthSnapshotsDomain = () => {
  const { state, addWealthSnapshot } = useBudget();
  return { wealthSnapshots: state.wealthSnapshots, addWealthSnapshot };
};

export const useTransactionsDomain = () => {
  const { state, addTransaction, addTransactions, updateTransaction, deleteTransaction } = useBudget();
  return { transactions: state.transactions, addTransaction, addTransactions, updateTransaction, deleteTransaction };
};

export const useFundsDomain = () => {
  const {
    state,
    addFundTransaction,
    addFundTransactions,
    updateFundTransaction,
    deleteFundTransaction,
    upsertFundHoldingMeta,
  } = useBudget();
  return {
    fundTransactions: state.fundTransactions,
    fundHoldingsMeta: state.fundHoldingsMeta,
    addFundTransaction,
    addFundTransactions,
    updateFundTransaction,
    deleteFundTransaction,
    upsertFundHoldingMeta,
  };
};

export const useDepositsDomain = () => {
  const { state, addDeposit, addDeposits, updateDeposit, deleteDeposit } = useBudget();
  return { deposits: state.deposits, addDeposit, addDeposits, updateDeposit, deleteDeposit };
};
