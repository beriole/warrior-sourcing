import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

/** Skeleton plutôt que spinner permanent (§7, §45). */
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-muted)_25%,var(--border)_50%,var(--surface-muted)_75%)] bg-size-[200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
