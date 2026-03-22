import { ReactNode } from 'react';
import { cn } from './utils';

type SectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export const SectionHeader = ({ title, subtitle, actions, className }: SectionHeaderProps) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
    <div>
      <div className="text-lg font-semibold text-gray-900">{title}</div>
      {subtitle ? <div className="text-sm text-gray-600">{subtitle}</div> : null}
    </div>
    {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
  </div>
);
