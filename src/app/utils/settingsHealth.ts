import { Category, Settings } from '../types';

export const getCategoryBucketCounts = (categories: Category[]) => {
  const expenseCategories = categories.filter(category => category.type === 'expense');
  const incomeCategories = categories.filter(category => category.type === 'income');
  const counts = expenseCategories.reduce(
    (acc, category) => {
      const classification = category.classification ?? 'none';
      if (classification === 'needs') acc.needs += 1;
      else if (classification === 'wants') acc.wants += 1;
      else if (classification === 'savings') acc.savings += 1;
      else acc.none += 1;
      return acc;
    },
    { needs: 0, wants: 0, savings: 0, none: 0 }
  );

  return {
    ...counts,
    totalExpense: expenseCategories.length,
    totalIncome: incomeCategories.length,
  };
};

export const getUnclassifiedExpenseCategories = (categories: Category[]) =>
  categories.filter(category => category.type === 'expense' && (!category.classification || category.classification === 'none'));

export const getPlanningMappingHealth = (categories: Category[]) => {
  const counts = getCategoryBucketCounts(categories);
  const totalExpense = counts.totalExpense;
  const missing = counts.none;
  const coverage = totalExpense > 0 ? (totalExpense - missing) / totalExpense : 0;

  return {
    counts,
    totalExpense,
    missing,
    coverage,
    hasAnyExpense: totalExpense > 0,
    hasFullCoverage: totalExpense > 0 && missing === 0,
  };
};

export const getSettingsHealthSummary = (settings: Settings, categories: Category[]) => {
  const mapping = getPlanningMappingHealth(categories);
  return {
    hasCurrency: Boolean(settings.currency),
    hasLanguage: Boolean(settings.language),
    expenseCategoryCount: mapping.totalExpense,
    unclassifiedExpenseCount: mapping.missing,
    mappingComplete: mapping.hasFullCoverage,
  };
};
