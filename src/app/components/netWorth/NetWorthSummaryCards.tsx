import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency, formatCurrencyWithSign } from '../../utils/formatting';
import { t } from '../../utils/i18n';
import { SummaryCard } from './SummaryCard';

type AdjustedValue = { value: number };

type NetWorthSummaryCardsProps = {
  language: 'en' | 'tr';
  locale: string;
  currency: string;
  adjustedCashTotal: AdjustedValue;
  adjustedFundAssetsTotal: AdjustedValue;
  adjustedFundCostBasis: AdjustedValue;
  adjustedFundUnrealized: AdjustedValue;
  adjustedGoldTotal: AdjustedValue;
  adjustedDepositsTotal: AdjustedValue;
  adjustedLiabilitiesTotal: AdjustedValue;
  adjustedNetWorth: AdjustedValue;
  fundUnrealizedPnLPct: number;
  activeFundsCount: number;
  netWorth: number;
  activeDepositCount: number;
  maturingIn7: number;
};

export const NetWorthSummaryCards = ({
  language,
  locale,
  currency,
  adjustedCashTotal,
  adjustedFundAssetsTotal,
  adjustedFundCostBasis,
  adjustedFundUnrealized,
  adjustedGoldTotal,
  adjustedDepositsTotal,
  adjustedLiabilitiesTotal,
  adjustedNetWorth,
  fundUnrealizedPnLPct,
  activeFundsCount,
  netWorth,
  activeDepositCount,
  maturingIn7,
}: NetWorthSummaryCardsProps) => {
  const totalAssets = adjustedNetWorth.value + adjustedLiabilitiesTotal.value;
  const liabilityRatio = totalAssets > 0 ? adjustedLiabilitiesTotal.value / totalAssets : 0;
  const netWorthInsight = totalAssets > 0
    ? liabilityRatio < 0.2
      ? t('Debt impact is low', language)
      : liabilityRatio > 0.5
        ? t('Liabilities are significant', language)
        : t('Assets outweigh liabilities', language)
    : t('No data available.', language);

  const cashInsight = adjustedCashTotal.value < 0
    ? t('Negative balance', language)
    : adjustedCashTotal.value == 0
      ? t('No cash holdings', language)
      : t('Stable cash reserve', language);

  const fundInsight = adjustedFundCostBasis.value > 0
    ? `${t('Unrealized P/L', language)} ${fundUnrealizedPnLPct.toFixed(1)}%`
    : t('No fund holdings yet. Add a buy to start.', language);

  const depositsInsight = maturingIn7 > 0
    ? t('Maturity approaching', language)
    : t('No upcoming maturities', language);

  const debtInsight = adjustedLiabilitiesTotal.value == 0
    ? t('No debts recorded', language)
    : liabilityRatio < 0.3
      ? t('Manageable', language)
      : t('Needs attention', language);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
      <SummaryCard className="lg:col-span-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">{t('Net Worth', language)}</div>
          {netWorth >= 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-500" />
          )}
        </div>
        <div className={`mt-2 text-3xl font-bold tabular-nums ${netWorth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {formatCurrencyWithSign(adjustedNetWorth.value, currency, locale)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
          <div>
            <div className="text-gray-400">{t('Assets', language)}</div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(totalAssets, currency, locale)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">{t('Liabilities', language)}</div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(adjustedLiabilitiesTotal.value, currency, locale)}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">{netWorthInsight}</div>
      </SummaryCard>

      <SummaryCard className="lg:col-span-3">
        <div className="text-sm text-gray-500">{t('Cash', language)}</div>
        <div className={`mt-2 text-2xl font-bold tabular-nums ${adjustedCashTotal.value < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
          {formatCurrencyWithSign(adjustedCashTotal.value, currency, locale)}
        </div>
        <div className={`text-xs mt-2 ${adjustedCashTotal.value < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
          {cashInsight}
        </div>
      </SummaryCard>

      <SummaryCard className="lg:col-span-4 border border-emerald-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">{t('Funds', language)}</div>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-gray-900 mt-2">
          {formatCurrency(adjustedFundAssetsTotal.value, currency, locale)}
        </div>
        <div className="mt-2 text-xs text-gray-600">
          {t('Cost Basis', language)}: {formatCurrency(adjustedFundCostBasis.value, currency, locale)}
        </div>
        <div className={`text-xs ${adjustedFundUnrealized.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {t('Unrealized P/L', language)}: {formatCurrency(adjustedFundUnrealized.value, currency, locale)} ({fundUnrealizedPnLPct.toFixed(1)}%)
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {fundInsight}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {activeFundsCount} {t('active funds', language)}
        </div>
      </SummaryCard>

      <SummaryCard className="lg:col-span-4">
        <div className="text-sm text-gray-500">{t('Deposits', language)}</div>
        <div className="text-2xl font-bold text-gray-900 mt-2">
          {formatCurrency(adjustedDepositsTotal.value, currency, locale)}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {activeDepositCount} {t('Active', language)}
        </div>
        <div className="text-xs text-gray-500 mt-1">{depositsInsight}</div>
      </SummaryCard>

      <SummaryCard className="lg:col-span-4">
        <div className="text-sm text-gray-500">{t('Commodities', language)}</div>
        {adjustedGoldTotal.value > 0 ? (
          <>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(adjustedGoldTotal.value, currency, locale)}
            </div>
            <div className="text-xs text-gray-500 mt-2">{t('Commodity allocation', language)}</div>
          </>
        ) : (
          <div className="text-sm text-gray-500 mt-3">{t('No commodity holdings', language)}</div>
        )}
      </SummaryCard>

      <SummaryCard className="lg:col-span-4">
        <div className="text-sm text-gray-500">{t('Debts', language)}</div>
        <div className="text-2xl font-bold text-rose-600 mt-2">
          {formatCurrency(adjustedLiabilitiesTotal.value, currency, locale)}
        </div>
        <div className="text-xs text-gray-500 mt-2">{debtInsight}</div>
      </SummaryCard>
    </div>
  );
};
