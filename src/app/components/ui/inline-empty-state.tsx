import { ReactNode } from 'react';
import { cn } from './utils';

type InlineEmptyStateProps = {
  children: ReactNode;
  className?: string;
};

export const InlineEmptyState = ({ children, className }: InlineEmptyStateProps) => (
  <div className={cn('rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600', className)}>
    {children}
  </div>
);
