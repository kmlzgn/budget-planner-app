import { ReactNode } from 'react';
import { AppCard } from '../ui/app-card';

type SummaryCardProps = {
  children: ReactNode;
  className?: string;
};

export const SummaryCard = ({ children, className }: SummaryCardProps) => (
  <AppCard className={className}>{children}</AppCard>
);
