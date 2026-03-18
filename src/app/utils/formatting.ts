type FormatCurrencyOptions = {
  hideDecimalsThreshold?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
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
