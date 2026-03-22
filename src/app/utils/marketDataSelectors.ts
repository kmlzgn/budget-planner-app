import { CommodityPrice, FxRate, FundHoldingMeta } from '../types';
import { OUNCE_TO_GRAM } from './marketData';
import { formatLocalizedNumber } from './formatting';

export type MarketDataStatus = 'ok' | 'missing' | 'stale' | 'manual' | 'derived' | 'dependency';
export type MarketDataTone = 'good' | 'warn' | 'bad' | 'neutral';

const normalizePair = (pair: string) => pair.replace(/\s+/g, '').toUpperCase();
export const normalizeFxPair = normalizePair;

export const parseFxPair = (pair: string) => {
  const normalized = normalizePair(pair);
  const [base, quote] = normalized.split('/');
  if (!base || !quote) return null;
  return { base, quote, pair: `${base}/${quote}` };
};

export const resolveFxRate = (pair: string, fxRates: FxRate[]) => {
  const parsed = parseFxPair(pair);
  if (!parsed) return null;
  const direct = fxRates.find(rate => normalizePair(rate.pair) === parsed.pair);
  if (direct && Number.isFinite(direct.rate) && direct.rate > 0) {
    return { rate: direct.rate, pairUsed: parsed.pair, isInverse: false };
  }
  const inversePair = `${parsed.quote}/${parsed.base}`;
  const inverse = fxRates.find(rate => normalizePair(rate.pair) === inversePair);
  if (inverse && Number.isFinite(inverse.rate) && inverse.rate > 0) {
    return { rate: 1 / inverse.rate, pairUsed: inversePair, isInverse: true };
  }
  return null;
};

const isStale = (updatedAt: string | undefined, now: Date, staleDays: number) => {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return false;
  const diffMs = now.getTime() - updated.getTime();
  return diffMs > staleDays * 24 * 60 * 60 * 1000;
};

export const formatRelativeUpdateTime = (updatedAt: string | undefined, now: Date, locale: string) => {
  const isTurkish = locale.startsWith('tr');
  const neverLabel = isTurkish ? 'Hiç güncellenmedi' : 'Never updated';
  const updatedLabel = isTurkish ? 'Güncellendi' : 'Updated';
  if (!updatedAt) return neverLabel;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return neverLabel;
  const diffMs = now.getTime() - updated.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return isTurkish ? 'Az önce güncellendi' : 'Updated just now';
  if (diffMinutes < 60) return isTurkish ? `${diffMinutes} dk önce güncellendi` : `Updated ${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return isTurkish ? `${diffHours} sa önce güncellendi` : `Updated ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return isTurkish ? `${diffDays} gün önce güncellendi` : `Updated ${diffDays}d ago`;
  return `${updatedLabel} ${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(updated)}`;
};

const statusToneMap: Record<MarketDataStatus, MarketDataTone> = {
  ok: 'good',
  missing: 'bad',
  stale: 'warn',
  manual: 'neutral',
  derived: 'neutral',
  dependency: 'warn',
};

export const getFxStatus = (rate: FxRate, now: Date, staleDays: number) => {
  if (!Number.isFinite(rate.rate) || rate.rate <= 0) {
    return { status: 'missing' as const, tone: statusToneMap.missing };
  }
  if (rate.mode === 'auto' && !rate.updatedAt) {
    return { status: 'missing' as const, tone: statusToneMap.missing };
  }
  if (isStale(rate.updatedAt, now, staleDays)) {
    return { status: 'stale' as const, tone: statusToneMap.stale };
  }
  if (rate.mode === 'manual') {
    return { status: 'manual' as const, tone: statusToneMap.manual };
  }
  return { status: 'ok' as const, tone: statusToneMap.ok };
};

export const getFundStatus = (meta: FundHoldingMeta, now: Date, staleDays: number) => {
  if (!Number.isFinite(meta.currentPrice) || meta.currentPrice <= 0) {
    return { status: 'missing' as const, tone: statusToneMap.missing };
  }
  if (meta.priceMode === 'auto' && !meta.lastUpdated) {
    return { status: 'missing' as const, tone: statusToneMap.missing };
  }
  if (isStale(meta.lastUpdated, now, staleDays)) {
    return { status: 'stale' as const, tone: statusToneMap.stale };
  }
  if (meta.priceMode === 'manual') {
    return { status: 'manual' as const, tone: statusToneMap.manual };
  }
  return { status: 'ok' as const, tone: statusToneMap.ok };
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const isPreciousCommodity = (name: string) => {
  const normalized = normalizeName(name);
  return normalized.includes('gold') || normalized.includes('altin') || normalized.includes('silver') || normalized.includes('gumus');
};

export type CommodityDisplayState = {
  displayPrice: number | null;
  displayUnit: string;
  sourceUnit: string;
  status: MarketDataStatus;
  tone: MarketDataTone;
  dependencyPair?: string;
  dependencyPairUsed?: string;
  dependencyIsInverse?: boolean;
};

export const getCommodityDisplayState = (
  item: CommodityPrice,
  baseCurrency: string,
  fxRates: FxRate[],
  now: Date,
  staleDays: number
): CommodityDisplayState => {
  const precious = isPreciousCommodity(item.commodity);
  const baseUnit = precious ? `${baseCurrency}/gram` : `${baseCurrency}/unit`;

  if (!Number.isFinite(item.price) || item.price <= 0) {
    return {
      displayPrice: null,
      displayUnit: baseUnit,
      sourceUnit: precious ? 'USD/oz' : baseUnit,
      status: 'missing',
      tone: statusToneMap.missing,
    };
  }

  if (item.mode === 'auto' && precious) {
    const usdPerGram = item.price / OUNCE_TO_GRAM;
    if (baseCurrency === 'USD') {
      return {
        displayPrice: usdPerGram,
        displayUnit: 'USD/gram',
        sourceUnit: 'USD/oz',
        status: isStale(item.updatedAt, now, staleDays) ? 'stale' : 'ok',
        tone: isStale(item.updatedAt, now, staleDays) ? statusToneMap.stale : statusToneMap.ok,
      };
    }

    const dependencyPair = `USD/${baseCurrency}`;
    const fx = resolveFxRate(dependencyPair, fxRates);
    if (!fx) {
      return {
        displayPrice: null,
        displayUnit: baseUnit,
        sourceUnit: 'USD/oz',
        status: 'dependency',
        tone: statusToneMap.dependency,
        dependencyPair,
      };
    }

    return {
      displayPrice: usdPerGram * fx.rate,
      displayUnit: baseUnit,
      sourceUnit: 'USD/oz',
      status: isStale(item.updatedAt, now, staleDays) ? 'stale' : 'derived',
      tone: isStale(item.updatedAt, now, staleDays) ? statusToneMap.stale : statusToneMap.derived,
      dependencyPair,
      dependencyPairUsed: fx.pairUsed,
      dependencyIsInverse: fx.isInverse,
    };
  }

  const status = isStale(item.updatedAt, now, staleDays)
    ? 'stale'
    : item.mode === 'manual'
      ? 'manual'
      : 'ok';

  return {
    displayPrice: item.price,
    displayUnit: baseUnit,
    sourceUnit: baseUnit,
    status,
    tone: statusToneMap[status],
  };
};

export const formatFxMeaning = (pair: string, rate: number, locale: string) => {
  const parsed = parseFxPair(pair);
  if (!parsed || !Number.isFinite(rate) || rate <= 0) return '-';
  const formatted = formatLocalizedNumber(rate, locale, { maximumFractionDigits: 4, minimumFractionDigits: 2 });
  return `1 ${parsed.base} = ${formatted} ${parsed.quote}`;
};

export const getMarketDataHealth = (
  fxRates: FxRate[],
  fundMeta: FundHoldingMeta[],
  commodities: CommodityPrice[],
  baseCurrency: string,
  now: Date,
  staleDays: number
) => {
  const fxStatuses = fxRates.map(rate => getFxStatus(rate, now, staleDays));
  const fundStatuses = fundMeta.map(meta => getFundStatus(meta, now, staleDays));
  const commodityStatuses = commodities.map(item => getCommodityDisplayState(item, baseCurrency, fxRates, now, staleDays));

  const fxMissing = fxStatuses.filter(s => s.status === 'missing').length;
  const fxStale = fxStatuses.filter(s => s.status === 'stale').length;
  const fundMissing = fundStatuses.filter(s => s.status === 'missing').length;
  const fundStale = fundStatuses.filter(s => s.status === 'stale').length;
  const commodityMissing = commodityStatuses.filter(s => s.status === 'missing').length;
  const commodityDependency = commodityStatuses.filter(s => s.status === 'dependency').length;

  const latestAutoUpdate = [
    ...fxRates.filter(r => r.mode === 'auto').map(r => r.updatedAt),
    ...fundMeta.filter(m => m.priceMode === 'auto').map(m => m.lastUpdated),
    ...commodities.filter(c => c.mode === 'auto').map(c => c.updatedAt),
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();

  return {
    fxMissing,
    fxStale,
    fundMissing,
    fundStale,
    commodityMissing,
    commodityDependency,
    latestAutoUpdate,
  };
};
