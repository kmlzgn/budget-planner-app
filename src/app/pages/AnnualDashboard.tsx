import { useEffect, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { generateId } from '../utils/id';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { calculateByCategoryForMonth } from '../utils/budgetCalculations';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { formatDateDisplay, getMonthNames, t, tKey } from '../utils/i18n';
import { formatCurrency } from '../utils/formatting';
import {
  getDebtSummary,
  getMonthlyCashFlowSummary,
  getNetWorthSummary,
  getPortfolioAllocation,
  getSnapshotChangeSummary,
  getTransferAwareMonthlyOutflowSummary,
} from '../utils/financeSummaries';
import { BreadcrumbInline } from '../components/BreadcrumbInline';
import { TransferAwareOutflowDetail } from '../components/TransferAwareOutflowDetail';

export function AnnualDashboard() {
  const { state, addWealthSnapshot } = useBudget();
  const [showSnapshotConfirmation, setShowSnapshotConfirmation] = useState(false);
  useEffect(() => {
    if (!showSnapshotConfirmation) return;
    const timer = window.setTimeout(() => {
      setShowSnapshotConfirmation(false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [showSnapshotConfirmation]);

  const language = state.settings.language;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const monthNames = getMonthNames(language, 'long');
  const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;

  const cashFlow = getMonthlyCashFlowSummary(
    state.transactions,
    state.recurringTransactions,
    currentYear,
    currentMonth
  );
  const wealthTotals = getNetWorthSummary(state, today);
  const netWorth = wealthTotals.netWorth;
  const snapshotChange = getSnapshotChangeSummary(state.wealthSnapshots);
  const debtSummary = getDebtSummary(state.debts, cashFlow.actualIncome);

  const todayStr = today.toISOString().slice(0, 10);
  const transferAwareOutflow = getTransferAwareMonthlyOutflowSummary(state, currentYear, currentMonth);


  const handleCaptureSnapshot = () => {
    setShowSnapshotConfirmation(true);
    addWealthSnapshot({
      id: generateId(),
      date: todayStr,
      totalAssets: wealthTotals.totalAssets,
      totalDebts: wealthTotals.totalLiabilities,
      netWealth: netWorth,
      cash: wealthTotals.cashTotal,
      funds: wealthTotals.fundAssetsTotal,
      deposits: wealthTotals.depositsTotal,
      gold: wealthTotals.goldTotal,
      blockedAssets: wealthTotals.blockedAssetsTotal,
      otherAssets: wealthTotals.otherAssetsTotal,
    });
  };

  const driftCandidates = state.categories
    .filter(category => category.type === 'expense')
    .map(category => {
      const { planned, actual } = calculateByCategoryForMonth(
        state.transactions,
        state.recurringTransactions,
        currentYear,
        currentMonth,
        category.id
      );
      return {
        category,
        planned,
        actual,
        delta: actual - planned,
      };
    })
    .filter(item => item.actual > 0);

  const driftItems = [...driftCandidates]
    .filter(item => item.planned > 0 || item.actual > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  const topDrift = driftItems[0] ?? null;
  const hasDrift = Boolean(topDrift && topDrift.delta !== 0);
  const hasPlannedSpend = state.recurringTransactions.some(rt => rt.isActive && rt.type === 'expense');

  const allocation = getPortfolioAllocation(wealthTotals, {
    cash: t('Cash', language),
    funds: t('Funds', language),
    deposits: t('Deposits', language),
    gold: t('Gold', language),
    blocked: t('Blocked', language),
    other: t('Other', language),
  });
  const allocationTotal = allocation.reduce((sum, item) => sum + item.value, 0);
  const sortedAllocation = [...allocation].sort((a, b) => b.value - a.value);
  const topAllocation = sortedAllocation[0];
  const topAllocationPct = allocationTotal > 0 && topAllocation
    ? (topAllocation.value / allocationTotal) * 100
    : 0;
  const topThreeAllocationPct = allocationTotal > 0
    ? (sortedAllocation.slice(0, 3).reduce((sum, item) => sum + item.value, 0) / allocationTotal) * 100
    : 0;

  const formatCurrencyLeadSign = (value: number) => {
    const absFormatted = formatCurrency(Math.abs(value), state.settings.currency, locale);
    if (value < 0) {
      return `-${absFormatted.replace(`${state.settings.currency} `, `${state.settings.currency}`)}`;
    }
    return absFormatted;
  };

  const getCashFlowTone = (value: number) => (value >= 0 ? 'text-emerald-600' : 'text-rose-600');
  const getDebtRiskTone = (ratio: number) => {
    if (ratio >= 35) return 'text-rose-600';
    if (ratio >= 20) return 'text-amber-600';
    return 'text-emerald-600';
  };
  const getDebtRiskLabel = (ratio: number) => {
    if (ratio >= 35) return t('High', language);
    if (ratio >= 20) return t('Moderate', language);
    return t('Low', language);
  };

  const snapshotTrend = snapshotChange.hasChange
    ? (snapshotChange.change > 0 ? 'up' : snapshotChange.change < 0 ? 'down' : 'flat')
    : 'none';
  const cashFlowTrend = cashFlow.actualBalance > 0 ? 'positive' : cashFlow.actualBalance < 0 ? 'negative' : 'flat';

  const netWorthSummarySentence = snapshotTrend === 'up'
    ? t('Net worth is up since last snapshot', language)
    : snapshotTrend === 'down'
      ? t('Net worth is down since last snapshot', language)
      : snapshotTrend === 'flat'
        ? t('Net worth is stable since last snapshot', language)
        : t('Net worth history is not available yet', language);
  const cashFlowSummarySentence = cashFlowTrend === 'positive'
    ? t('Cash flow is positive this month', language)
    : cashFlowTrend === 'negative'
      ? t('Cash flow is negative this month', language)
      : t('Cash flow is flat this month', language);
  const headerSummary = `${netWorthSummarySentence}; ${cashFlowSummarySentence}.`;

  type AttentionItem = {
    id: string;
    label: string;
    tone: 'high' | 'medium' | 'low';
    actionLabel?: string;
    actionTo?: string;
    onAction?: () => void;
  };
  const attentionItems: AttentionItem[] = [];
  const hasNegativeCashFlow = transferAwareOutflow.hasDerivedTransfers && transferAwareOutflow.outflowExTransfers > 0
    ? transferAwareOutflow.transferAwareBalance < 0
    : cashFlow.actualBalance < 0;
  if (hasNegativeCashFlow) {
    attentionItems.push({
      id: 'cashflow-negative',
      label: t('Cash flow negative this month', language),
      tone: 'high',
      actionLabel: t('Review cash flow', language),
      actionTo: '/cash-flow',
    });
  }
  if (debtSummary.debtRatio !== null && debtSummary.debtRatio >= 30) {
    attentionItems.push({
      id: 'debt-pressure',
      label: t('Debt payments high vs income', language),
      tone: 'medium',
      actionLabel: t('Review debt plan', language),
      actionTo: '/debt',
    });
  }
  if (hasDrift && topDrift && topDrift.delta > 0) {
    attentionItems.push({
      id: 'spending-drift',
      label: `${t('Spending over plan in', language)} ${topDrift.category.name}`,
      tone: 'medium',
      actionLabel: t('Review budget drift', language),
      actionTo: '/cash-flow',
    });
  }
  if (snapshotChange.hasChange && snapshotChange.change < 0) {
    attentionItems.push({
      id: 'networth-down',
      label: t('Net worth down since last snapshot', language),
      tone: 'medium',
      actionLabel: t('Review net worth', language),
      actionTo: '/net-worth',
    });
  }
  if (wealthTotals.maturingIn7 > 0) {
    attentionItems.push({
      id: 'maturing-deposits',
      label: `${wealthTotals.maturingIn7} ${t('Maturing in 7 days', language)}`,
      tone: 'low',
      actionLabel: t('Review deposits', language),
      actionTo: '/net-worth',
    });
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title mb-2">
            {tKey('Overview', language)}
            <BreadcrumbInline />
          </h1>
          <div className="text-sm text-gray-600">{headerSummary}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            {t('Period', language)}: {monthLabel}
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            {t('Currency', language)}: {state.settings.currency}
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            {tKey('As of', language)} {formatDateDisplay(today, language)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="app-card app-card-padding lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Net Worth', language)}</span>
            {snapshotTrend === 'down' ? (
              <TrendingDown className="h-5 w-5 text-rose-500" />
            ) : (
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <div className="text-4xl font-semibold text-gray-900 tabular-nums">
            {formatCurrency(netWorth, state.settings.currency, locale)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <div className="text-gray-400">{t('Assets', language)}</div>
              <div className="font-semibold text-gray-900">{formatCurrency(wealthTotals.totalAssets, state.settings.currency, locale)}</div>
            </div>
            <div>
              <div className="text-gray-400">{t('Liabilities', language)}</div>
              <div className="font-semibold text-gray-900">{formatCurrency(wealthTotals.totalLiabilities, state.settings.currency, locale)}</div>
            </div>
          </div>
          {topAllocation && allocationTotal > 0 && (
            <div className="mt-3 text-xs text-gray-500">
              {t('Largest allocation', language)}: {topAllocation.name} ({topAllocationPct.toFixed(0)}%)
            </div>
          )}
          <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {snapshotChange.hasChange ? (
              <div className="flex items-center justify-between gap-2">
                <span>{t('Change since last snapshot', language)}</span>
                <span className={snapshotChange.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatCurrency(snapshotChange.change, state.settings.currency, locale)}
                  {snapshotChange.prevSnapshot?.netWealth
                    ? ` (${snapshotChange.changePct.toFixed(1)}%)`
                    : ''}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{t('No snapshots yet. Capture a snapshot to start tracking history.', language)}</span>
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                >
                  {t('Capture Snapshot', language)}
                </button>
                {showSnapshotConfirmation && (
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {t('Snapshot captured.', language)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="app-card app-card-padding lg:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Monthly Cash Flow', language)}</span>
            <TrendingDown className={`h-5 w-5 ${cashFlow.actualBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="text-sm text-gray-500">{t('This month', language)} · {monthLabel}</div>
          <div className={`mt-3 text-3xl font-semibold tabular-nums ${getCashFlowTone(cashFlow.actualBalance)}`}>
            {formatCurrencyLeadSign(cashFlow.actualBalance)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <div className="text-gray-400">{t('Actual Income', language)}</div>
              <div className="font-semibold text-gray-900">{formatCurrency(cashFlow.actualIncome, state.settings.currency, locale)}</div>
            </div>
            <div>
              <div className="text-gray-400">{t('Actual Expenses', language)}</div>
              <div className="font-semibold text-gray-900">{formatCurrency(cashFlow.actualExpenses, state.settings.currency, locale)}</div>
            </div>
          </div>
          {(cashFlow.plannedIncome > 0 || cashFlow.plannedExpenses > 0) && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>{t('Vs plan', language)}</span>
              <span className={getCashFlowTone(cashFlow.actualBalance - cashFlow.plannedBalance)}>
                {formatCurrencyLeadSign(cashFlow.actualBalance - cashFlow.plannedBalance)}
              </span>
            </div>
          )}
          <div className="mt-2 text-xs text-gray-500">
            {cashFlow.plannedExpenses > 0 && cashFlow.actualExpenses > cashFlow.plannedExpenses
              ? t('Expenses exceeded plan this month', language)
              : cashFlow.plannedIncome > 0 && cashFlow.actualIncome < cashFlow.plannedIncome
                ? t('Income below plan this month', language)
                : cashFlow.actualBalance < 0
                  ? t('Spending exceeded income this month', language)
                  : t('Cash flow is on track', language)}
          </div>
          <TransferAwareOutflowDetail
            summary={transferAwareOutflow}
            currency={state.settings.currency}
            locale={locale}
            language={language}
            size="sm"
          />
        </div>

        <div className="app-card app-card-padding lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Debt Pressure', language)}</span>
            <TrendingDown className="h-5 w-5 text-rose-500" />
          </div>
          {debtSummary.totalDebt > 0 ? (
            <>
              <div className="text-3xl font-semibold text-gray-900 tabular-nums">
                {formatCurrency(debtSummary.totalDebt, state.settings.currency, locale)}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                {t('Min. Payments', language)}: {formatCurrency(debtSummary.minimumPayments, state.settings.currency, locale)} {t('per month', language)}
              </div>
              {debtSummary.debtRatio === null ? (
                <div className="mt-3 text-xs text-gray-500">
                  {t('Add income data to calculate burden.', language)}
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{t('Debt-to-Income', language)}</span>
                  <span className={`font-semibold ${getDebtRiskTone(debtSummary.debtRatio)}`}>
                    {debtSummary.debtRatio.toFixed(1)}% · {getDebtRiskLabel(debtSummary.debtRatio)}
                  </span>
                </div>
              )}
              {debtSummary.minimumPayments === 0 && (
                <div className="mt-2 text-xs text-amber-600">
                  {t('Minimum payments missing for some debts.', language)}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500">{t('No debt data yet. Add a debt to see guidance.', language)}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="app-card app-card-padding">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Portfolio Allocation', language)}</span>
          </div>
          {allocationTotal > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {allocation.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value, state.settings.currency, locale)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm">
                {allocation.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 tabular-nums">
                        {formatCurrency(item.value, state.settings.currency, locale)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {allocationTotal > 0 ? `${((item.value / allocationTotal) * 100).toFixed(0)}%` : '0%'}
                      </div>
                    </div>
                  </div>
                ))}
                {topAllocation && (
                  <div className="pt-2 text-xs text-gray-500">
                    {t('Largest allocation', language)}: {topAllocation.name} ({topAllocationPct.toFixed(0)}%)
                  </div>
                )}
                {allocation.length >= 3 && (
                  <div className="text-xs text-gray-500">
                    {t('Top 3 concentration', language)}: {topThreeAllocationPct.toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">{t('No portfolio data yet. Add a holding to begin.', language)}</div>
          )}
        </div>

        <div className="app-card app-card-padding">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Budget Drift', language)}</span>
          </div>
          {hasPlannedSpend && hasDrift ? (
            <div className="space-y-3">
              {driftItems.map(item => {
                const isOver = item.delta > 0;
                return (
                  <div key={item.category.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{item.category.name}</div>
                      <div className="text-xs text-gray-500">
                        {t('Planned', language)}: {formatCurrency(item.planned, state.settings.currency, locale)} · {t('Actual', language)}: {formatCurrency(item.actual, state.settings.currency, locale)}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${isOver ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isOver ? '+' : '-'}
                      {formatCurrency(Math.abs(item.delta), state.settings.currency, locale)} {t(isOver ? 'Over plan' : 'Under plan', language)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {hasPlannedSpend
                ? t('No material spending drift detected.', language)
                : t('Add recurring plans to track variances.', language)}
            </div>
          )}
        </div>
      </div>

      <div className="app-card app-card-padding">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-500">{t('Needs Attention', language)}</span>
        </div>
        {attentionItems.length > 0 ? (
          <ul className="space-y-3 text-sm text-gray-700">
            {attentionItems.slice(0, 5).map(item => {
              const toneClass = item.tone === 'high'
                ? 'bg-rose-500'
                : item.tone === 'medium'
                  ? 'bg-amber-500'
                  : 'bg-gray-400';
              return (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 rounded-full ${toneClass}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.actionTo ? (
                    <Link to={item.actionTo} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                      {item.actionLabel}
                    </Link>
                  ) : item.onAction ? (
                    <button
                      type="button"
                      onClick={item.onAction}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      {item.actionLabel}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-sm text-gray-500">{t('No urgent items right now.', language)}</div>
        )}
      </div>
    </div>
  );
}


