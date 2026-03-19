type SmartDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function SmartDateInput({ value, onChange, className }: SmartDateInputProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}
