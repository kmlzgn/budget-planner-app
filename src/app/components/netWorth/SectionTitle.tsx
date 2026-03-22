import { ReactNode } from 'react';

type SectionTitleProps = {
  children: ReactNode;
  className?: string;
};

export const SectionTitle = ({ children, className }: SectionTitleProps) => (
  <h2 className={`text-lg font-semibold text-gray-900${className ? ` ${className}` : ''}`}>
    {children}
  </h2>
);
