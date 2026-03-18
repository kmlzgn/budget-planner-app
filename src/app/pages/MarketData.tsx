import { useEffect, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { t } from '../utils/i18n';

export function MarketData() {
  const { state, upsertFxRate, upsertCommodityPrice, upsertFundHoldingMeta } = useBudget();
  const language = state.settings.language;
  const baseCurrency = state.settings.currency;
  const [newFxPair, setNewFxPair] = useState('');
  const [newFxRate, setNewFxRate] = useState(0);
  const [newFxMode, setNewFxMode] = useState<'manual' | 'auto'>('manual');
  const [newCommodityName, setNewCommodityName] = useState('');
  const [newCommodityPrice, setNewCommodityPrice] = useState(0);
  const [newCommodityMode, setNewCommodityMode] = useState<'manual' | 'auto'>('manual');
  const [autoFetchStatus, setAutoFetchStatus] = useState<string>('');

  const normalizePair = (pair: string) => pair.replace(/\s+/g, '').toUpperCase();
  const getFxUnitLabel = (pair: string) => {
    const normalized = normalizePair(pair);
    const [base, quote] = normalized.split('/');
    if (!base || !quote) return '-';
    return `${quote}/${base}`;
  };
  const getCommodityUnitLabel = (commodity: string) => {
    const normalized = commodity.toLowerCase();
    if (normalized.includes('gold') || normalized.includes('altin')) {
      return `${baseCurrency}/gram`;
    }
    return `${baseCurrency}/unit`;
  };
  const getFxRateFromState = (pair: string) => {
    const normalized = normalizePair(pair);
    const direct = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === normalized)?.rate;
    if (Number.isFinite(direct) && (direct as number) > 0) return direct as number;
    const [base, quote] = normalized.split('/');
    const inversePair = normalizePair(`${quote}/${base}`);
    const inverse = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === inversePair)?.rate;
    if (Number.isFinite(inverse) && (inverse as number) > 0) return 1 / (inverse as number);
    return undefined;
  };

  const fetchFxRate = async (pair: string) => {
    const normalized = normalizePair(pair);
    const [base, quote] = normalized.split('/');
    if (!base || !quote) return null;
    const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('fx_fetch_failed');
    const data = (await response.json()) as { rates?: Record<string, number> };
    const rate = data?.rates?.[quote];
    if (!Number.isFinite(rate)) return null;
    return { rate, updatedAt: new Date().toISOString() };
  };

  const fetchGoldPrice = async () => {
    const response = await fetch('https://api.gold-api.com/price/XAU');
    if (!response.ok) throw new Error('gold_fetch_failed');
    const data = (await response.json()) as { price?: number };
    const usdPerOz = Number.isFinite(data.price) ? (data.price as number) : null;
    if (!usdPerOz) return null;
    if (baseCurrency === 'USD') {
      return { price: usdPerOz, updatedAt: new Date().toISOString() };
    }
    const fxRate = getFxRateFromState(`USD/${baseCurrency}`);
    if (!fxRate) return { price: usdPerOz, updatedAt: new Date().toISOString(), note: 'usd' };
    return { price: usdPerOz * fxRate, updatedAt: new Date().toISOString() };
  };

  const handleAutoFetch = async () => {
    setAutoFetchStatus('');
    try {
      const targets = ['USD/TRY', 'EUR/TRY'];
      for (const pair of targets) {
        const existing = state.marketData.fxRates.find(rate => normalizePair(rate.pair) === normalizePair(pair));
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
      if (!state.marketData.fxRates.find(rate => normalizePair(rate.pair) === normalizePair(pair))) {
        upsertFxRate(pair, { rate: 0, mode: 'manual' });
      }
    });
    if (!state.marketData.commodities.find(item => item.commodity === 'Gold')) {
      upsertCommodityPrice('Gold', { price: 0, mode: 'manual' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddFx = () => {
    const pair = newFxPair.trim().toUpperCase();
    if (!pair || !newFxRate) return;
    upsertFxRate(pair, { rate: newFxRate, mode: newFxMode, updatedAt: new Date().toISOString() });
    setNewFxPair('');
    setNewFxRate(0);
  };

  const handleAddCommodity = () => {
    const commodity = newCommodityName.trim();
    if (!commodity || !newCommodityPrice) return;
    upsertCommodityPrice(commodity, { price: newCommodityPrice, mode: newCommodityMode, updatedAt: new Date().toISOString() });
    setNewCommodityName('');
    setNewCommodityPrice(0);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('Market Data', language)}</h1>
        <p className="text-gray-600">{t('Manage FX rates, fund prices, and commodities.', language)}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t('FX Rates', language)}</h2>
          <button
            onClick={handleAutoFetch}
            className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            {t('Auto Fetch Now', language)}
          </button>
        </div>
        {autoFetchStatus && (
          <div className="text-xs text-gray-500">{autoFetchStatus}</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={newFxPair}
            onChange={(e) => setNewFxPair(e.target.value)}
            placeholder="USD/TRY"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="number"
            value={newFxRate || ''}
            onChange={(e) => setNewFxRate(parseFloat(e.target.value) || 0)}
            step="0.0001"
            placeholder="0.0000"
            className="px-3 py-2 border border-gray-300 rounded-lg"
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
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            {t('Add', language)}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">{t('Pair', language)}</th>
                <th className="px-3 py-2 text-right">{t('Rate', language)}</th>
                <th className="px-3 py-2 text-left">{t('Unit', language)}</th>
                <th className="px-3 py-2 text-left">{t('Auto Fetch', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.marketData.fxRates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">{t('No data available.', language)}</td>
                </tr>
              ) : (
                state.marketData.fxRates.map(rate => (
                  <tr key={rate.pair}>
                    <td className="px-3 py-2">{rate.pair}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={rate.rate}
                        onChange={(e) => upsertFxRate(rate.pair, { rate: parseFloat(e.target.value) || 0, updatedAt: new Date().toISOString() })}
                        step="0.0001"
                        disabled={rate.mode === 'auto'}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{getFxUnitLabel(rate.pair)}</td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={rate.mode === 'auto'}
                          onChange={(e) => {
                            const mode = e.target.checked ? 'auto' : 'manual';
                            upsertFxRate(rate.pair, { mode, updatedAt: new Date().toISOString() });
                            if (mode === 'auto') {
                              fetchFxRate(rate.pair)
                                .then(result => {
                                  if (result) upsertFxRate(rate.pair, { rate: result.rate, updatedAt: result.updatedAt });
                                })
                                .catch(() => undefined);
                            }
                          }}
                        />
                        {t('Auto Fetch', language)}
                      </label>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{rate.updatedAt || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{t('Funds', language)}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">{t('Fund', language)}</th>
                <th className="px-3 py-2 text-right">{t('Price', language)}</th>
                <th className="px-3 py-2 text-left">{t('Unit', language)}</th>
                <th className="px-3 py-2 text-left">{t('Auto Fetch', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.fundHoldingsMeta.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">{t('No data available.', language)}</td>
                </tr>
              ) : (
                state.fundHoldingsMeta.map(meta => (
                  <tr key={meta.fund}>
                    <td className="px-3 py-2">{meta.fund}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={meta.currentPrice}
                        onChange={(e) => upsertFundHoldingMeta(meta.fund, { currentPrice: parseFloat(e.target.value) || 0, lastUpdated: new Date().toISOString() })}
                        step="0.0001"
                        disabled={meta.priceMode === 'auto'}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{baseCurrency}/unit</td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={meta.priceMode === 'auto'}
                          onChange={(e) => upsertFundHoldingMeta(meta.fund, { priceMode: e.target.checked ? 'auto' : 'manual', lastUpdated: new Date().toISOString() })}
                        />
                        {t('Auto Fetch', language)}
                      </label>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{meta.lastUpdated || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{t('Commodities', language)}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={newCommodityName}
            onChange={(e) => setNewCommodityName(e.target.value)}
            placeholder={t('Commodity', language)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="number"
            value={newCommodityPrice || ''}
            onChange={(e) => setNewCommodityPrice(parseFloat(e.target.value) || 0)}
            step="0.01"
            placeholder="0.00"
            className="px-3 py-2 border border-gray-300 rounded-lg"
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
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            {t('Add', language)}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">{t('Commodity', language)}</th>
                <th className="px-3 py-2 text-right">{t('Price', language)}</th>
                <th className="px-3 py-2 text-left">{t('Unit', language)}</th>
                <th className="px-3 py-2 text-left">{t('Auto Fetch', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.marketData.commodities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">{t('No data available.', language)}</td>
                </tr>
              ) : (
                state.marketData.commodities.map(item => (
                  <tr key={item.commodity}>
                    <td className="px-3 py-2">{item.commodity}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => upsertCommodityPrice(item.commodity, { price: parseFloat(e.target.value) || 0, updatedAt: new Date().toISOString() })}
                        step="0.01"
                        disabled={item.mode === 'auto'}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{getCommodityUnitLabel(item.commodity)}</td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={item.mode === 'auto'}
                          onChange={(e) => {
                            const mode = e.target.checked ? 'auto' : 'manual';
                            upsertCommodityPrice(item.commodity, { mode, updatedAt: new Date().toISOString() });
                            if (mode === 'auto' && item.commodity === 'Gold') {
                              fetchGoldPrice()
                                .then(result => {
                                  if (result) upsertCommodityPrice('Gold', { price: result.price, updatedAt: result.updatedAt });
                                })
                                .catch(() => undefined);
                            }
                          }}
                        />
                        {t('Auto Fetch', language)}
                      </label>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.updatedAt || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
