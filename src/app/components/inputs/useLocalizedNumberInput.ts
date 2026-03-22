import { useEffect, useMemo, useState } from 'react';
import { formatLocalizedNumber, formatLocalizedNumberInput, parseLocalizedNumber } from '../../utils/formatting';

type LocalizedNumberInputOptions = {
  locale: string;
  value: number | undefined;
  onValueChange: (value: number) => void;
  maxFractionDigits?: number;
  minFractionDigits?: number;
  typingMaxFractionDigits?: number;
  allowNegative?: boolean;
  allowEmpty?: boolean;
  onEmptyValueChange?: () => void;
};

const roundTo = (value: number, fractionDigits: number) => {
  const factor = Math.pow(10, fractionDigits);
  return Math.round(value * factor) / factor;
};

export const useLocalizedNumberInput = ({
  locale,
  value,
  onValueChange,
  maxFractionDigits = 2,
  minFractionDigits = 0,
  allowNegative = false,
  allowEmpty = false,
  typingMaxFractionDigits,
  onEmptyValueChange,
}: LocalizedNumberInputOptions) => {
  const formattedValue = useMemo(
    () => formatLocalizedNumber(value, locale, { minimumFractionDigits: minFractionDigits, maximumFractionDigits: maxFractionDigits }),
    [value, locale, minFractionDigits, maxFractionDigits]
  );
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(formattedValue);

  useEffect(() => {
    if (isFocused) return;
    setInputValue(formattedValue);
  }, [formattedValue, isFocused]);

  const handleChange = (next: string) => {
    setInputValue(formatLocalizedNumberInput(next, locale, typingMaxFractionDigits ?? maxFractionDigits));
    if (allowEmpty && next.trim() === '') {
      onEmptyValueChange?.();
      return;
    }
    const parsed = parseLocalizedNumber(next, locale, allowNegative);
    onValueChange(parsed);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (allowEmpty && inputValue.trim() === '') {
      setInputValue('');
      return;
    }
    const parsed = parseLocalizedNumber(inputValue, locale, allowNegative);
    const normalized = roundTo(parsed, maxFractionDigits);
    onValueChange(normalized);
    setInputValue(
      formatLocalizedNumber(normalized, locale, {
        minimumFractionDigits: minFractionDigits,
        maximumFractionDigits: maxFractionDigits,
      })
    );
  };

  return {
    inputValue,
    handleChange,
    handleFocus,
    handleBlur,
    setInputValue,
  };
};
