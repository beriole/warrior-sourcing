import { z } from 'zod';
import { InspectionResultSchema, ShipmentStageSchema, ShippingModeSchema } from './logistics.js';

/**
 * Logistique, suivi et inspection (lot LOG).
 *
 * Schémas de requête et de réponse de ce lot. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client du site d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 */

/** Date acceptée en ISO complet ou en simple jour ; le serveur la reçoit comme une vraie Date. */
const DateInputSchema = z
  .union([z.iso.datetime(), z.iso.date()], { error: 'Indiquez une date valide.' })
  .transform((value) => new Date(value));

/** Preuve : un fichier déjà déposé, référencé par son adresse (le dépôt est un autre lot). */
const ProofUrlSchema = z.url('L’adresse de la preuve est invalide.').max(2_000);

export const INSPECTION_RESULT_LABELS: Record<z.infer<typeof InspectionResultSchema>, string> = {
  COMPLIANT: 'Conforme',
  WITH_RESERVATIONS: 'Réserve',
  NON_COMPLIANT: 'Non conforme',
};

// ───────────────────────── Requêtes (LOG-01, LOG-04, LOG-05) ─────────────────────────

export const RecordShipmentEventRequestSchema = z.object({
  stage: ShipmentStageSchema,
  /** Date et heure réelles de l'événement, pas celle de la saisie. */
  occurredAt: DateInputSchema,
  description: z.string().trim().min(3, 'Décrivez l’événement en quelques mots.').max(1_000),
  proofUrl: ProofUrlSchema.optional(),
  proofUrls: z.array(ProofUrlSchema).max(10, 'Dix preuves au plus par événement.').default([]),
  /** Obligatoire pour un retour en arrière ; réservé aux administrateurs. */
  rollbackReason: z
    .string()
    .trim()
    .min(5, 'Expliquez le motif du retour en arrière.')
    .max(500)
    .optional(),
});
export type RecordShipmentEventRequest = z.input<typeof RecordShipmentEventRequestSchema>;
export type RecordShipmentEventData = z.output<typeof RecordShipmentEventRequestSchema>;

/** Action groupée : chaque commande sélectionnée passe à l'étape suivante (LOG-04). */
export const BulkAdvanceRequestSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1, 'Sélectionnez au moins une commande.').max(50),
  description: z.string().trim().min(3, 'Décrivez l’événement en quelques mots.').max(1_000),
  occurredAt: DateInputSchema.optional(),
  proofUrl: ProofUrlSchema.optional(),
});
export type BulkAdvanceRequest = z.input<typeof BulkAdvanceRequestSchema>;
export type BulkAdvanceData = z.output<typeof BulkAdvanceRequestSchema>;

export const CreateInspectionRequestSchema = z.object({
  result: InspectionResultSchema,
  quantityExpected: z.number().int().nonnegative().optional(),
  quantityReceived: z.number().int().nonnegative().optional(),
  defects: z.string().trim().max(2_000).optional(),
  packaging: z.string().trim().max(1_000).optional(),
  measurements: z.string().trim().max(500).optional(),
  /** Poids en grammes : entier, jamais de flottant. */
  weightGrams: z.number().int().nonnegative().optional(),
  photoUrls: z.array(ProofUrlSchema).max(30, 'Trente photos au plus par rapport.').default([]),
  videoUrl: ProofUrlSchema.optional(),
  notes: z.string().trim().max(2_000).optional(),
  inspectedAt: DateInputSchema.optional(),
});
export type CreateInspectionRequest = z.input<typeof CreateInspectionRequestSchema>;
export type CreateInspectionData = z.output<typeof CreateInspectionRequestSchema>;

/** Filtres de la vue opérationnelle. Tout est facultatif : sans filtre, tout le tableau. */
export const OpsBoardQuerySchema = z.object({
  /** Référence de commande, code de colis ou nom du client. */
  recherche: z.string().trim().max(120).optional(),
  stage: ShipmentStageSchema.optional(),
  mode: ShippingModeSchema.optional(),
  /** Par défaut, les commandes livrées sont masquées : elles n'ont plus d'action à traiter. */
  livrees: z.enum(['oui', 'non']).default('non'),
});
export type OpsBoardQuery = z.input<typeof OpsBoardQuerySchema>;
export type OpsBoardQueryData = z.output<typeof OpsBoardQuerySchema>;

// ───────────────────────── Réponses ─────────────────────────

export const ShipmentEventResponseSchema = z.object({
  id: z.string(),
  stage: ShipmentStageSchema,
  stageLabel: z.string(),
  occurredAt: z.iso.datetime(),
  description: z.string(),
  proofUrl: z.string().nullable(),
  proofUrls: z.array(z.string()),
  recordedByName: z.string().nullable(),
  rollbackReason: z.string().nullable(),
  previousStage: ShipmentStageSchema.nullable(),
  inspectionId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type ShipmentEventResponse = z.infer<typeof ShipmentEventResponseSchema>;

export const ParcelResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string().nullable(),
});
export type ParcelResponse = z.infer<typeof ParcelResponseSchema>;

export const InspectionReportResponseSchema = z.object({
  id: z.string(),
  result: InspectionResultSchema,
  resultLabel: z.string(),
  quantityExpected: z.number().int().nullable(),
  quantityReceived: z.number().int().nullable(),
  defects: z.string().nullable(),
  packaging: z.string().nullable(),
  measurements: z.string().nullable(),
  weightGrams: z.number().int().nullable(),
  photoUrls: z.array(z.string()),
  videoUrl: z.string().nullable(),
  notes: z.string().nullable(),
  inspectedAt: z.iso.datetime(),
  inspectedByName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type InspectionReportResponse = z.infer<typeof InspectionReportResponseSchema>;

/** Résumé d'une commande suivie : liste client et colonnes de la vue opérationnelle. */
export const TrackedOrderSummarySchema = z.object({
  id: z.string(),
  reference: z.string(),
  stage: ShipmentStageSchema,
  stageLabel: z.string(),
  stageIndex: z.number().int(),
  stageCount: z.number().int(),
  nextStage: ShipmentStageSchema.nullable(),
  nextStageLabel: z.string().nullable(),
  /** Avancement entre 0 et 1 dans les étapes logistiques. */
  progress: z.number(),
  shippingMode: ShippingModeSchema.nullable(),
  totalXaf: z.number().int(),
  parcelCode: z.string().nullable(),
  lastEvent: z.object({ description: z.string(), occurredAt: z.iso.datetime() }).nullable(),
  /** Dernier résultat d'inspection connu, pour le signaler d'un coup d'œil. */
  lastInspectionResult: InspectionResultSchema.nullable(),
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type TrackedOrderSummary = z.infer<typeof TrackedOrderSummarySchema>;

export const TrackedOrderListResponseSchema = z.object({
  orders: z.array(TrackedOrderSummarySchema),
});
export type TrackedOrderListResponse = z.infer<typeof TrackedOrderListResponseSchema>;

export const TrackedOrderDetailResponseSchema = z.object({
  order: TrackedOrderSummarySchema,
  parcel: ParcelResponseSchema.nullable(),
  /** Du plus récent au plus ancien. */
  events: z.array(ShipmentEventResponseSchema),
  /** Du plus récent au plus ancien ; tous archivés. */
  inspections: z.array(InspectionReportResponseSchema),
  /** Toutes les étapes, pour dessiner la timeline complète côté client. */
  stages: z.array(z.object({ stage: ShipmentStageSchema, label: z.string() })),
});
export type TrackedOrderDetailResponse = z.infer<typeof TrackedOrderDetailResponseSchema>;

/** Vue opérationnelle : une colonne par étape, dans l'ordre du cahier (LOG-04). */
export const OpsBoardResponseSchema = z.object({
  columns: z.array(
    z.object({
      stage: ShipmentStageSchema,
      label: z.string(),
      orders: z.array(
        TrackedOrderSummarySchema.extend({
          customerName: z.string(),
        }),
      ),
    }),
  ),
  total: z.number().int(),
});
export type OpsBoardResponse = z.infer<typeof OpsBoardResponseSchema>;

export const BulkAdvanceResponseSchema = z.object({
  advanced: z.array(
    z.object({ orderId: z.string(), reference: z.string(), stage: ShipmentStageSchema }),
  ),
  skipped: z.array(z.object({ orderId: z.string(), reason: z.string() })),
});
export type BulkAdvanceResponse = z.infer<typeof BulkAdvanceResponseSchema>;
