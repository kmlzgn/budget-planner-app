import { CommodityPrice, MarketDataMode } from '../types';

export const OUNCE_TO_GRAM = 31.1034768;

type CommodityNormalizeResult = {
  price: number;
  note?: 'fx-missing';
};

type NormalizeInput = {
  commodity: string;
  price: number;
  mode: MarketDataMode;
  baseCurrency: string;
  getFxRateForCurrency: (currency: string) => number | undefined;
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isPreciousCommodity = (name: string) => {
  const normalized = normalizeName(name);
  return normalized.includes('gold') || normalized.includes('altin') || normalized.includes('silver') || normalized.includes('gumus');
};

export const normalizeCommodityPrice = ({
  commodity,
  price,
  mode,
  baseCurrency,
  getFxRateForCurrency,
}: NormalizeInput): CommodityNormalizeResult => {
  if (!Number.isFinite(price)) return { price: 0 };
  if (mode !== 'auto' || !isPreciousCommodity(commodity)) {
    return { price };
  }

  const usdPerGram = price / OUNCE_TO_GRAM;
  if (baseCurrency === 'USD') {
    return { price: usdPerGram };
  }
  const fx = getFxRateForCurrency('USD');
  if (!Number.isFinite(fx) || (fx as number) <= 0) {
    return { price: usdPerGram, note: 'fx-missing' };
  }
  return { price: usdPerGram * (fx as number) };
};

export const normalizeCommodityPriceFromState = (
  item: CommodityPrice | undefined,
  baseCurrency: string,
  getFxRateForCurrency: (currency: string) => number | undefined
): CommodityNormalizeResult => {
  if (!item) return { price: 0 };
  return normalizeCommodityPrice({
    commodity: item.commodity,
    price: item.price,
    mode: item.mode,
    baseCurrency,
    getFxRateForCurrency,
  });
};
