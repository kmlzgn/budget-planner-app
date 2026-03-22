import { useEffect, useMemo, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { t, tKey } from '../utils/i18n';
import { BreadcrumbInline } from '../components/BreadcrumbInline';
import { MoneyField } from '../components/inputs/MoneyField';
import { AppCard } from '../components/ui/app-card';
import { SectionHeader } from '../components/ui/section-header';
import { SecondaryButton } from '../components/ui/app-buttons';
import { InlineEmptyState } from '../components/ui/inline-empty-state';
import {
  MarketDataStatus,
  MarketDataTone,
  formatFxMeaning,
  formatRelativeUpdateTime,
  getCommodityDisplayState,
  getFundStatus,
  getFxStatus,
  getMarketDataHealth,
  normalizeFxPair,
  parseFxPair,
} from '../utils/marketDataSelectors';
import { formatLocalizedNumber } from '../utils/formatting';

const STALE_DAYS = 3;

const statusToneClasses: Record<MarketDataTone, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
  bad: 'border-rose-200 bg-rose-50 text-rose-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function MarketData() {
  const { state, upsertFxRate, upsertCommodityPrice, upsertFundHoldingMeta } = useBudget();
  const language = state.settings.language;
  const baseCurrency = state.settings.currency;
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const now = useMemo(() => new Date(), [state.marketData, state.fundHoldingsMeta]);
  const [newFxPair, setNewFxPair] = useState('');
  const [newFxRate, setNewFxRate] = useState(0);
  const [newFxMode, setNewFxMode] = useState<'manual' | 'auto'>('manual');
  const [newFxError, setNewFxError] = useState<string | null>(null);
  const [newCommodityName, setNewCommodityName] = useState('');
  const [newCommodityPrice, setNewCommodityPrice] = useState(0);
  const [newCommodityMode, setNewCommodityMode] = useState<'manual' | 'auto'>('manual');
  const [autoFetchStatus, setAutoFetchStatus] = useState<string>('');

  const healthSummary = useMemo(
    () =>
      getMarketDataHealth(
        state.marketData.fxRates,
        state.fundHoldingsMeta,
        state.marketData.commodities,
        baseCurrency,
        now,
        STALE_DAYS
      ),
    [state.marketData.fxRates, state.marketData.commodities, state.fundHoldingsMeta, baseCurrency, now]
  );

  const totalIssues =
    healthSummary.fxMissing +
    healthSummary.fxStale +
    healthSummary.fundMissing +
    healthSummary.fundStale +
    healthSummary.commodityMissing +
    healthSummary.commodityDependency;

  const statusLabel = (status: MarketDataStatus) => {
    switch (status) {
      case 'ok':
        return t('Live', language);
      case 'manual':
        return t('Manual', language);
      case 'missing':
        return t('Missing', language);
      case 'stale':
        return t('Stale', language);
      case 'derived':
        return t('Derived', language);
      case 'dependency':
        return t('Dependency issue', language);
      default:
        return t('Status', language);
    }
  };

  const sourceLabel = (mode: 'manual' | 'auto') => (mode === 'auto' ? t('Auto', language) : t('Manual', language));

  const renderStatusBadge = (status: MarketDataStatus, tone: MarketDataTone) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusToneClasses[tone]}`}>
      {statusLabel(status)}
    </span>
  );

  const freshnessLabel = (updatedAt: string | undefined) => formatRelativeUpdateTime(updatedAt, now, locale);

  const formatNumber = (value: number | null, fractionDigits = 2) => {
    if (value === null || !Number.isFinite(value)) return '-';
    return formatLocalizedNumber(value, locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  };

  const fetchFxRate = async (pair: string) => {
    const parsed = parseFxPair(pair);
    if (!parsed) return null;
    const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(parsed.base)}&symbols=${encodeURIComponent(parsed.quote)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('fx_fetch_failed');
    const data = (await response.json()) as { rates?: Record<string, number> };
    const rate = data?.rates?.[parsed.quote];
    if (!Number.isFinite(rate)) return null;
    return { rate, updatedAt: new Date().toISOString() };
  };

  const fetchGoldPrice = async () => {
    const response = await fetch('https://api.gold-api.com/price/XAU');
    if (!response.ok) throw new Error('gold_fetch_failed');
    const data = (await response.json()) as { price?: number };
    const usdPerOz = Number.isFinite(data.price) ? (data.price as number) : null;
    if (!usdPerOz) return null;
    return { price: usdPerOz, updatedAt: new Date().toISOString() };
  };

  const handleAutoFetch = async () => {
    setAutoFetchStatus('');
    try {
      const targets = ['USD/TRY', 'EUR/TRY'];
      for (const pair of targets) {
        const existing = state.marketData.fxRates.find(rate => normalizeFxPair(rate.pair) === normalizeFxPair(pair));
        if (existing && existing.mode !== 'auto') continue;
        const result = await fetchFxRate(pair);
        if (result) {
          upsertFxRate(pair, { rate: result.rate, updatedAt: result.updatedAt });
        }
      }
      const goldItem = state.marketData.commodities.find(item => item.commodity === 'Gold');
      if (!goldItem || goldItem.mode === 'auto') {
        const goldResult = await fetchGoldPrice();
        if (goldResult) {
          upsertCommodityPrice('Gold', { price: goldResult.price, updatedAt: goldResult.updatedAt });
        }
      }
      setAutoFetchStatus(t('Auto fetch completed.', language));
    } catch {
      setAutoFetchStatus(t('Auto fetch failed. Using last known values.', language));
    }
  };

  useEffect(() => {
    const defaults = ['USD/TRY', 'EUR/TRY'];
    defaults.forEach(pair => {
      if (!state.marketData.fxRates.find(rate => normalizeFxPair(rate.pair) === normalizeFxPair(pair))) {
        upsertFxRate(pair, { rate: 0, mode: 'manual' });
      }
    });
    if (!state.marketData.commodities.find(item => item.commodity === 'Gold')) {
      upsertCommodityPrice('Gold', { price: 0, mode: 'manual' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddFx = () => {
    const parsed = parseFxPair(newFxPair.trim());
    if (!parsed) {
      setNewFxError(t('Enter a pair like USD/TRY.', language));
      return;
    }
    if (!Number.isFinite(newFxRate) || newFxRate <= 0) {
      setNewFxError(t('Enter a valid rate.', language));
      return;
    }
    if (state.marketData.fxRates.some(rate => normalizeFxPair(rate.pair) === parsed.pair)) {
      setNewFxError(t('This FX pair already exists.', language));
      return;
    }
    upsertFxRate(parsed.pair, { rate: newFxRate, mode: newFxMode, updatedAt: new Date().toISOString() });
    setNewFxPair('');
    setNewFxRate(0);
    setNewFxError(null);
  };

  const handleAddCommodity = () => {
    const commodity = newCommodityName.trim();
    if (!commodity || !newCommodityPrice) return;
    upsertCommodityPrice(commodity, { price: newCommodityPrice, mode: newCommodityMode, updatedAt: new Date().toISOString() });
    setNewCommodityName('');
    setNewCommodityPrice(0);
  };

  const latestAutoUpdateLabel = healthSummary.latestAutoUpdate
    ? freshnessLabel(healthSummary.latestAutoUpdate)
    : t('No recent updates', language);

  const headerSummary = totalIssues === 0
    ? t('All market data looks healthy.', language)
    : t('Market data needs attention.', language);

  const fxHealthy = healthSummary.fxMissing === 0 && healthSummary.fxStale === 0;
  const fundHealthy = healthSummary.fundMissing === 0 && healthSummary.fundStale === 0;
  const commodityHealthy = healthSummary.commodityMissing === 0 && healthSummary.commodityDependency === 0;

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title mb-2">
            {tKey('Portfolio', language)}
            <BreadcrumbInline />
          </h1>
          <p className="app-page-subtitle">
            {t('Market data powering FX, fund, and commodity valuation.', language)}
          </p>
          <div className="mt-3 text-sm text-gray-600">{headerSummary}</div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>{t('Base currency', language)}: {baseCurrency}</span>
            <span>{t('Latest auto update', language)}: {latestAutoUpdateLabel}</span>
          </div>
        </div>
        <div className="app-page-header-actions">
          <SecondaryButton onClick={handleAutoFetch}>
            {t('Auto Fetch Now', language)}
          </SecondaryButton>
          {autoFetchStatus && (
            <div className="text-xs text-gray-500 text-right">{autoFetchStatus}</div>
          )}
        </div>
      </div>

      <AppCard>
        <SectionHeader
          title={t('Market data health', language)}
          subtitle={t('Visibility into pricing coverage, freshness, and dependencies.', language)}
        />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">{t('FX Rates', language)}</div>
            <div className="mt-2 flex items-center gap-2">
              {renderStatusBadge(fxHealthy ? 'ok' : 'stale', fxHealthy ? 'good' : 'warn')}
              <span className="text-sm text-gray-700">
                {fxHealthy
                  ? t('All FX rates healthy', language)
                  : `${healthSummary.fxMissing} ${t('missing', language)}, ${healthSummary.fxStale} ${t('stale', language)}`}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">{t('Funds', language)}</div>
            <div className="mt-2 flex items-center gap-2">
              {renderStatusBadge(fundHealthy ? 'ok' : 'stale', fundHealthy ? 'good' : 'warn')}
              <span className="text-sm text-gray-700">
                {fundHealthy
                  ? t('Fund prices are complete', language)
                  : `${healthSummary.fundMissing} ${t('missing', language)}, ${healthSummary.fundStale} ${t('stale', language)}`}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">{t('Commodities', language)}</div>
            <div className="mt-2 flex items-center gap-2">
              {renderStatusBadge(commodityHealthy ? 'ok' : 'dependency', commodityHealthy ? 'good' : 'warn')}
              <span className="text-sm text-gray-700">
                {commodityHealthy
                  ? t('Commodity pricing healthy', language)
                  : `${healthSummary.commodityMissing} ${t('missing', language)}, ${healthSummary.commodityDependency} ${t('dependency', language)}`}
              </span>
            </div>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <SectionHeader
          title={t('FX Rates', language)}
          subtitle={t('FX rates power conversion across the app.', language)}
        />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <input
              type="text"
              value={newFxPair}
              onChange={(e) => {
                setNewFxPair(e.target.value);
                setNewFxError(null);
              }}
              placeholder="USD/TRY"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="mt-1 text-[11px] text-gray-500">
              {t('Use BASE/QUOTE (e.g. USD/TRY).', language)}
            </div>
          </div>
          <MoneyField
            value={newFxRate || 0}
            onValueChange={(value) => setNewFxRate(value)}
            locale={locale}
            placeholder="0.00"
            disabled={newFxMode === 'auto'}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${newFxMode === 'auto' ? 'bg-gray-100 text-gray-500' : ''}`}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={newFxMode === 'auto'}
              onChange={(e) => setNewFxMode(e.target.checked ? 'auto' : 'manual')}
            />
            {t('Auto Fetch', language)}
          </label>
          <button
            onClick={handleAddFx}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            {t('Add', language)}
          </button>
        </div>
        {newFxError && (
          <div className="mt-2 text-xs text-rose-600">{newFxError}</div>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">{t('Pair', language)}</th>
                <th className="px-3 py-2 text-right">{t('Rate', language)}</th>
                <th className="px-3 py-2 text-left">{t('Meaning', language)}</th>
                <th className="px-3 py-2 text-left">{t('Source', language)}</th>
                <th className="px-3 py-2 text-left">{t('Health', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.marketData.fxRates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4">
                    <InlineEmptyState>{t('No data available.', language)}</InlineEmptyState>
                  </td>
                </tr>
              ) : (
                state.marketData.fxRates.map(rate => {
                  const parsed = parseFxPair(rate.pair);
                  const displayPair = parsed?.pair ?? rate.pair;
                  const status = getFxStatus(rate, now, STALE_DAYS);
                  return (
                    <tr key={rate.pair}>
                      <td className="px-3 py-2 font-medium text-gray-900">{displayPair}</td>
                      <td className="px-3 py-2 text-right">
                        <MoneyField
                          value={rate.rate}
                          onValueChange={(value) =>
                            upsertFxRate(rate.pair, { rate: value, updatedAt: new Date().toISOString() })
                          }
                          locale={locale}
                          disabled={rate.mode === 'auto'}
                          className={`w-24 px-2 py-1 border border-gray-300 rounded text-right ${rate.mode === 'auto' ? 'bg-gray-100 text-gray-500' : ''}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {formatFxMeaning(displayPair, rate.rate, locale)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        <div>{sourceLabel(rate.mode)}</div>
                        {rate.mode === 'auto' && (
                          <div className="text-[11px] text-gray-400">{t('Auto fetched', language)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {renderStatusBadge(status.status, status.tone)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {freshnessLabel(rate.updatedAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AppCard>

      <AppCard>
        <SectionHeader
          title={t('Funds', language)}
          subtitle={t('Fund prices drive portfolio valuation.', language)}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">{t('Fund', language)}</th>
                <th className="px-3 py-2 text-right">{t('Price', language)}</th>
                <th className="px-3 py-2 text-left">{t('Source', language)}</th>
                <th className="px-3 py-2 text-left">{t('Health', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.fundHoldingsMeta.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4">
                    <InlineEmptyState>{t('No data available.', language)}</InlineEmptyState>
                  </td>
                </tr>
              ) : (
                state.fundHoldingsMeta.map(meta => {
                  const status = getFundStatus(meta, now, STALE_DAYS);
                  return (
                    <tr key={meta.fund}>
                      <td className="px-3 py-2 font-medium text-gray-900">{meta.fund}</td>
                      <td className="px-3 py-2 text-right">
                        <MoneyField
                          value={meta.currentPrice}
                          onValueChange={(value) => upsertFundHoldingMeta(meta.fund, { currentPrice: value, lastUpdated: new Date().toISOString() })}
                          locale={locale}
                          disabled={meta.priceMode === 'auto'}
                          className={`w-24 px-2 py-1 border border-gray-300 rounded text-right ${meta.priceMode === 'auto' ? 'bg-gray-100 text-gray-500' : ''}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        <div>{sourceLabel(meta.priceMode)}</div>
                        {meta.priceMode === 'auto' && (
                          <div className="text-[11px] text-gray-400">{t('Auto fetched', language)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {renderStatusBadge(status.status, status.tone)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {freshnessLabel(meta.lastUpdated)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AppCard>

      <AppCard>
        <SectionHeader
          title={t('Commodities', language)}
          subtitle={t('Commodities depend on FX and unit conversion.', language)}
        />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={newCommodityName}
            onChange={(e) => setNewCommodityName(e.target.value)}
            placeholder={t('Commodity', language)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <MoneyField
            value={newCommodityPrice || 0}
            onValueChange={(value) => setNewCommodityPrice(value)}
            locale={locale}
            placeholder="0.00"
            disabled={newCommodityMode === 'auto'}
            className={`px-3 py-2 border border-gray-300 rounded-lg ${newCommodityMode === 'auto' ? 'bg-gray-100 text-gray-500' : ''}`}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={newCommodityMode === 'auto'}
              onChange={(e) => setNewCommodityMode(e.target.checked ? 'auto' : 'manual')}
            />
            {t('Auto Fetch', language)}
          </label>
          <button
            onClick={handleAddCommodity}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            {t('Add', language)}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">{t('Commodity', language)}</th>
                <th className="px-3 py-2 text-right">{t('Price', language)}</th>
                <th className="px-3 py-2 text-left">{t('Unit', language)}</th>
                <th className="px-3 py-2 text-left">{t('Source', language)}</th>
                <th className="px-3 py-2 text-left">{t('Health', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.marketData.commodities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4">
                    <InlineEmptyState>{t('No data available.', language)}</InlineEmptyState>
                  </td>
                </tr>
              ) : (
                state.marketData.commodities.map(item => {
                  const displayState = getCommodityDisplayState(item, baseCurrency, state.marketData.fxRates, now, STALE_DAYS);
                  const isAuto = item.mode === 'auto';
                  const priceLabel = displayState.displayPrice === null
                    ? t('Missing price', language)
                    : `${formatNumber(displayState.displayPrice)} ${displayState.displayUnit.split('/')[0]}`;
                  return (
                    <tr key={item.commodity}>
                      <td className="px-3 py-2 font-medium text-gray-900">{item.commodity}</td>
                      <td className="px-3 py-2 text-right">
                        {isAuto ? (
                          <div className="text-sm text-gray-900">{priceLabel}</div>
                        ) : (
                          <MoneyField
                            value={displayState.displayPrice ?? item.price}
                            onValueChange={(value) =>
                              upsertCommodityPrice(item.commodity, { price: value, updatedAt: new Date().toISOString() })
                            }
                            locale={locale}
                            disabled={false}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        <div>{displayState.displayUnit}</div>
                        <div className="text-[11px] text-gray-400">{t('Source', language)}: {displayState.sourceUnit}</div>
                        {displayState.dependencyPair && (
                          <div className="text-[11px] text-amber-600">
                            {displayState.status === 'dependency'
                              ? `${t('Missing', language)} ${displayState.dependencyPair}`
                              : `${t('Uses', language)} ${displayState.dependencyPairUsed ?? displayState.dependencyPair}`}
                            {displayState.dependencyIsInverse ? ` (${t('inverse rate', language)})` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        <div>{sourceLabel(item.mode)}</div>
                        {item.mode === 'auto' && (
                          <div className="text-[11px] text-gray-400">{t('Auto fetched', language)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {renderStatusBadge(displayState.status, displayState.tone)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {freshnessLabel(item.updatedAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AppCard>
    </div>
  );
}
