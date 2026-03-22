import { ReactNode } from 'react';
import { InlineEmptyState } from '../ui/inline-empty-state';

type EmptyStateProps = {
  children: ReactNode;
  className?: string;
};

export const EmptyState = ({ children, className }: EmptyStateProps) => (
  <InlineEmptyState className={className}>{children}</InlineEmptyState>
);
