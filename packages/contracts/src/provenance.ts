import { z } from 'zod';

/**
 * Cahier §2 et §30 : toute donnée affichée doit dire d'où elle vient.
 * L'interface ne doit jamais confondre ces trois natures.
 */
export const DATA_PROVENANCES = ['VERIFIED', 'ESTIMATE', 'AI_SUGGESTION'] as const;
export const DataProvenanceSchema = z.enum(DATA_PROVENANCES);
export type DataProvenance = z.infer<typeof DataProvenanceSchema>;

export const DATA_PROVENANCE_LABELS: Record<DataProvenance, { label: string; description: string }> =
  {
    VERIFIED: {
      label: 'Donnée vérifiée',
      description: 'Contrôlée par notre équipe, avec date et source.',
    },
    ESTIMATE: {
      label: 'Estimation',
      description: 'Calculée à partir d’hypothèses. Ce n’est pas une garantie.',
    },
    AI_SUGGESTION: {
      label: 'Suggestion IA',
      description: 'Générée automatiquement. À confirmer avant de décider.',
    },
  };
