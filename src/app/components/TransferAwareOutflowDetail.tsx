import React from 'react';
import { TransferAwareOutflowSummary } from '../utils/financeSummaries';
import { formatCurrency } from '../utils/formatting';
import { t } from '../utils/i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type TransferAwareOutflowDetailProps = {
  summary: TransferAwareOutflowSummary;
  currency: string;
  locale: string;
  language: 'en' | 'tr';
  size?: 'sm' | 'xs';
  className?: string;
  forceTooltipOpen?: boolean;
};

const sizeClass = (size: TransferAwareOutflowDetailProps['size']) =>
  size === 'xs' ? 'text-xs' : 'text-[11px]';

export function TransferAwareOutflowDetail({
  summary,
  currency,
  locale,
  language,
  size = 'sm',
  className,
  forceTooltipOpen,
}: TransferAwareOutflowDetailProps) {
  if (!summary.showTransferAwareDetail) return null;

  const tooltipProps =
    forceTooltipOpen === undefined
      ? {}
      : {
          open: forceTooltipOpen,
        };

  return (
    <div className={`mt-2 flex items-center gap-1 text-gray-500 ${sizeClass(size)} ${className ?? ''}`.trim()}>
      <span>
        {t('Cash outflow (ex-transfers)', language)}: {formatCurrency(summary.outflowExTransfers, currency, locale)}
      </span>
      <Tooltip {...tooltipProps}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="rounded-full border border-gray-200 px-1 text-[10px] font-semibold text-gray-500"
            aria-label={t('Transfer-aware outflow detail', language)}
            data-tooltip-copy={t('Excludes derived transfer events and explicit credit-card payment outflows.', language)}
            data-excluded-count={summary.excludedTransferCount > 0 ? summary.excludedTransferCount : undefined}
          >
            i
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <div className="space-y-1">
            <div>{t('Excludes derived transfer events and explicit credit-card payment outflows.', language)}</div>
            {summary.excludedTransferCount > 0 && (
              <div>
                {t('Excluded transfers this month', language)}: {summary.excludedTransferCount}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
