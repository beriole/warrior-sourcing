import { z } from 'zod';
import { CameroonPhoneSchema } from './api-orders.js';
import {
  BudgetRangeIdSchema,
  DisplayNameSchema,
  ImporterGoalSchema,
  ImporterLevelSchema,
  InterestCategorySchema,
} from './onboarding.js';
import { ShipmentStageSchema } from './logistics.js';
import { UserRoleSchema } from './roles.js';

/**
 * Réponses de l'API, décrites une seule fois.
 *
 * Le serveur type ses contrôleurs avec ces schémas et les publie dans le contrat OpenAPI ;
 * le front consomme le client généré à partir de ce contrat. Une réponse ne peut donc plus
 * changer d'un côté sans que l'autre cesse de compiler.
 */

export const ImporterProfileResponseSchema = z.object({
  level: ImporterLevelSchema,
  goals: z.array(ImporterGoalSchema),
  budgetRange: BudgetRangeIdSchema,
  interests: z.array(InterestCategorySchema),
  city: z.string().nullable(),
});

export const MeResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phoneNumber: z.string().nullable(),
    role: UserRoleSchema,
  }),
  onboardingCompleted: z.boolean(),
  profile: ImporterProfileResponseSchema.nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/**
 * Modification des informations du compte, depuis le profil.
 *
 * L'email n'est pas modifiable ici : c'est l'identifiant de connexion, et le changer
 * demande de prouver qu'on possède la nouvelle adresse. Tant que ce parcours n'existe
 * pas, l'écran dit que l'adresse ne se change pas plutôt que d'offrir un champ qui
 * échouerait.
 *
 * Le numéro est facultatif et effaçable : `null` le retire, l'absence du champ le laisse
 * tel quel. Sans cette distinction, on ne pourrait jamais supprimer un numéro saisi par
 * erreur.
 */
export const UpdateMeRequestSchema = z.object({
  name: DisplayNameSchema.optional(),
  phoneNumber: CameroonPhoneSchema.nullable().optional(),
});
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;

export const OnboardingOptionsResponseSchema = z.object({
  levels: z.array(z.object({ id: z.string(), label: z.string() })),
  goals: z.array(z.object({ id: z.string(), label: z.string() })),
  budgets: z.array(z.object({ id: z.string(), min: z.number(), max: z.number().nullable() })),
  interests: z.array(z.object({ id: z.string(), label: z.string() })),
});
export type OnboardingOptionsResponse = z.infer<typeof OnboardingOptionsResponseSchema>;

export const SaveProfileResponseSchema = z.object({
  onboardingCompleted: z.boolean(),
  profile: ImporterProfileResponseSchema,
});
export type SaveProfileResponse = z.infer<typeof SaveProfileResponseSchema>;

/** Cahier §11 : cockpit d'action. */
export const DashboardResponseSchema = z.object({
  user: z.object({ displayName: z.string(), role: UserRoleSchema }),
  onboardingCompleted: z.boolean(),
  activity: z.object({
    activeOrders: z.number().int(),
    inTransit: z.number().int(),
    readyForPickup: z.number().int(),
    delivered: z.number().int(),
  }),
  urgentOrder: z
    .object({
      reference: z.string(),
      stage: ShipmentStageSchema,
      stageLabel: z.string(),
      nextStageLabel: z.string().nullable(),
      /** Avancement entre 0 et 1 dans les étapes logistiques. */
      progress: z.number(),
      totalXaf: z.number().int(),
      lastEvent: z.object({ description: z.string(), occurredAt: z.iso.datetime() }).nullable(),
      updatedAt: z.iso.datetime(),
    })
    .nullable(),
  nextAction: z.object({
    id: z.string(),
    label: z.string(),
    reason: z.string(),
    href: z.string(),
  }),
  opportunities: z.array(z.unknown()),
  currentCourse: z.object({ title: z.string(), progressPercent: z.number(), href: z.string() }).nullable(),
  unreadNotifications: z.number().int(),
});
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

/** Résultat du calculateur : toujours une estimation, jamais une garantie (§14, §21). */
export const LandedCostResponseSchema = z.object({
  provenance: z.literal('ESTIMATE'),
  result: z.object({
    merchandiseCost: z.number().int(),
    chinaInlandTransport: z.number().int(),
    inspection: z.number().int(),
    freight: z.number().int(),
    otherCosts: z.number().int(),
    totalCost: z.number().int(),
    unitLandedCost: z.number().int(),
    selling: z
      .object({
        unitSellingPrice: z.number().int(),
        revenue: z.number().int(),
        unitMargin: z.number().int(),
        totalMargin: z.number().int(),
        roi: z.number(),
        breakEvenUnits: z.number().int().nullable(),
      })
      .nullable(),
  }),
});
export type LandedCostResponse = z.infer<typeof LandedCostResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.string(),
  database: z.string(),
});
