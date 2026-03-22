import { formatCurrency } from '../../utils/formatting';
import { t } from '../../utils/i18n';
import { SummaryCard } from './SummaryCard';

type DepositsSummaryCardProps = {
  language: 'en' | 'tr';
  locale: string;
  currency: string;
  activePrincipalTotal: number;
  activeNetInterestTotal: number;
  nextMaturity: string;
  activeDepositCount: number;
  maturingIn7: number;
};

export const DepositsSummaryCard = ({
  language,
  locale,
  currency,
  activePrincipalTotal,
  activeNetInterestTotal,
  nextMaturity,
  activeDepositCount,
  maturingIn7,
}: DepositsSummaryCardProps) => (
  <SummaryCard>
    <div className="text-sm text-gray-500 mb-2">{t('Deposits Summary', language)}</div>
    <div className="text-2xl font-bold text-gray-900">
      {formatCurrency(activePrincipalTotal, currency, locale)}
    </div>
    <div className="mt-2 text-xs text-gray-500">
      {t('Active', language)}: {activeDepositCount}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600">
      <div>
        <div className="text-gray-400">{t('Net Interest', language)}</div>
        <div className="font-semibold text-gray-900">
          {formatCurrency(activeNetInterestTotal, currency, locale)}
        </div>
      </div>
      <div>
        <div className="text-gray-400">{t('Next Maturity', language)}</div>
        <div className="font-semibold text-gray-900">{nextMaturity || '-'}</div>
      </div>
    </div>
    <div className="mt-2 text-xs text-gray-500">
      {maturingIn7 > 0 ? t('Maturity approaching', language) : t('No upcoming maturities', language)}
    </div>
  </SummaryCard>
);
