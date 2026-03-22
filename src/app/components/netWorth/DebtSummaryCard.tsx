import { formatCurrency } from '../../utils/formatting';
import { t } from '../../utils/i18n';
import { DebtSummary, TransferAwareOutflowSummary } from '../../utils/financeSummaries';
import { TransferAwareOutflowDetail } from '../TransferAwareOutflowDetail';
import { SummaryCard } from './SummaryCard';

type DebtSummaryCardProps = {
  language: 'en' | 'tr';
  locale: string;
  currency: string;
  debtSummary: DebtSummary;
  transferAwareOutflow: TransferAwareOutflowSummary;
};

export const DebtSummaryCard = ({
  language,
  locale,
  currency,
  debtSummary,
  transferAwareOutflow,
}: DebtSummaryCardProps) => (
  <SummaryCard>
    <div className="text-sm text-gray-500 mb-2">{t('Debt Summary', language)}</div>
    {debtSummary.totalDebt > 0 ? (
      <>
        <div className="text-2xl font-bold text-rose-600">
          {formatCurrency(debtSummary.totalDebt, currency, locale)}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {debtSummary.minimumPayments > 0
            ? `${t('Monthly Obligation', language)}: ${formatCurrency(debtSummary.minimumPayments, currency, locale)}`
            : t('Minimum payments missing for some debts.', language)}
        </div>
        <TransferAwareOutflowDetail
          summary={transferAwareOutflow}
          currency={currency}
          locale={locale}
          language={language}
          size="xs"
        />
        <div className="text-xs text-gray-500 mt-1">
          {debtSummary.debtCount} {t('Debts', language)}
        </div>
      </>
    ) : (
      <div className="text-sm text-gray-500">{t('No debts recorded', language)}</div>
    )}
  </SummaryCard>
);
