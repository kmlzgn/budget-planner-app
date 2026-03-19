import { useEffect, useMemo, useState } from 'react';

type NumberInputProps = {
  value: number | undefined;
  onValueChange: (value: number) => void;
  onEmptyValueChange?: () => void;
  valueText?: string;
  onValueTextChange?: (value: string) => void;
  parseValue?: (raw: string) => number;
  placeholder?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxFractionDigits?: number;
  minFractionDigits?: number;
  allowNegative?: boolean;
  allowEmpty?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

const parseNumericInput = (raw: string, allowNegative: boolean) => {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[^\d,.\-]/g, '')
    .replace(/(?!^)-/g, '');
  const normalized = cleaned.replace(/,/g, '.');
  const value = parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;
  if (!allowNegative && value < 0) return Math.abs(value);
  return value;
};

const formatNumber = (
  value: number | undefined,
  locale: string,
  maxFractionDigits: number,
  minFractionDigits: number
) => {
  if (value === undefined || Number.isNaN(value)) return '';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
};

const formatRawNumber = (value: number | undefined, maxFractionDigits: number) => {
  if (value === undefined || Number.isNaN(value)) return '';
  return Number(value).toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: maxFractionDigits,
  });
};

export function NumberInput({
  value,
  onValueChange,
  valueText,
  onValueTextChange,
  parseValue,
  placeholder,
  className,
  inputMode = 'decimal',
  maxFractionDigits = 2,
  minFractionDigits = 0,
  allowNegative = false,
  allowEmpty = false,
  disabled = false,
  onFocus,
  onBlur,
  onEmptyValueChange,
}: NumberInputProps) {
  const locale = useMemo(() => navigator.language || 'en-US', []);
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(() =>
    formatNumber(value, locale, maxFractionDigits, minFractionDigits)
  );
  const isTextControlled = valueText !== undefined;

  useEffect(() => {
    if (isFocused || isTextControlled) return;
    setDisplayValue(formatNumber(value, locale, maxFractionDigits, minFractionDigits));
  }, [value, locale, maxFractionDigits, minFractionDigits, isFocused, isTextControlled]);

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={isTextControlled ? valueText : displayValue}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => {
        if (!isTextControlled) setIsFocused(true);
        if (!isTextControlled) {
          setDisplayValue(formatRawNumber(value, maxFractionDigits));
        }
        onFocus?.();
      }}
      onBlur={() => {
        if (!isTextControlled) {
          setIsFocused(false);
          setDisplayValue(formatNumber(value, locale, maxFractionDigits, minFractionDigits));
        }
        onBlur?.();
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (isTextControlled) {
          onValueTextChange?.(next);
        } else {
          setDisplayValue(next);
        }
        if (allowEmpty && next.trim() === '') {
          onEmptyValueChange?.();
          return;
        }
        const parser = parseValue ?? ((raw: string) => parseNumericInput(raw, allowNegative));
        onValueChange(parser(next));
      }}
      className={className}
    />
  );
}

export function CurrencyInput(props: Omit<NumberInputProps, 'maxFractionDigits' | 'minFractionDigits'>) {
  return <NumberInput {...props} maxFractionDigits={2} minFractionDigits={2} />;
}

export function PercentInput(props: Omit<NumberInputProps, 'maxFractionDigits' | 'minFractionDigits'>) {
  return <NumberInput {...props} maxFractionDigits={2} minFractionDigits={0} />;
}

export function UnitsInput(props: Omit<NumberInputProps, 'maxFractionDigits' | 'minFractionDigits'>) {
  return <NumberInput {...props} maxFractionDigits={4} minFractionDigits={0} />;
}
