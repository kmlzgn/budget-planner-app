import { ReactNode } from 'react';
import { cn } from './utils';

type AppCardProps = {
  children: ReactNode;
  className?: string;
};

export const AppCard = ({ children, className }: AppCardProps) => (
  <div className={cn('rounded-lg border border-gray-200 bg-white p-6 shadow-sm', className)}>
    {children}
  </div>
);
