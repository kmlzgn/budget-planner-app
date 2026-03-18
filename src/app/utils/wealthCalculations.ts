import { Deposit, DepositStatus } from '../types';
import { addDays, differenceInCalendarDays, format, parse } from 'date-fns';

export const toLocalDate = (value: string): Date => {
  const text = value.trim();
  const parts = text.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const parsed = parse(text, 'dd.MM.yyyy', new Date());
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = parse(text, 'MM/dd/yyyy', new Date());
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date(text);
};

export const toDateOnlyString = (value: Date): string => format(value, 'yyyy-MM-dd');

const addDaysToDateString = (startDate: string, days: number): string => {
  const start = toLocalDate(startDate);
  return toDateOnlyString(addDays(start, days));
};

export const getDaysUntil = (date: string, today: Date = new Date()): number => {
  if (!date) return 0;
  return differenceInCalendarDays(toLocalDate(date), today);
};

export const getDepositStatus = (
  deposit: Deposit,
  today: Date = new Date(),
  dueSoonDays = 7
): DepositStatus => {
  if (!deposit.maturityDate) return 'active';
  const daysRemaining = getDaysUntil(deposit.maturityDate, today);
  if (daysRemaining < 0) return 'matured';
  if (daysRemaining <= dueSoonDays) return 'due-soon';
  return 'active';
};

export const getDepositExpectedValue = (deposit: Deposit): number => {
  if (Number.isFinite(deposit.maturityValue)) return deposit.maturityValue;
  if (!deposit.principal || !deposit.grossRate || !deposit.termDays) return deposit.principal || 0;
  const rate = deposit.grossRate / 100;
  const grossInterest = deposit.principal * rate * (deposit.termDays / 365);
  const withholding = grossInterest * ((deposit.withholdingTaxRate || 0) / 100);
  return deposit.principal + (grossInterest - withholding);
};

export const deriveDepositFields = (
  deposit: Partial<Deposit>,
  today: Date = new Date(),
  dueSoonDays = 7
): Deposit => {
  const principal = Number.isFinite(deposit.principal) ? (deposit.principal as number) : 0;
  let termDays = Number.isFinite(deposit.termDays) ? (deposit.termDays as number) : 0;
  const grossRate = Number.isFinite(deposit.grossRate) ? (deposit.grossRate as number) : 0;
  const withholdingTaxRate = Number.isFinite(deposit.withholdingTaxRate)
    ? (deposit.withholdingTaxRate as number)
    : 0;
  const startDate = deposit.startDate ? deposit.startDate : '';
  let maturityDate = deposit.maturityDate ? deposit.maturityDate : '';
  if (!maturityDate && startDate && termDays > 0) {
    maturityDate = addDaysToDateString(startDate, termDays);
  }
  if (termDays <= 0 && startDate && maturityDate) {
    termDays = getDaysUntil(maturityDate, toLocalDate(startDate));
  }
  const grossInterest = principal && grossRate && termDays
    ? principal * (grossRate / 100) * (termDays / 365)
    : 0;
  const withholdingTaxAmount = grossInterest * (withholdingTaxRate / 100);
  const netInterest = grossInterest - withholdingTaxAmount;
  const maturityValue = principal + netInterest;
  const daysRemaining = maturityDate ? getDaysUntil(maturityDate, today) : 0;
  const status = maturityDate
    ? (daysRemaining < 0 ? 'matured' : daysRemaining <= dueSoonDays ? 'due-soon' : 'active')
    : 'active';

  return {
    id: deposit.id || '',
    owner: deposit.owner ?? '',
    institution: deposit.institution ?? '',
    principal,
    termDays,
    grossRate,
    withholdingTaxRate,
    startDate,
    maturityDate,
    grossInterest,
    withholdingTaxAmount,
    netInterest,
    maturityValue,
    daysRemaining,
    status,
    source: deposit.source ?? 'manual',
  };
};
