import { useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { BreadcrumbInline } from '../components/BreadcrumbInline';
import { AppCard } from '../components/ui/app-card';
import { SectionHeader } from '../components/ui/section-header';
import { InlineEmptyState } from '../components/ui/inline-empty-state';
import { InlineWarningCallout } from '../components/ui/inline-warning-callout';
import { formatCurrency } from '../utils/formatting';
import { t, tKey } from '../utils/i18n';
import { getPlanningSummary, PlanningBucketSummary } from '../utils/planningInsights';

const bucketColors: Record<string, string> = {
  needs: 'bg-rose-500',
  wants: 'bg-amber-500',
  savings: 'bg-emerald-500',
};

const bucketLight: Record<string, string> = {
  needs: 'bg-rose-50 text-rose-700',
  wants: 'bg-amber-50 text-amber-700',
  savings: 'bg-emerald-50 text-emerald-700',
};

const bucketBorder: Record<string, string> = {
  needs: 'border-rose-200',
  wants: 'border-amber-200',
  savings: 'border-emerald-200',
};

const statusTone = (status: PlanningBucketSummary['status']) => {
  switch (status) {
    case 'on_target':
      return 'text-emerald-700';
    case 'materially_over':
    case 'over_target':
      return 'text-rose-700';
    case 'materially_under':
    case 'under_target':
      return 'text-amber-700';
    default:
      return 'text-gray-500';
  }
};

export function FiftyThirtyTwenty() {
  const { state } = useBudget();
  const language = state.settings.language;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const summary = useMemo(
    () => getPlanningSummary(state.transactions, state.categories),
    [state.transactions, state.categories]
  );

  const formatMoney = (value: number) =>
    formatCurrency(value, state.settings.currency, locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      hideDecimalsThreshold: 0,
    });

  const hasIncome = summary.incomeTotal > 0;
  const wantsOver = summary.buckets.wants.gapAmount && summary.buckets.wants.gapAmount > 0;
  const savingsUnder = summary.buckets.savings.gapAmount && summary.buckets.savings.gapAmount < 0;

  const summaryLine = useMemo(() => {
    if (!hasIncome) {
      return t('Add income transactions to unlock accurate planning insights.', language);
    }
    if (summary.dataQuality.lowNeedsSignal || summary.dataQuality.highWantsSignal) {
      return t('Results may be distorted by category assignments.', language);
    }
    if (wantsOver && savingsUnder) {
      return t('Wants are materially above target and savings are below target.', language);
    }
    if (summary.buckets.savings.status === 'on_target') {
      return t('Your allocation is close to target with only minor adjustments needed.', language);
    }
    return t('Your allocation has clear gaps versus the 50/30/20 targets.', language);
  }, [hasIncome, language, savingsUnder, summary.dataQuality.highWantsSignal, summary.dataQuality.lowNeedsSignal, summary.buckets.savings.status, wantsOver]);

  const analysisContext = `${t('Period', language)}: ${t('All time', language)} • ${t('Based on categorized transactions', language)}`;

  const renderBucketCard = (bucket: PlanningBucketSummary) => {
    const gap = bucket.gapAmount ?? 0;
    const gapLabel = bucket.gapAmount === null
      ? t('No target comparison', language)
      : gap > 0
        ? `${t('Over target by', language)} ${formatMoney(gap)}`
        : `${t('Under target by', language)} ${formatMoney(Math.abs(gap))}`;

    return (
      <div className={`rounded-lg border ${bucketBorder[bucket.key]} p-4 ${bucketLight[bucket.key]}`}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{t(bucket.label, language)}</div>
          <div className={`text-xs ${statusTone(bucket.status)}`}>{t(bucket.status.replace('_', ' '), language)}</div>
        </div>
        <div className="mt-3 text-2xl font-semibold text-gray-900">
          {bucket.actualPercent !== null ? `${bucket.actualPercent.toFixed(1)}%` : '--'}
        </div>
        <div className="text-sm text-gray-600">
          {bucket.actualAmount > 0 ? formatMoney(bucket.actualAmount) : t('No activity', language)}
        </div>
        <div className="mt-3 text-xs text-gray-600">
          {t('Target', language)}: {bucket.targetAmount !== null ? formatMoney(bucket.targetAmount) : '--'} ({bucket.targetPercent}%)
        </div>
        <div className={`text-xs mt-1 ${statusTone(bucket.status)}`}>{gapLabel}</div>
      </div>
    );
  };

  const renderStack = (values: Array<{ key: PlanningBucketSummary['key']; percent: number }>) => (
    <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
      {values.map(value => (
        <div key={value.key} className={bucketColors[value.key]} style={{ width: `${value.percent}%` }} />
      ))}
    </div>
  );

  const driverBuckets = (['needs', 'wants', 'savings'] as PlanningBucketSummary['key'][])
    .filter(key => summary.buckets[key].drivers.length > 0);

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title mb-2">
            {tKey('Planning', language)}
            <BreadcrumbInline />
          </h1>
          <p className="app-page-subtitle">{tKey('Analyze your spending against the popular 50/30/20 budget framework', language)}</p>
          <div className="mt-3 text-sm text-gray-600">{summaryLine}</div>
          <div className="mt-2 text-xs text-gray-500">{analysisContext}</div>
        </div>
      </div>

      <AppCard>
        <SectionHeader title={t('50/30/20 Rule', language)} subtitle={t('A lightweight guideline for balanced spending.', language)} />
        <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <div className="font-semibold text-rose-700">50% {t('Needs', language)}</div>
            <div className="text-xs text-gray-600">{t('Essentials like housing, utilities, and debt minimums.', language)}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="font-semibold text-amber-700">30% {t('Wants', language)}</div>
            <div className="text-xs text-gray-600">{t('Discretionary spending such as dining, shopping, and entertainment.', language)}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="font-semibold text-emerald-700">20% {t('Savings', language)}</div>
            <div className="text-xs text-gray-600">{t('Savings, investments, and extra debt payments.', language)}</div>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <SectionHeader title={t('Income & Targets', language)} subtitle={t('Based on recorded income and categorized spending.', language)} />
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-gray-500">{t('Total Income', language)}</div>
            <div className="text-xl font-semibold text-gray-900">{hasIncome ? formatMoney(summary.incomeTotal) : '--'}</div>
          </div>
          {(['needs', 'wants', 'savings'] as PlanningBucketSummary['key'][]).map(key => (
            <div key={key} className={`rounded-lg border ${bucketBorder[key]} p-4`}> 
              <div className="text-xs text-gray-500">{t('Target', language)} {t(summary.buckets[key].label, language)}</div>
              <div className="text-lg font-semibold text-gray-900">
                {summary.buckets[key].targetAmount !== null ? formatMoney(summary.buckets[key].targetAmount) : '--'}
              </div>
              <div className="text-xs text-gray-500">{summary.buckets[key].targetPercent}%</div>
            </div>
          ))}
        </div>
      </AppCard>

      <AppCard>
        <SectionHeader title={t('Current Allocation', language)} subtitle={t('Actual versus target for each bucket.', language)} />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {renderBucketCard(summary.buckets.needs)}
          {renderBucketCard(summary.buckets.wants)}
          {renderBucketCard(summary.buckets.savings)}
        </div>
      </AppCard>

      <AppCard>
        <SectionHeader title={t('Actual vs Ideal', language)} subtitle={t('A quick comparison of your allocation.', language)} />
        {!hasIncome ? (
          <InlineEmptyState className="mt-4">{t('Add income transactions to see allocation visuals.', language)}</InlineEmptyState>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>{t('Actual', language)}</span>
                <span>{t('Based on income', language)}</span>
              </div>
              {renderStack([
                { key: 'needs', percent: summary.buckets.needs.actualPercent ?? 0 },
                { key: 'wants', percent: summary.buckets.wants.actualPercent ?? 0 },
                { key: 'savings', percent: summary.buckets.savings.actualPercent ?? 0 },
              ])}
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>{t('Ideal', language)}</span>
                <span>{t('50/30/20 target', language)}</span>
              </div>
              {renderStack([
                { key: 'needs', percent: 50 },
                { key: 'wants', percent: 30 },
                { key: 'savings', percent: 20 },
              ])}
            </div>
          </div>
        )}
      </AppCard>

      <AppCard>
        <SectionHeader title={t('Top Category Drivers', language)} subtitle={t('What is most influencing each bucket.', language)} />
        {driverBuckets.length === 0 ? (
          <InlineEmptyState className="mt-4">{t('No categorized expenses available yet.', language)}</InlineEmptyState>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {driverBuckets.map(bucketKey => {
              const bucket = summary.buckets[bucketKey];
              return (
                <div key={bucketKey} className={`rounded-lg border ${bucketBorder[bucketKey]} p-4`}>
                  <div className="text-sm font-semibold text-gray-900 mb-2">{t(bucket.label, language)}</div>
                  <div className="space-y-2 text-sm text-gray-700">
                    {bucket.drivers.map(driver => (
                      <div key={driver.categoryId} className="flex items-center justify-between">
                        <div className="truncate">{driver.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatMoney(driver.amount)} · {driver.shareOfBucket.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AppCard>

      <AppCard>
        <SectionHeader title={t('Reallocation Plan', language)} subtitle={t('Suggested adjustments to reach target.', language)} />
        <div className="mt-4 space-y-2 text-sm text-gray-700">
          {summary.reallocation.reduceWantsBy && (
            <div>• {t('Reduce Wants by', language)} {formatMoney(summary.reallocation.reduceWantsBy)} {t('to reach 30%.', language)}</div>
          )}
          {summary.reallocation.increaseSavingsBy && (
            <div>• {t('Increase Savings by', language)} {formatMoney(summary.reallocation.increaseSavingsBy)} {t('to reach 20%.', language)}</div>
          )}
          {summary.reallocation.reduceNeedsBy && (
            <div>• {t('Needs exceed target by', language)} {formatMoney(summary.reallocation.reduceNeedsBy)} {t('review essential costs.', language)}</div>
          )}
          {!summary.reallocation.reduceWantsBy && !summary.reallocation.increaseSavingsBy && !summary.reallocation.reduceNeedsBy && (
            <div>{t('No major reallocations needed based on current data.', language)}</div>
          )}
        </div>
      </AppCard>

      <AppCard>
        <SectionHeader title={t('Recommendations', language)} subtitle={t('Prioritized guidance based on your data.', language)} />
        <div className="mt-4 space-y-3">
          {summary.recommendations.map(item => (
            <div
              key={item.id}
              className={`rounded-lg border p-4 ${
                item.tone === 'positive'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : item.tone === 'warn'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <div className="text-sm font-semibold mb-1">{t(item.title, language)}</div>
              <div className="text-sm">
                {t(item.detail, language)}
                {item.amount ? ` ${formatMoney(item.amount)}` : ''}
              </div>
            </div>
          ))}
        </div>
      </AppCard>

      <AppCard>
        <SectionHeader title={t('Category Mapping & Trust', language)} subtitle={t('Results depend on category assignments.', language)} />
        <div className="mt-4 space-y-3">
          {(summary.dataQuality.lowNeedsSignal || summary.dataQuality.highWantsSignal || summary.dataQuality.uncategorizedShare && summary.dataQuality.uncategorizedShare > 10) && (
            <InlineWarningCallout>
              {t('Signals suggest some categories may need review in Setup.', language)}
            </InlineWarningCallout>
          )}
          <div className="text-sm text-gray-600">
            {t('Categories are assigned to Needs, Wants, or Savings in Setup. Edit any expense category to change its 50/30/20 classification.', language)}
          </div>
        </div>
      </AppCard>
    </div>
  );
}
