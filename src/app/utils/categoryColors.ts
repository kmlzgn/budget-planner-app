const incomeColors = ['#10b981', '#22c55e', '#16a34a', '#34d399', '#059669'];
const expenseColors = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6'];

export const getRandomCategoryColor = (type: 'income' | 'expense') => {
  const palette = type === 'income' ? incomeColors : expenseColors;
  return palette[Math.floor(Math.random() * palette.length)];
};
