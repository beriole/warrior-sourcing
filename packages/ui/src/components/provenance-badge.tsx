import { DATA_PROVENANCE_LABELS, type DataProvenance } from '@ws/contracts';
import { BadgeCheck, Calculator, Sparkles } from 'lucide-react';
import { Badge } from './badge';

const ICONS = {
  VERIFIED: BadgeCheck,
  ESTIMATE: Calculator,
  AI_SUGGESTION: Sparkles,
} satisfies Record<DataProvenance, unknown>;

const TONES = {
  VERIFIED: 'verified',
  ESTIMATE: 'estimate',
  AI_SUGGESTION: 'ai',
} as const satisfies Record<DataProvenance, string>;

/** Indique d'où vient une donnée : vérifiée, estimée ou suggérée par l'IA (§2, §30). */
function ProvenanceBadge({ provenance, className }: { provenance: DataProvenance; className?: string }) {
  const Icon = ICONS[provenance];
  const { label, description } = DATA_PROVENANCE_LABELS[provenance];

  return (
    <Badge tone={TONES[provenance]} title={description} className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

export { ProvenanceBadge };
