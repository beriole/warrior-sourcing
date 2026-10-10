import { z } from 'zod';

/**
 * Assistant contextuel (§30, AI-01).
 *
 * Le modèle ne décide de rien et ne lit rien tout seul : le serveur lui transmet des faits
 * relevés en base, et il rédige. C'est la seule façon de pouvoir exiger qu'il ne cite aucun
 * chiffre inventé — il n'a accès à aucun autre.
 *
 * Les montants qui engagent — coût rendu, fret, droits — ne viennent jamais de lui. Ils
 * viennent du calculateur et des grilles saisies en back-office, et l'assistant y renvoie.
 */

/** Un tour de l'échange. L'historique est renvoyé par l'écran : le serveur ne le garde pas. */
export const AssistantTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4_000),
});
export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;

export const AssistantRequestSchema = z.object({
  question: z
    .string({ error: 'Posez votre question.' })
    .trim()
    .min(3, 'Posez votre question.')
    .max(1_000, 'Question trop longue : allez à l’essentiel.'),
  /**
   * Les quelques tours précédents, pour que l'assistant suive le fil. Plafonné à huit :
   * au-delà, le coût grimpe et la réponse ne s'améliore pas.
   */
  historique: z.array(AssistantTurnSchema).max(8).default([]),
  /** Page d'où la question est posée. Sert à orienter la réponse, jamais à ouvrir un droit. */
  page: z.string().trim().max(120).nullable().default(null),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

export const AssistantResponseSchema = z.object({
  reponse: z.string(),
  /** Modèle réellement employé : affiché, pour que personne ne croie parler à un humain. */
  modele: z.string(),
  /**
   * Écrans vers lesquels l'assistant oriente. Construits par le **serveur** à partir de
   * routes qui existent : un modèle qui invente un lien envoie l'utilisateur sur un 404.
   */
  liens: z.array(z.object({ libelle: z.string(), href: z.string() })),
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

export const AssistantStatusResponseSchema = z.object({
  /** Faux quand aucune clé n'est configurée : l'écran ne propose alors pas l'assistant. */
  disponible: z.boolean(),
  modele: z.string().nullable(),
});
export type AssistantStatusResponse = z.infer<typeof AssistantStatusResponseSchema>;
