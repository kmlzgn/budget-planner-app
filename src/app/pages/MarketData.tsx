import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { t } from '../utils/i18n';

export function MarketData() {
  const { state, upsertFxRate, upsertCommodityPrice, upsertFundHoldingMeta } = useBudget();
  const language = state.settings.language;
  const [newFxPair, setNewFxPair] = useState('');
  const [newFxRate, setNewFxRate] = useState(0);
  const [newFxMode, setNewFxMode] = useState<'manual' | 'auto'>('manual');
  const [newCommodityName, setNewCommodityName] = useState('');
  const [newCommodityPrice, setNewCommodityPrice] = useState(0);
  const [newCommodityMode, setNewCommodityMode] = useState<'manual' | 'auto'>('manual');

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
        </div>
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
          <select
            value={newFxMode}
            onChange={(e) => setNewFxMode(e.target.value as 'manual' | 'auto')}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="manual">{t('Manual', language)}</option>
            <option value="auto">{t('Auto Fetch', language)}</option>
          </select>
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
                <th className="px-3 py-2 text-left">{t('Mode', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.marketData.fxRates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">{t('No data available.', language)}</td>
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
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={rate.mode}
                        onChange={(e) => upsertFxRate(rate.pair, { mode: e.target.value as 'manual' | 'auto', updatedAt: new Date().toISOString() })}
                        className="px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        <option value="manual">{t('Manual', language)}</option>
                        <option value="auto">{t('Auto Fetch', language)}</option>
                      </select>
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
                <th className="px-3 py-2 text-left">{t('Mode', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.fundHoldingsMeta.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">{t('No data available.', language)}</td>
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
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={meta.priceMode ?? 'manual'}
                        onChange={(e) => upsertFundHoldingMeta(meta.fund, { priceMode: e.target.value as 'manual' | 'auto', lastUpdated: new Date().toISOString() })}
                        className="px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        <option value="manual">{t('Manual', language)}</option>
                        <option value="auto">{t('Auto Fetch', language)}</option>
                      </select>
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
          <select
            value={newCommodityMode}
            onChange={(e) => setNewCommodityMode(e.target.value as 'manual' | 'auto')}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="manual">{t('Manual', language)}</option>
            <option value="auto">{t('Auto Fetch', language)}</option>
          </select>
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
                <th className="px-3 py-2 text-left">{t('Mode', language)}</th>
                <th className="px-3 py-2 text-left">{t('Last Updated', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {state.marketData.commodities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">{t('No data available.', language)}</td>
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
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={item.mode}
                        onChange={(e) => upsertCommodityPrice(item.commodity, { mode: e.target.value as 'manual' | 'auto', updatedAt: new Date().toISOString() })}
                        className="px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        <option value="manual">{t('Manual', language)}</option>
                        <option value="auto">{t('Auto Fetch', language)}</option>
                      </select>
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
