import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

/** Badges normalisés (§44). Toujours un libellé lisible, jamais une couleur seule. */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-foreground',
        brand: 'bg-imperial-soft text-imperial-hover',
        gold: 'bg-gold-soft text-gold-ink',
        night: 'bg-night-soft text-night',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        verified: 'bg-verified-soft text-verified',
        estimate: 'bg-estimate-soft text-estimate',
        ai: 'bg-ai-soft text-ai',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

function Badge({ className, tone, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants, type BadgeProps };
