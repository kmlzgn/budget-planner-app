import { ReactNode } from 'react';
import { cn } from './utils';

type InlineWarningCalloutProps = {
  children: ReactNode;
  className?: string;
};

export const InlineWarningCallout = ({ children, className }: InlineWarningCalloutProps) => (
  <div className={cn('rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800', className)}>
    {children}
  </div>
);
