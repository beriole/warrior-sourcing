import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

/** Cartes compactes, bordure fine, ombre légère (§44). */
function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-lg border border-border bg-surface p-4 shadow-card', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('mb-3 flex items-start gap-3', className)} {...props} />;
}

function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 data-slot="card-title" className={cn('text-base font-semibold leading-tight', className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('mt-4 flex items-center gap-2', className)} {...props} />;
}

export { Card, CardDescription, CardFooter, CardHeader, CardTitle };
