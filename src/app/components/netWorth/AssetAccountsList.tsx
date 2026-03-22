import { Edit2, Trash2 } from 'lucide-react';
import { Account, AccountType } from '../../types';
import { formatCurrency, formatCurrencyWithSign } from '../../utils/formatting';
import { t } from '../../utils/i18n';
import { AppCard } from '../ui/app-card';
import { EmptyState } from './EmptyState';
import { SectionTitle } from './SectionTitle';

type AccountTypeOption = { value: AccountType; label: string; isAsset: boolean };

type AssetAccountsListProps = {
  language: 'en' | 'tr';
  locale: string;
  currency: string;
  assetAccounts: Account[];
  accountTypes: AccountTypeOption[];
  getAccountLabel: (accountId?: string) => string;
  formatLocalAmount: (value: number, currency: string) => string;
  getAccountLocalValue: (account: Account) => number;
  getAccountValue: (account: Account) => number;
  getAccountBaselineValue: (account: Account) => number;
  resolveAccountFxRate: (account: Account) => number;
  onEdit: (account: Account) => void;
  onDelete: (accountId: string) => void;
};

export const AssetAccountsList = ({
  language,
  locale,
  currency,
  assetAccounts,
  accountTypes,
  getAccountLabel,
  formatLocalAmount,
  getAccountLocalValue,
  getAccountValue,
  getAccountBaselineValue,
  resolveAccountFxRate,
  onEdit,
  onDelete,
}: AssetAccountsListProps) => (
  <AppCard>
    <div className="flex items-center justify-between mb-4">
      <SectionTitle>{t('Asset Accounts', language)}</SectionTitle>
    </div>
    <div className="space-y-3">
      {assetAccounts.length === 0 ? (
        <EmptyState>{t('No accounts yet. Add one to start tracking.', language)}</EmptyState>
      ) : (
        assetAccounts.map(account => {
          const localBalance = getAccountLocalValue(account);
          const derivedBalance = getAccountValue(account);
          const baselineValue = getAccountBaselineValue(account);
          const change = derivedBalance - baselineValue;
          const changePct = baselineValue > 0 ? (change / baselineValue) * 100 : 0;
          const typeLabel = t(accountTypes.find(item => item.value === account.type)?.label ?? '', language);
          const isNegative = derivedBalance < 0;

          return (
            <div key={account.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900" title={getAccountLabel(account.id)}>
                    {getAccountLabel(account.id)}
                  </div>
                  <div className="text-xs text-gray-500">{typeLabel}</div>
                  {account.institution && (
                    <div className="text-xs text-gray-500">{account.institution}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onEdit(account)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(account.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-start justify-between">
                <div>
                  <div className={`text-2xl font-bold tabular-nums ${isNegative ? 'text-rose-600' : 'text-gray-900'}`}>
                    {formatCurrencyWithSign(derivedBalance, currency, locale)}
                  </div>
                  {isNegative && (
                    <div className="text-xs text-rose-600 mt-1">{t('Negative balance', language)}</div>
                  )}
                </div>
                <div className={`text-xs ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrencyWithSign(change, currency, locale)}
                  {baselineValue > 0 && (
                    <span className="text-[11px] text-gray-500 ml-1">({changePct.toFixed(1)}%)</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                {account.owner && (
                  <span>{t('Owner', language)}: {account.owner}</span>
                )}
                {account.currency && (
                  <span>{t('Account Currency', language)}: {account.currency}</span>
                )}
                {account.type === 'commodities' && (
                  <span>{t('Commodity', language)}: {account.commodityName || account.name}</span>
                )}
                {account.type === 'pension' && (
                  <span>{t('Government Contribution', language)}: {formatCurrency(account.governmentContribution ?? 0, currency, locale)}</span>
                )}
              </div>

              {account.isForeignCurrency && account.currency && (
                <div className="mt-2 text-xs text-gray-500">
                  {formatLocalAmount(localBalance, account.currency)} · {t('FX Rate to Base', language)}: {resolveAccountFxRate(account)} · {formatCurrencyWithSign(derivedBalance, currency, locale)}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  </AppCard>
);
