import { BudgetState, Category } from '../types';
import { getPlanningMappingHealth } from './settingsHealth';

export type OnboardingStatus = 'completed' | 'in_progress' | 'not_started' | 'needs_review' | 'unavailable';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  status: OnboardingStatus;
  helperText?: string;
}

const hasExpenseCategories = (categories: Category[]) =>
  categories.some(category => category.type === 'expense');

export const getOnboardingSteps = (state: BudgetState): OnboardingStep[] => {
  const hasSettings = Boolean(state.settings.currency) && Boolean(state.settings.language);
  const hasCategories = state.categories.length > 0;
  const setupStatus: OnboardingStatus = hasSettings && hasCategories
    ? 'completed'
    : hasSettings || hasCategories
      ? 'in_progress'
      : 'not_started';

  const recurringCount = state.recurringTransactions.length;
  const recurringStatus: OnboardingStatus = recurringCount > 0 ? 'completed' : 'not_started';

  const transactionCount = state.transactions.length;
  const transactionsStatus: OnboardingStatus = transactionCount > 0 ? 'completed' : 'not_started';

  const cashFlowStatus: OnboardingStatus =
    recurringCount > 0 && transactionCount > 0
      ? 'completed'
      : recurringCount > 0 || transactionCount > 0
        ? 'in_progress'
        : 'not_started';

  const accountsCount = state.accounts.length;
  const accountsStatus: OnboardingStatus = accountsCount > 0 ? 'completed' : 'not_started';

  const portfolioSignal = state.fundTransactions.length > 0
    || state.fundHoldingsMeta.length > 0
    || state.marketData.fxRates.length > 0
    || state.marketData.commodities.length > 0;
  const portfolioStatus: OnboardingStatus = portfolioSignal ? 'completed' : accountsCount > 0 ? 'in_progress' : 'not_started';

  const debtStatus: OnboardingStatus = state.debts.length > 0 ? 'completed' : 'not_started';

  const planningMapping = getPlanningMappingHealth(state.categories);
  const planningStatus: OnboardingStatus = !hasExpenseCategories(state.categories)
    ? 'not_started'
    : planningMapping.hasFullCoverage
      ? 'completed'
      : planningMapping.hasAnyExpense
        ? 'needs_review'
        : 'not_started';

  return [
    {
      id: 'setup',
      title: 'Setup & Configuration',
      description: 'Define currency, language, and your category structure.',
      path: '/setup',
      ctaLabel: 'Open Setup',
      status: setupStatus,
    },
    {
      id: 'recurring',
      title: 'Recurring Transactions',
      description: 'Add recurring income and bills to auto-build your monthly plan.',
      path: '/recurring',
      ctaLabel: 'Add Recurring',
      status: recurringStatus,
    },
    {
      id: 'transactions',
      title: 'Transaction Log',
      description: 'Log real income and expenses to measure actual performance.',
      path: '/transactions',
      ctaLabel: 'Log Transactions',
      status: transactionsStatus,
    },
    {
      id: 'cash-flow',
      title: 'Monthly Review / Cash Flow',
      description: 'Review planned vs actual results and identify variances.',
      path: '/cash-flow',
      ctaLabel: 'Review Cash Flow',
      status: cashFlowStatus,
    },
    {
      id: 'net-worth',
      title: 'Net Worth / Accounts',
      description: 'Add accounts to unlock net worth, wealth, and allocations.',
      path: '/net-worth',
      ctaLabel: 'Add Accounts',
      status: accountsStatus,
    },
    {
      id: 'portfolio',
      title: 'Portfolio / Market Data',
      description: 'Configure FX, funds, or commodities for valuation accuracy.',
      path: '/portfolio',
      ctaLabel: 'Open Portfolio',
      status: portfolioStatus,
      helperText: portfolioStatus === 'in_progress'
        ? 'Accounts are set, but pricing data is still missing.'
        : undefined,
    },
    {
      id: 'debt',
      title: 'Debt Planner',
      description: 'Add debts to simulate payoff strategies and impact.',
      path: '/debt',
      ctaLabel: 'Open Debt Planner',
      status: debtStatus,
    },
    {
      id: 'planning',
      title: 'Planning / 50-30-20',
      description: 'Check allocation insights once expenses are categorized.',
      path: '/planning',
      ctaLabel: 'Open Planning',
      status: planningStatus,
      helperText: planningStatus === 'needs_review'
        ? 'Some expense categories are unclassified.'
        : undefined,
    },
  ];
};

export const getOnboardingProgress = (steps: OnboardingStep[]) => {
  const total = steps.length;
  const completed = steps.filter(step => step.status === 'completed').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
};

export const getNextBestStep = (steps: OnboardingStep[]) =>
  steps.find(step => step.status === 'not_started')
  ?? steps.find(step => step.status === 'in_progress')
  ?? steps.find(step => step.status === 'needs_review')
  ?? steps[0];

export const getOnboardingSuggestions = (steps: OnboardingStep[]) => {
  const suggestions: OnboardingStep[] = [];
  const findStep = (id: string) => steps.find(step => step.id === id);

  const setup = findStep('setup');
  if (setup && setup.status !== 'completed') suggestions.push(setup);

  const recurring = findStep('recurring');
  const transactions = findStep('transactions');
  if (recurring && recurring.status !== 'completed') suggestions.push(recurring);
  if (transactions && transactions.status !== 'completed') suggestions.push(transactions);

  const planning = findStep('planning');
  if (planning && planning.status === 'needs_review') suggestions.push(planning);

  const accounts = findStep('net-worth');
  if (accounts && accounts.status !== 'completed') suggestions.push(accounts);

  const portfolio = findStep('portfolio');
  if (portfolio && portfolio.status !== 'completed') suggestions.push(portfolio);

  return suggestions.slice(0, 3);
};

export const getOnboardingTips = (steps: OnboardingStep[]) => {
  const tips: { id: string; text: string }[] = [];
  const findStep = (id: string) => steps.find(step => step.id === id);
  const setup = findStep('setup');
  const transactions = findStep('transactions');
  const planning = findStep('planning');
  const portfolio = findStep('portfolio');

  if (transactions && transactions.status !== 'completed') {
    tips.push({ id: 'transactions', text: 'Cash Flow insights stay limited until you log real transactions.' });
  }
  if (planning && planning.status === 'needs_review') {
    tips.push({ id: 'planning', text: 'Planning accuracy improves once all expense categories are classified.' });
  }
  if (portfolio && portfolio.status !== 'completed') {
    tips.push({ id: 'portfolio', text: 'Portfolio valuation is more trustworthy after FX or fund prices are set.' });
  }
  if (setup && setup.status !== 'completed') {
    tips.push({ id: 'setup', text: 'Finish core setup to unlock the rest of the experience.' });
  }

  return tips.slice(0, 3);
};
