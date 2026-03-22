type FormatCurrencyOptions = {
  hideDecimalsThreshold?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

type FormatNumberOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export const getLocaleSeparators = (locale: string) => {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  const group = parts.find(part => part.type === 'group')?.value ?? ',';
  const decimal = parts.find(part => part.type === 'decimal')?.value ?? '.';
  return { group, decimal };
};

export const formatLocalizedNumber = (
  value: number | undefined,
  locale: string,
  options: FormatNumberOptions = {}
) => {
  if (value === undefined || Number.isNaN(value)) return '';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
  }).format(value);
};

export const parseLocalizedNumber = (raw: string, locale: string, allowNegative = true) => {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const { decimal, group } = getLocaleSeparators(locale);
  const cleaned = trimmed
    .replace(new RegExp(`\\${group}`, 'g'), '')
    .replace(/[^\d.,-]/g, '')
    .replace(/(?!^)-/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalIndex = Math.max(lastDot, lastComma);
  const sign = cleaned.startsWith('-') ? -1 : 1;
  const integerPart = (decimalIndex >= 0 ? cleaned.slice(0, decimalIndex) : cleaned).replace(/[^\d]/g, '');
  const fractionalPart = decimalIndex >= 0 ? cleaned.slice(decimalIndex + 1).replace(/[^\d]/g, '') : '';
  const normalized = integerPart + (fractionalPart ? `.${fractionalPart}` : '');
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  const value = sign * parsed;
  return allowNegative ? value : Math.abs(value);
};

export const formatLocalizedNumberInput = (
  raw: string,
  locale: string,
  maxFractionDigits = 6
) => {
  if (!raw) return '';
  const { decimal } = getLocaleSeparators(locale);
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/(?!^)-/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalIndex = Math.max(lastDot, lastComma);
  const sign = cleaned.startsWith('-') ? '-' : '';
  const integerPart = (decimalIndex >= 0 ? cleaned.slice(0, decimalIndex) : cleaned).replace(/[^\d]/g, '');
  const fractionalRaw = decimalIndex >= 0 ? cleaned.slice(decimalIndex + 1).replace(/[^\d]/g, '') : '';
  const fractionalPart = maxFractionDigits > 0 ? fractionalRaw.slice(0, maxFractionDigits) : fractionalRaw;
  const grouped = integerPart
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(integerPart))
    : '';
  if (decimalIndex >= 0) {
    return `${sign}${grouped}${decimal}${fractionalPart}`;
  }
  return `${sign}${grouped}`;
};

export const formatCurrency = (
  value: number,
  currency: string,
  locale?: string,
  options: FormatCurrencyOptions = {}
) => {
  const absValue = Math.abs(value);
  const hideThreshold = options.hideDecimalsThreshold ?? 1000;
  const useNoDecimals = absValue >= hideThreshold;
  const minFraction = useNoDecimals ? 0 : (options.minimumFractionDigits ?? 2);
  const maxFraction = useNoDecimals ? 0 : (options.maximumFractionDigits ?? 2);

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  });

  return `${currency} ${formatter.format(value)}`;
};

export const formatCurrencyWithSign = (
  value: number,
  currency: string,
  locale?: string,
  options: FormatCurrencyOptions = {}
) => {
  const absFormatted = formatCurrency(Math.abs(value), currency, locale, options);
  if (value < 0) {
    return `-${absFormatted.replace(`${currency} `, `${currency}`)}`;
  }
  return absFormatted;
};
