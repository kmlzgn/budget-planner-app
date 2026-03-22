import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Account, AccountType } from '../../types';
import { UnitsInput } from '../inputs/NumberInput';
import { MoneyField } from '../inputs/MoneyField';
import { PrimaryButton, SecondaryButton } from '../ui/app-buttons';
import { formatCurrency } from '../../utils/formatting';
import { t } from '../../utils/i18n';

type AccountTypeOption = { value: AccountType; label: string; isAsset: boolean };

type AccountEditorModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingAccountId: string | null;
  accountFormData: Partial<Account>;
  setAccountFormData: (value: Partial<Account>) => void;
  accountTypes: AccountTypeOption[];
  ownerOptions: string[];
  pensionTotal: number;
  commodityPreviewValue: number;
  currency: string;
  locale: string;
  language: 'en' | 'tr';
  onSubmit: () => void;
  onReset: () => void;
  getCommodityMarketPrice: (account: Account) => number;
};

const commodityOptions = ['Gold', 'Silver'];

export const AccountEditorModal = ({
  isOpen,
  onOpenChange,
  editingAccountId,
  accountFormData,
  setAccountFormData,
  accountTypes,
  ownerOptions,
  pensionTotal,
  commodityPreviewValue,
  currency,
  locale,
  language,
  onSubmit,
  onReset,
  getCommodityMarketPrice,
}: AccountEditorModalProps) => {
  const isRetirementAccount = accountFormData.type === 'pension' || accountFormData.type === 'retirement';
  const commodityUnits = accountFormData.commodityUnits ?? 0;
  const commodityUnitPrice = commodityUnits > 0
    ? (accountFormData.currentBalance ?? 0) / commodityUnits
    : 0;

  return (
  <Dialog
    open={isOpen}
    onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) onReset();
    }}
  >
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{editingAccountId ? t('Edit Account', language) : t('Add Account', language)}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account Name', language)} *</label>
          <input
            type="text"
            value={accountFormData.name || ''}
            onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account Type', language)} *</label>
          <select
            value={accountFormData.type}
            onChange={(e) => {
              const type = e.target.value as AccountType;
              const typeMeta = accountTypes.find(item => item.value === type);
              const isCreditCard = type === 'credit-card';
              setAccountFormData({
                ...accountFormData,
                type,
                isAsset: typeMeta?.isAsset ?? accountFormData.isAsset,
                statementDay: isCreditCard ? (accountFormData.statementDay ?? 1) : undefined,
                dueDay: isCreditCard ? (accountFormData.dueDay ?? 15) : undefined,
                commodityName: type === 'commodities' ? (accountFormData.commodityName ?? 'Gold') : accountFormData.commodityName,
                commodityValuationMode: type === 'commodities' ? (accountFormData.commodityValuationMode ?? 'manual') : accountFormData.commodityValuationMode,
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {accountTypes.map(type => (
              <option key={type.value} value={type.value}>
                {t(type.label, language)}
              </option>
            ))}
          </select>
        </div>
        {accountFormData.type === 'credit-card' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Statement Day', language)} *</label>
              <UnitsInput
                value={accountFormData.statementDay}
                onValueChange={(value) => setAccountFormData({ ...accountFormData, statementDay: Math.max(0, Math.round(value)) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Due Day', language)} *</label>
              <UnitsInput
                value={accountFormData.dueDay}
                onValueChange={(value) => setAccountFormData({ ...accountFormData, dueDay: Math.max(0, Math.round(value)) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Opening Balance', language)}</label>
          <MoneyField
            value={accountFormData.openingBalance}
            onValueChange={(value) => setAccountFormData({ ...accountFormData, openingBalance: value })}
            locale={locale}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Current Balance', language)}</label>
          <MoneyField
            value={
              isRetirementAccount
                ? pensionTotal
                : (accountFormData.type === 'commodities' && accountFormData.commodityValuationMode === 'auto')
                  ? commodityPreviewValue
                  : accountFormData.currentBalance
            }
            onValueChange={(value) => setAccountFormData({ ...accountFormData, currentBalance: value })}
            locale={locale}
            disabled={isRetirementAccount || (accountFormData.type === 'commodities' && accountFormData.commodityValuationMode === 'auto')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        {isRetirementAccount && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fund Value', language)}</label>
              <MoneyField
                value={accountFormData.pensionFundValue}
                onValueChange={(value) => setAccountFormData({ ...accountFormData, pensionFundValue: value })}
                locale={locale}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Government Contribution', language)}</label>
              <MoneyField
                value={accountFormData.governmentContribution}
                onValueChange={(value) => setAccountFormData({ ...accountFormData, governmentContribution: value })}
                locale={locale}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </>
        )}
        {accountFormData.type === 'commodities' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Commodity', language)}</label>
              <select
                value={accountFormData.commodityName || 'Gold'}
                onChange={(e) => setAccountFormData({ ...accountFormData, commodityName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {commodityOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Units', language)}</label>
              <UnitsInput
                value={accountFormData.commodityUnits}
                onValueChange={(value) => setAccountFormData({ ...accountFormData, commodityUnits: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            {accountFormData.commodityValuationMode === 'manual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Unit Price', language)}</label>
                <MoneyField
                  value={commodityUnitPrice}
                  onValueChange={(value) => setAccountFormData({
                    ...accountFormData,
                    currentBalance: (accountFormData.commodityUnits ?? 0) * value,
                  })}
                  locale={locale}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Mode', language)}</label>
              <select
                value={accountFormData.commodityValuationMode ?? 'manual'}
                onChange={(e) => setAccountFormData({ ...accountFormData, commodityValuationMode: e.target.value as 'manual' | 'auto' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="manual">{t('Manual', language)}</option>
                <option value="auto">{t('Auto Fetch', language)}</option>
              </select>
            </div>
            <div className="md:col-span-2 text-xs text-gray-500">
              {t('Current Price', language)}: {formatCurrency(getCommodityMarketPrice({
                ...accountFormData,
                name: accountFormData.name || '',
                commodityName: accountFormData.commodityName ?? '',
                commodityUnits: accountFormData.commodityUnits ?? 0,
                commodityValuationMode: accountFormData.commodityValuationMode ?? 'manual',
              } as Account), currency, locale)}
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Account Currency', language)}</label>
          <input
            type="text"
            value={accountFormData.currency || currency}
            onChange={(e) => setAccountFormData({ ...accountFormData, currency: e.target.value })}
            placeholder="TRY"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex items-center gap-2 mt-6">
          <input
            id="account-foreign"
            type="checkbox"
            checked={accountFormData.isForeignCurrency ?? false}
            onChange={(e) => setAccountFormData({ ...accountFormData, isForeignCurrency: e.target.checked })}
            className="h-4 w-4"
          />
          <label htmlFor="account-foreign" className="text-sm text-gray-700">{t('Foreign Currency', language)}</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Exchange Rate', language)}</label>
          <UnitsInput
            value={accountFormData.exchangeRate}
            onValueChange={(value) => setAccountFormData({ ...accountFormData, exchangeRate: value || 1 })}
            disabled={!accountFormData.isForeignCurrency}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Institution', language)}</label>
          <input
            type="text"
            value={accountFormData.institution || ''}
            onChange={(e) => setAccountFormData({ ...accountFormData, institution: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Owner', language)}</label>
          {ownerOptions.length > 0 ? (
            <select
              value={accountFormData.owner || ''}
              onChange={(e) => setAccountFormData({ ...accountFormData, owner: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">{t('Not specified', language)}</option>
              {ownerOptions.map(owner => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={accountFormData.owner || ''}
              onChange={(e) => setAccountFormData({ ...accountFormData, owner: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          )}
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Notes', language)}</label>
          <textarea
            value={accountFormData.notes || ''}
            onChange={(e) => setAccountFormData({ ...accountFormData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <SecondaryButton
          onClick={() => {
            onOpenChange(false);
            onReset();
          }}
        >
          {t('Cancel', language)}
        </SecondaryButton>
        <PrimaryButton onClick={onSubmit}>
          {editingAccountId ? t('Update Account', language) : t('Add Account', language)}
        </PrimaryButton>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  );
};
