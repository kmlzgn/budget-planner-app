import { useLocalizedNumberInput } from './useLocalizedNumberInput';

type RateFieldProps = {
  value: number | undefined;
  onValueChange: (value: number) => void;
  locale: string;
  className?: string;
  placeholder?: string;
  allowNegative?: boolean;
  allowEmpty?: boolean;
  disabled?: boolean;
  onEmptyValueChange?: () => void;
};

export const RateField = ({
  value,
  onValueChange,
  locale,
  className,
  placeholder,
  allowNegative = false,
  allowEmpty = false,
  disabled = false,
  onEmptyValueChange,
}: RateFieldProps) => {
  const { inputValue, handleBlur, handleChange, handleFocus } = useLocalizedNumberInput({
    locale,
    value,
    onValueChange,
    maxFractionDigits: 2,
    minFractionDigits: 2,
    typingMaxFractionDigits: 6,
    allowNegative,
    allowEmpty,
    onEmptyValueChange,
  });

  return (
    <input
      type="text"
      inputMode="decimal"
      value={inputValue}
      onChange={(event) => handleChange(event.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};
