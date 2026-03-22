import { ReactNode } from 'react';
import { Button } from './button';
import { cn } from './utils';

type AppButtonProps = React.ComponentProps<typeof Button> & {
  children: ReactNode;
};

export const PrimaryButton = ({ className, ...props }: AppButtonProps) => (
  <Button
    {...props}
    variant="default"
    className={cn('bg-slate-900 text-white hover:bg-slate-800', className)}
  />
);

export const SecondaryButton = ({ className, ...props }: AppButtonProps) => (
  <Button
    {...props}
    variant="outline"
    className={cn('border-gray-300 text-gray-800 hover:bg-gray-50', className)}
  />
);

export const DangerButton = ({ className, ...props }: AppButtonProps) => (
  <Button
    {...props}
    variant="destructive"
    className={cn('bg-red-600 text-white hover:bg-red-500', className)}
  />
);
