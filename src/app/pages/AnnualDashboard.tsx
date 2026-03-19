import { useEffect, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { generateId } from '../utils/id';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { calculateByCategoryForMonth } from '../utils/budgetCalculations';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatDateDisplay, getMonthNames, t } from '../utils/i18n';
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

  const topDrift = driftCandidates.reduce<typeof driftCandidates[number] | null>((best, item) => {
    if (!best || item.delta > best.delta) return item;
    return best;
  }, null);
  const hasDrift = Boolean(topDrift && topDrift.delta > 0);
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

  const attentionItems: string[] = [];
  const hasNegativeCashFlow = transferAwareOutflow.hasDerivedTransfers && transferAwareOutflow.outflowExTransfers > 0
    ? transferAwareOutflow.transferAwareBalance < 0
    : cashFlow.actualBalance < 0;
  if (hasNegativeCashFlow) attentionItems.push(t('Cash flow negative this month', language));
  if (debtSummary.debtRatio !== null && debtSummary.debtRatio >= 30) {
    attentionItems.push(t('Debt payments high vs income', language));
  }
  if (snapshotChange.hasChange && snapshotChange.change < 0) {
    attentionItems.push(t('Net worth down since last snapshot', language));
  }
  if (wealthTotals.maturingIn7 > 0) {
    attentionItems.push(`${wealthTotals.maturingIn7} ${t('Maturing in 7 days', language)}`);
  }

  return (
    <div className="app-page">
      <div>
        <div className="app-page-header">
          <h1 className="app-page-title mb-2">
            {t('Overview', language)}
            <BreadcrumbInline />
          </h1>
          <div className="text-sm text-gray-500">
            {t('As of', language)} {formatDateDisplay(today, language)}
          </div>
        </div>
        <p className="text-gray-600">{t('Insight-first wealth overview', language)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="app-card app-card-padding">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Net Worth', language)}</span>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-semibold text-gray-900">
            {formatCurrency(netWorth, state.settings.currency, locale)}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span>{t('Assets', language)}: {formatCurrency(wealthTotals.totalAssets, state.settings.currency, locale)}</span>
            <span>{t('Liabilities', language)}: {formatCurrency(wealthTotals.totalLiabilities, state.settings.currency, locale)}</span>
          </div>
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

        <div className="app-card app-card-padding">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Monthly Cash Flow', language)}</span>
            <TrendingDown className={`h-5 w-5 ${cashFlow.actualBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="text-sm text-gray-500">{t('This month', language)} · {monthLabel}</div>
          <div className="mt-3 text-3xl font-semibold text-gray-900">
            {formatCurrency(cashFlow.actualBalance, state.settings.currency, locale)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600">
            <div>
              <div className="text-gray-400">{t('Actual Income', language)}</div>
              <div className="font-semibold text-gray-900">{formatCurrency(cashFlow.actualIncome, state.settings.currency, locale)}</div>
            </div>
            <div>
              <div className="text-gray-400">{t('Actual Expenses', language)}</div>
              <div className="font-semibold text-gray-900">{formatCurrency(cashFlow.actualExpenses, state.settings.currency, locale)}</div>
            </div>
            <div>
              <div className="text-gray-400">{t('Planned Income', language)}</div>
              <div className="font-semibold text-gray-900">{formatCurrency(cashFlow.plannedIncome, state.settings.currency, locale)}</div>
            </div>
            <div>
              <div className="text-gray-400">{t('Planned Expenses', language)}</div>
              <div className="font-semibold text-gray-900">{formatCurrency(cashFlow.plannedExpenses, state.settings.currency, locale)}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {t('Planned:', language)} {formatCurrency(cashFlow.plannedBalance, state.settings.currency, locale)}
          </div>
          <TransferAwareOutflowDetail
            summary={transferAwareOutflow}
            currency={state.settings.currency}
            locale={locale}
            language={language}
            size="sm"
          />
        </div>

        <div className="app-card app-card-padding">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Debt Pressure', language)}</span>
            <TrendingDown className="h-5 w-5 text-rose-500" />
          </div>
          {debtSummary.totalDebt > 0 ? (
            <>
              <div className="text-3xl font-semibold text-gray-900">
                {formatCurrency(debtSummary.totalDebt, state.settings.currency, locale)}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                {t('Min. Payments', language)}: {formatCurrency(debtSummary.minimumPayments, state.settings.currency, locale)} {t('per month', language)}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                {debtSummary.debtRatio === null
                  ? t('TODO: Log income to calculate debt pressure.', language)
                  : `${t('Debt-to-Income', language)}: ${debtSummary.debtRatio.toFixed(1)}%`}
              </div>
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
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(item.value, state.settings.currency, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">{t('No portfolio data yet. Add a holding to begin.', language)}</div>
          )}
        </div>

        <div className="app-card app-card-padding">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">{t('Top Spending Drift', language)}</span>
          </div>
          {hasDrift && topDrift ? (
            <>
              <div className="text-2xl font-semibold text-gray-900">
                {topDrift.category.name}
              </div>
              <div className="mt-2 text-sm text-rose-600">
                +{formatCurrency(topDrift.delta, state.settings.currency, locale)} {t('Over plan', language)}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                {t('Planned', language)}: {formatCurrency(topDrift.planned, state.settings.currency, locale)} · {t('Actual', language)}: {formatCurrency(topDrift.actual, state.settings.currency, locale)}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              {hasPlannedSpend
                ? t('No material spending drift detected.', language)
                : t('TODO: Add recurring plans to detect drift.', language)}
            </div>
          )}
        </div>
      </div>

      <div className="app-card app-card-padding">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-500">{t('Needs Attention', language)}</span>
        </div>
        {attentionItems.length > 0 ? (
          <ul className="space-y-2 text-sm text-gray-700">
            {attentionItems.map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-500">{t('No urgent items right now.', language)}</div>
        )}
      </div>
    </div>
  );
}


