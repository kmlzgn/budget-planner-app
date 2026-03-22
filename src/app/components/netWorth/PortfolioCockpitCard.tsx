import { formatCurrency } from '../../utils/formatting';
import { t } from '../../utils/i18n';
import { FundPortfolioSummary } from '../../utils/portfolioSummaries';
import { Account } from '../../types';
import { SummaryCard } from './SummaryCard';

type AdjustedValue = { value: number };

type PortfolioCockpitCardProps = {
  language: 'en' | 'tr';
  locale: string;
  currency: string;
  fundPortfolio: FundPortfolioSummary;
  adjustedFundAssetsTotal: AdjustedValue;
  adjustedFundCostBasis: AdjustedValue;
  adjustedFundUnrealized: AdjustedValue;
  activeFundsCount: number;
  accountById: Map<string, Account>;
  onViewHoldings: () => void;
  formatIssue: (key: string, count: number) => string;
};

export const PortfolioCockpitCard = ({
  language,
  locale,
  currency,
  fundPortfolio,
  adjustedFundAssetsTotal,
  adjustedFundCostBasis,
  adjustedFundUnrealized,
  activeFundsCount,
  accountById,
  onViewHoldings,
  formatIssue,
}: PortfolioCockpitCardProps) => (
  <SummaryCard>
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-500">{t('Portfolio Cockpit', language)}</div>
      <button
        onClick={onViewHoldings}
        className="text-xs text-emerald-700 hover:underline"
      >
        {t('View holdings', language)}
      </button>
    </div>
    {fundPortfolio.lowConfidence && (
      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
        {fundPortfolio.missingPriceCount > 0 && (
          <div>{formatIssue('Fund holdings have no price for valuation.', fundPortfolio.missingPriceCount)}</div>
        )}
        {fundPortfolio.invalidTransactionCount > 0 && (
          <div>{formatIssue('Fund transactions have missing fields or zero units.', fundPortfolio.invalidTransactionCount)}</div>
        )}
      </div>
    )}
    <div className="mt-3 text-xs text-gray-500">{t('Total portfolio value', language)}</div>
    <div className="text-3xl font-bold text-gray-900">
      {formatCurrency(adjustedFundAssetsTotal.value, currency, locale)}
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600">
      <div>
        <div className="text-gray-400">{t('Cost Basis', language)}</div>
        <div className="font-semibold text-gray-900">
          {formatCurrency(adjustedFundCostBasis.value, currency, locale)}
        </div>
      </div>
      <div>
        <div className="text-gray-400">{t('Net Invested', language)}</div>
        <div className="font-semibold text-gray-900">
          {formatCurrency(fundPortfolio.netInvested, currency, locale)}
        </div>
      </div>
      <div>
        <div className="text-gray-400">{t('Unrealized P/L', language)}</div>
        <div className={adjustedFundUnrealized.value >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
          {formatCurrency(adjustedFundUnrealized.value, currency, locale)}
        </div>
      </div>
      <div>
        <div className="text-gray-400">{t('Nominal Return', language)}</div>
        <div className={`font-semibold ${fundPortfolio.nominalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {fundPortfolio.netInvested !== 0 ? `${(fundPortfolio.nominalReturn * 100).toFixed(1)}%` : '-'}
        </div>
      </div>
    </div>

    <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
      <span>{activeFundsCount} {t('active funds', language)}</span>
      <span>{t('Top holding', language)}: {fundPortfolio.topHoldingPct > 0 ? `${fundPortfolio.topHoldingPct.toFixed(1)}%` : '-'}</span>
      <span>{t('Top 3 concentration', language)}: {fundPortfolio.top3Pct > 0 ? `${fundPortfolio.top3Pct.toFixed(1)}%` : '-'}</span>
    </div>

    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      <div>
        <div className="text-gray-400">{t('Allocation by Fund', language)}</div>
        {fundPortfolio.allocationsByFund.length === 0 ? (
          <div className="text-gray-500">{t('No fund holdings yet. Add a buy to start.', language)}</div>
        ) : (
          fundPortfolio.allocationsByFund.slice(0, 3).map(item => (
            <div key={item.fund} className="flex items-center justify-between text-gray-700">
              <span className="truncate">{item.fund}</span>
              <span className="font-semibold text-gray-900">{item.pct.toFixed(1)}%</span>
            </div>
          ))
        )}
      </div>
      <div>
        <div className="text-gray-400">{t('Allocation by Account', language)}</div>
        {fundPortfolio.allocationsByAccount.length === 0 ? (
          <div className="text-gray-500">{t('No fund holdings yet. Add a buy to start.', language)}</div>
        ) : (
          fundPortfolio.allocationsByAccount.slice(0, 3).map(item => {
            const accountName = item.accountId ? accountById.get(item.accountId)?.name : t('Unassigned', language);
            return (
              <div key={item.accountId ?? 'unassigned'} className="flex items-center justify-between text-gray-700">
                <span className="truncate">{accountName}</span>
                <span className="font-semibold text-gray-900">{item.pct.toFixed(1)}%</span>
              </div>
            );
          })
        )}
      </div>
    </div>
    <div className="mt-2 text-xs text-gray-400">{t('Realized P/L (coming soon)', language)}</div>
    <div className="mt-2 text-xs text-gray-500">
      {t('Allocation by Category', language)}: {t('Category allocation not available yet.', language)}
    </div>
  </SummaryCard>
);
