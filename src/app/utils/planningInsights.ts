import { Category, Transaction } from '../types';

export type PlanningBucketKey = 'needs' | 'wants' | 'savings';
export type PlanningBucketStatus =
  | 'on_target'
  | 'over_target'
  | 'under_target'
  | 'materially_over'
  | 'materially_under'
  | 'insufficient_data';

export type PlanningDriver = {
  categoryId: string;
  name: string;
  amount: number;
  shareOfBucket: number;
  shareOfIncome: number | null;
};

export type PlanningBucketSummary = {
  key: PlanningBucketKey;
  label: string;
  actualAmount: number;
  actualPercent: number | null;
  targetPercent: number;
  targetAmount: number | null;
  gapAmount: number | null;
  gapPercent: number | null;
  status: PlanningBucketStatus;
  drivers: PlanningDriver[];
};

export type PlanningDataQuality = {
  incomeMissing: boolean;
  lowNeedsSignal: boolean;
  highWantsSignal: boolean;
  lowSavingsSignal: boolean;
  uncategorizedShare: number | null;
};

export type PlanningRecommendation = {
  id: string;
  title: string;
  detail: string;
  tone: 'positive' | 'warn' | 'info';
  amount?: number;
  bucket?: PlanningBucketKey;
};

export type PlanningSummary = {
  incomeTotal: number;
  totalExpenses: number;
  uncategorizedExpenseTotal: number;
  buckets: Record<PlanningBucketKey, PlanningBucketSummary>;
  dataQuality: PlanningDataQuality;
  recommendations: PlanningRecommendation[];
  reallocation: {
    reduceWantsBy: number | null;
    increaseSavingsBy: number | null;
    reduceNeedsBy: number | null;
  };
};

const TARGETS: Record<PlanningBucketKey, number> = {
  needs: 50,
  wants: 30,
  savings: 20,
};

const getBucketStatus = (gapPercent: number | null, hasIncome: boolean): PlanningBucketStatus => {
  if (!hasIncome || gapPercent === null) return 'insufficient_data';
  const absGap = Math.abs(gapPercent);
  if (absGap <= 2) return 'on_target';
  if (gapPercent > 10) return 'materially_over';
  if (gapPercent > 2) return 'over_target';
  if (gapPercent < -10) return 'materially_under';
  return 'under_target';
};

const buildDrivers = (
  entries: Array<{ categoryId: string; name: string; amount: number }>,
  bucketTotal: number,
  incomeTotal: number
): PlanningDriver[] => {
  const total = bucketTotal || 0;
  const hasIncome = incomeTotal > 0;
  return entries
    .filter(entry => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map(entry => ({
      ...entry,
      shareOfBucket: total > 0 ? (entry.amount / total) * 100 : 0,
      shareOfIncome: hasIncome ? (entry.amount / incomeTotal) * 100 : null,
    }));
};

const bucketLabelMap: Record<PlanningBucketKey, string> = {
  needs: 'Needs',
  wants: 'Wants',
  savings: 'Savings',
};

export const getPlanningSummary = (
  transactions: Transaction[],
  categories: Category[]
): PlanningSummary => {
  const incomeTotal = transactions
    .filter(t => t.type === 'income' && t.transactionKind !== 'credit-card-payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenseTransactions = transactions.filter(
    t => t.type === 'expense' && t.transactionKind !== 'credit-card-payment'
  );

  const categoryMap = new Map(categories.map(category => [category.id, category]));
  const bucketTotals: Record<PlanningBucketKey, number> = { needs: 0, wants: 0, savings: 0 };
  const bucketDrivers: Record<PlanningBucketKey, Record<string, PlanningDriver>> = {
    needs: {},
    wants: {},
    savings: {},
  } as Record<PlanningBucketKey, Record<string, PlanningDriver>>;
  let uncategorizedExpenseTotal = 0;

  expenseTransactions.forEach(transaction => {
    const category = categoryMap.get(transaction.categoryId);
    if (!category || category.classification === 'none') {
      uncategorizedExpenseTotal += transaction.amount;
      return;
    }
    const bucket = category.classification as PlanningBucketKey;
    bucketTotals[bucket] += transaction.amount;
    const existing = bucketDrivers[bucket][category.id];
    const nextAmount = (existing?.amount ?? 0) + transaction.amount;
    bucketDrivers[bucket][category.id] = {
      categoryId: category.id,
      name: category.name,
      amount: nextAmount,
      shareOfBucket: 0,
      shareOfIncome: null,
    };
  });

  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  const hasIncome = incomeTotal > 0;
  const uncategorizedShare = hasIncome ? (uncategorizedExpenseTotal / incomeTotal) * 100 : null;

  const buckets = (Object.keys(bucketTotals) as PlanningBucketKey[]).reduce((acc, key) => {
    const actualAmount = bucketTotals[key];
    const actualPercent = hasIncome ? (actualAmount / incomeTotal) * 100 : null;
    const targetPercent = TARGETS[key];
    const targetAmount = hasIncome ? incomeTotal * (targetPercent / 100) : null;
    const gapAmount = targetAmount !== null ? actualAmount - targetAmount : null;
    const gapPercent = actualPercent !== null ? actualPercent - targetPercent : null;
    const status = getBucketStatus(gapPercent, hasIncome);
    const drivers = buildDrivers(
      Object.values(bucketDrivers[key]),
      actualAmount,
      incomeTotal
    );

    acc[key] = {
      key,
      label: bucketLabelMap[key],
      actualAmount,
      actualPercent,
      targetPercent,
      targetAmount,
      gapAmount,
      gapPercent,
      status,
      drivers,
    };
    return acc;
  }, {} as Record<PlanningBucketKey, PlanningBucketSummary>);

  const dataQuality: PlanningDataQuality = {
    incomeMissing: !hasIncome,
    lowNeedsSignal: hasIncome ? (buckets.needs.actualPercent ?? 0) < 20 : false,
    highWantsSignal: hasIncome ? (buckets.wants.actualPercent ?? 0) > 60 : false,
    lowSavingsSignal: hasIncome ? (buckets.savings.actualPercent ?? 0) < 5 : false,
    uncategorizedShare,
  };

  const reallocation = {
    reduceWantsBy: hasIncome && buckets.wants.gapAmount && buckets.wants.gapAmount > 0 ? buckets.wants.gapAmount : null,
    increaseSavingsBy: hasIncome && buckets.savings.gapAmount && buckets.savings.gapAmount < 0 ? Math.abs(buckets.savings.gapAmount) : null,
    reduceNeedsBy: hasIncome && buckets.needs.gapAmount && buckets.needs.gapAmount > 0 ? buckets.needs.gapAmount : null,
  };

  const recommendations: PlanningRecommendation[] = [];
  if (dataQuality.incomeMissing) {
    recommendations.push({
      id: 'income-missing',
      title: 'Income data is missing',
      detail: 'Add income transactions to unlock an accurate 50/30/20 analysis.',
      tone: 'info',
    });
  }
  if (dataQuality.lowNeedsSignal) {
    recommendations.push({
      id: 'low-needs',
      title: 'Needs looks unusually low',
      detail: 'Review category assignments to ensure essential expenses are labeled as Needs.',
      tone: 'warn',
    });
  }
  if (dataQuality.highWantsSignal) {
    recommendations.push({
      id: 'high-wants',
      title: 'Wants allocation is high',
      detail: 'Discretionary spending appears elevated relative to target.',
      tone: 'warn',
    });
  }
  if (dataQuality.lowSavingsSignal) {
    recommendations.push({
      id: 'low-savings',
      title: 'Savings allocation is low',
      detail: 'Consider redirecting part of Wants toward Savings to reach the 20% target.',
      tone: 'warn',
    });
  }
  if (reallocation.reduceWantsBy && reallocation.reduceWantsBy > 0) {
    recommendations.push({
      id: 'reduce-wants',
      title: 'Reduce Wants to meet target',
      detail: 'Reduce Wants to align with the 30% target.',
      tone: 'info',
      amount: reallocation.reduceWantsBy,
      bucket: 'wants',
    });
  }
  if (reallocation.increaseSavingsBy && reallocation.increaseSavingsBy > 0) {
    recommendations.push({
      id: 'increase-savings',
      title: 'Increase Savings to meet target',
      detail: 'Increase Savings to reach the 20% target.',
      tone: 'info',
      amount: reallocation.increaseSavingsBy,
      bucket: 'savings',
    });
  }
  if (!dataQuality.incomeMissing && recommendations.length === 0) {
    recommendations.push({
      id: 'near-target',
      title: 'Allocation is close to target',
      detail: 'Only small adjustments are needed to maintain balance.',
      tone: 'positive',
    });
  }

  return {
    incomeTotal,
    totalExpenses,
    uncategorizedExpenseTotal,
    buckets,
    dataQuality,
    recommendations,
    reallocation,
  };
};
