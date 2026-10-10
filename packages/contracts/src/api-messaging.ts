import { z } from 'zod';

/**
 * Messagerie (lot MSG, §32).
 *
 * Une conversation par sujet, rangée dans une catégorie, éventuellement rattachée à une
 * commande. Deux interlocuteurs seulement : le client et l'équipe. Ce n'est pas un salon
 * de discussion — c'est un dossier écrit, qu'on doit pouvoir relire des mois plus tard.
 *
 * Règles de fond (§54) :
 * - rien n'est effacé : un message envoyé reste, même après clôture ;
 * - l'état d'une conversation est déduit de qui a écrit en dernier, pas déclaré à la
 *   main : « répondu » ne peut donc jamais être affiché sans réponse réelle ;
 * - les pièces jointes passent par le dépôt de fichiers du lot PLAT ; la messagerie ne
 *   stocke que leur description.
 */

// ───────────────────────── Catégories et états ─────────────────────────

/** Les quatre guichets du cahier des charges (§32). */
export const CONVERSATION_CATEGORIES = ['SUPPORT', 'SOURCING', 'LOGISTICS', 'TRAINING'] as const;
export const ConversationCategorySchema = z.enum(CONVERSATION_CATEGORIES);
export type ConversationCategory = z.infer<typeof ConversationCategorySchema>;

export const CONVERSATION_CATEGORY_LABELS: Record<
  ConversationCategory,
  { label: string; description: string }
> = {
  SUPPORT: {
    label: 'Support',
    description: 'Compte, paiement, facture, question sur la plateforme.',
  },
  SOURCING: {
    label: 'Sourcing',
    description: 'Recherche de produit ou de fournisseur, devis, négociation.',
  },
  LOGISTICS: {
    label: 'Logistique',
    description: 'Transport, consolidation, douane, livraison d’un colis.',
  },
  TRAINING: {
    label: 'Formation',
    description: 'Contenu de l’Academy, accès à une leçon, question pédagogique.',
  },
};

/**
 * État d'une conversation. Il est **déduit**, jamais saisi : « répondu » suit une réponse
 * réelle de l'équipe. Seule la clôture est une décision, et elle appartient à l'équipe.
 */
export const CONVERSATION_STATUSES = ['OPEN', 'ANSWERED', 'CLOSED'] as const;
export const ConversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, { label: string; description: string }> = {
  OPEN: { label: 'En attente de réponse', description: 'Votre message attend une réponse de l’équipe.' },
  ANSWERED: { label: 'Répondu', description: 'L’équipe a répondu. À vous de voir si cela suffit.' },
  CLOSED: { label: 'Close', description: 'Le sujet est clos. Un nouveau message la rouvre.' },
};

/** Qui a écrit un message. Le rôle précis de l'intervenant n'est pas exposé au client. */
export const MESSAGE_AUTHOR_KINDS = ['CLIENT', 'STAFF'] as const;
export const MessageAuthorKindSchema = z.enum(MESSAGE_AUTHOR_KINDS);
export type MessageAuthorKind = z.infer<typeof MessageAuthorKindSchema>;

// ───────────────────────── Requêtes ─────────────────────────

/**
 * Pièce jointe déjà déposée. La messagerie ne reçoit jamais le fichier lui-même : il est
 * envoyé au stockage par le lot PLAT, qui rend une URL, et seule cette description
 * circule ici.
 */
export const MessageAttachmentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** Extension telle qu'elle a été déposée (pdf, jpg, xlsx…). */
  fileFormat: z.string().trim().min(1).max(10),
  url: z.url().max(1_000),
  sizeBytes: z.number().int().positive().nullable().default(null),
});
export type MessageAttachmentInput = z.infer<typeof MessageAttachmentInputSchema>;

export const CreateConversationRequestSchema = z.object({
  category: ConversationCategorySchema,
  subject: z.string().trim().min(5).max(140),
  /**
   * Référence de la commande ou de la prestation concernée. Rattacher évite de répéter
   * la référence à chaque message, et permet de retrouver l'échange depuis le dossier.
   */
  orderReference: z.string().trim().max(40).nullable().default(null),
  /**
   * Le premier message. Vingt caractères au moins : c'est lui qui doit décrire le
   * problème, et « bonjour » n'ouvre pas un dossier. Les réponses, elles, peuvent être
   * courtes — « merci » est une réponse valable.
   */
  body: z.string().trim().min(20).max(5_000),
  attachments: z.array(MessageAttachmentInputSchema).max(5).default([]),
});
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;

export const PostMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
  attachments: z.array(MessageAttachmentInputSchema).max(5).default([]),
});
export type PostMessageRequest = z.infer<typeof PostMessageRequestSchema>;

export const ConversationQuerySchema = z.object({
  category: ConversationCategorySchema.optional(),
  statut: ConversationStatusSchema.optional(),
  /** Réservé à l'équipe : toutes les conversations, pas seulement les siennes. */
  toutes: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(25),
});
export type ConversationQuery = z.infer<typeof ConversationQuerySchema>;

// ───────────────────────── Réponses ─────────────────────────

export const MessageAttachmentSchema = MessageAttachmentInputSchema.extend({ id: z.string() });
export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  author: MessageAuthorKindSchema,
  /** Nom affiché de l'auteur. Pour l'équipe, le nom de l'intervenant, pas son rôle. */
  authorName: z.string(),
  body: z.string(),
  attachments: z.array(MessageAttachmentSchema),
  createdAt: z.iso.datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSummarySchema = z.object({
  id: z.string(),
  category: ConversationCategorySchema,
  categoryLabel: z.string(),
  subject: z.string(),
  status: ConversationStatusSchema,
  statusLabel: z.string(),
  orderReference: z.string().nullable(),
  /** Début du dernier message, pour reconnaître la conversation sans l'ouvrir. */
  lastMessagePreview: z.string(),
  lastMessageAt: z.iso.datetime(),
  messageCount: z.number().int(),
  /** Messages de l'autre partie arrivés depuis votre dernière lecture. */
  unreadCount: z.number().int(),
  /** Nom du client. Utile à l'équipe ; pour le client, c'est le sien. */
  clientName: z.string(),
  createdAt: z.iso.datetime(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const ConversationDetailSchema = ConversationSummarySchema.extend({
  messages: z.array(MessageSchema),
  /** Faux quand la conversation est close : l'interface n'offre alors pas de champ. */
  canReply: z.boolean(),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

export const ConversationListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(ConversationSummarySchema),
  /** Total des messages non lus, toutes conversations confondues. */
  unreadTotal: z.number().int(),
  /** Nombre de conversations par catégorie, pour les onglets. */
  counts: z.array(
    z.object({ category: ConversationCategorySchema, label: z.string(), count: z.number().int() }),
  ),
});
export type ConversationListResponse = z.infer<typeof ConversationListResponseSchema>;

export const ConversationResponseSchema = z.object({ conversation: ConversationDetailSchema });
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;

// ───────────────────────── Règles partagées ─────────────────────────

/**
 * Aperçu d'un message dans une liste : une ligne, coupée proprement.
 * Écrit ici pour que la liste du client et celle de l'équipe coupent au même endroit.
 */
export function messagePreview(body: string, maximum = 120): string {
  const propre = body.replace(/\s+/g, ' ').trim();
  if (propre.length <= maximum) return propre;
  return `${propre.slice(0, maximum - 1).trimEnd()}…`;
}

/**
 * État d'une conversation après un message.
 *
 * Déduit de l'auteur, jamais déclaré : une conversation ne peut donc pas afficher
 * « répondu » sans qu'une réponse existe. Un message du client rouvre une conversation
 * close — demander d'en ouvrir une autre ferait perdre le fil de l'échange.
 */
export function statusAfterMessage(author: MessageAuthorKind): ConversationStatus {
  return author === 'STAFF' ? 'ANSWERED' : 'OPEN';
}
