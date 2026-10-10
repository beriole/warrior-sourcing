/**
 * Formations, leçons et progression (lot ACA, §26).
 *
 * Schémas de requête et de réponse de ce lot. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 *
 * Règles respectées (§54) :
 * - les prix sont des entiers en FCFA (1 FCFA = 1 unité) ;
 * - aucun chiffre inventé : un cours sans avis renvoie `reviews.count = 0` et `average = null` ;
 * - l'URL de lecture d'une vidéo n'est jamais présente dans une réponse servie à un compte
 *   qui n'a pas le droit d'y accéder : le droit est décidé côté serveur.
 */
import { z } from 'zod';
import { CameroonPhoneSchema } from './api-orders.js';
import { PricedSchema } from './promotions.js';

// ───────────────────────── Énumérations ─────────────────────────

/** Niveau d'une formation. Identique à `CourseLevel` dans academy.prisma. */
export const COURSE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const CourseLevelSchema = z.enum(COURSE_LEVELS);
export type CourseLevel = z.infer<typeof CourseLevelSchema>;

export const COURSE_LEVEL_LABELS: Record<CourseLevel, { label: string; description: string }> = {
  BEGINNER: { label: 'Débutant', description: 'Aucune importation réalisée : on part de zéro.' },
  INTERMEDIATE: { label: 'Intermédiaire', description: 'Quelques commandes passées, on structure la méthode.' },
  ADVANCED: { label: 'Avancé', description: 'Activité régulière : volumes, marges et négociation.' },
};

/** Thème d'une formation ou d'une ressource. Identique à `CourseTheme` dans academy.prisma. */
export const COURSE_THEMES = [
  'BASICS',
  'SOURCING',
  'SUPPLIERS',
  'NEGOTIATION',
  'PAYMENT',
  'LOGISTICS',
  'CUSTOMS',
  'SELLING',
] as const;
export const CourseThemeSchema = z.enum(COURSE_THEMES);
export type CourseTheme = z.infer<typeof CourseThemeSchema>;

export const COURSE_THEME_LABELS: Record<CourseTheme, string> = {
  BASICS: 'Bases de l’import',
  SOURCING: 'Recherche de produits',
  SUPPLIERS: 'Fournisseurs',
  NEGOTIATION: 'Négociation',
  PAYMENT: 'Paiement',
  LOGISTICS: 'Transport et logistique',
  CUSTOMS: 'Douane et conformité',
  SELLING: 'Vente au Cameroun',
};

/**
 * Conditions d'accès à une formation (§26, §43).
 * `PAID` : achat unitaire. `SUBSCRIPTION` : inclus dans un abonnement.
 * Le paiement lui-même appartient aux lots PAY et SUB : ici, seul le droit est modélisé.
 */
export const COURSE_ACCESSES = ['FREE', 'PAID', 'SUBSCRIPTION'] as const;
export const CourseAccessSchema = z.enum(COURSE_ACCESSES);
export type CourseAccess = z.infer<typeof CourseAccessSchema>;

export const COURSE_ACCESS_LABELS: Record<CourseAccess, string> = {
  FREE: 'Formation gratuite',
  PAID: 'Formation payante',
  SUBSCRIPTION: 'Incluse dans l’abonnement',
};

/** Origine d'une inscription : ce qui a ouvert le droit d'accès. */
export const ENROLLMENT_SOURCES = ['FREE_COURSE', 'PURCHASE', 'SUBSCRIPTION', 'GRANTED'] as const;
export const EnrollmentSourceSchema = z.enum(ENROLLMENT_SOURCES);
export type EnrollmentSource = z.infer<typeof EnrollmentSourceSchema>;

export const ENROLLMENT_SOURCE_LABELS: Record<EnrollmentSource, string> = {
  FREE_COURSE: 'Formation gratuite',
  PURCHASE: 'Achat de la formation',
  SUBSCRIPTION: 'Abonnement en cours',
  GRANTED: 'Accès ouvert par l’équipe',
};

/** Nature d'une ressource de la bibliothèque (ACA-05). */
export const RESOURCE_TYPES = ['PDF', 'GUIDE', 'CHECKLIST', 'TEMPLATE', 'FACT_SHEET'] as const;
export const ResourceTypeSchema = z.enum(RESOURCE_TYPES);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  PDF: 'Document PDF',
  GUIDE: 'Guide',
  CHECKLIST: 'Checklist',
  TEMPLATE: 'Modèle à remplir',
  FACT_SHEET: 'Fiche pratique',
};

/** Avancement d'une leçon pour un compte donné. */
export const LESSON_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
export const LessonStatusSchema = z.enum(LESSON_STATUSES);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

/**
 * Raison pour laquelle une leçon est verrouillée. Le libellé affiché vient de la table
 * ci-dessous : l'interface n'invente jamais son propre message de refus.
 */
export const LOCK_REASONS = ['SIGN_IN_REQUIRED', 'PURCHASE_REQUIRED', 'SUBSCRIPTION_REQUIRED'] as const;
export const LockReasonSchema = z.enum(LOCK_REASONS);
export type LockReason = z.infer<typeof LockReasonSchema>;

export const LOCK_REASON_LABELS: Record<LockReason, string> = {
  SIGN_IN_REQUIRED: 'Connectez-vous pour suivre cette leçon.',
  PURCHASE_REQUIRED: 'Cette formation est payante : elle s’ouvre après son achat.',
  SUBSCRIPTION_REQUIRED: 'Cette formation est incluse dans l’abonnement.',
};

// ───────────────────────── Requêtes ─────────────────────────

export const AcademyCourseQuerySchema = z.object({
  level: CourseLevelSchema.optional(),
  theme: CourseThemeSchema.optional(),
  access: CourseAccessSchema.optional(),
  /** Recherche libre sur le titre et le résumé. */
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(48).default(12),
});
export type AcademyCourseQuery = z.infer<typeof AcademyCourseQuerySchema>;

export const ResourceQuerySchema = z.object({
  type: ResourceTypeSchema.optional(),
  theme: CourseThemeSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(48).default(12),
});
export type ResourceQuery = z.infer<typeof ResourceQuerySchema>;

/** Enregistrement de progression envoyé par le lecteur. */
export const LessonProgressRequestSchema = z.object({
  /** Position atteinte dans la vidéo, en secondes entières. */
  watchedSeconds: z.number().int().min(0).max(24 * 3600),
  /** Vrai quand la leçon vient d'être terminée. */
  completed: z.boolean().default(false),
});
export type LessonProgressRequest = z.infer<typeof LessonProgressRequestSchema>;

/** Notes personnelles d'une leçon. Vider le champ efface la note. */
export const LessonNotesRequestSchema = z.object({
  notes: z.string().max(5_000),
});
export type LessonNotesRequest = z.infer<typeof LessonNotesRequestSchema>;

/** Réponses à un quiz : une réponse par question, par identifiant de choix. */
export const QuizAttemptRequestSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().min(1), choiceId: z.string().min(1) }))
    .min(1)
    .max(50),
});
export type QuizAttemptRequest = z.infer<typeof QuizAttemptRequestSchema>;

/** Ouverture d'un accès par l'équipe, en attendant le paiement (lots PAY et SUB). */
export const GrantEnrollmentRequestSchema = z.object({
  userId: z.string().min(1),
  courseSlug: z.string().min(1),
  source: EnrollmentSourceSchema.default('GRANTED'),
});
export type GrantEnrollmentRequest = z.infer<typeof GrantEnrollmentRequestSchema>;

/**
 * Paliers de prix des formations, en FCFA (§26, §43).
 *
 * Ce ne sont pas des prix imposés : l'administration saisit le montant qu'elle veut, et
 * le serveur accepte n'importe quel entier positif. Ce sont des **points d'appui**, que
 * le back-office propose d'un clic, pour qu'une grille reste lisible d'une formation à
 * l'autre. Une grille à 5 000, 7 300, 12 450 et 19 900 n'aide personne à se situer.
 */
export const COURSE_PRICE_TIERS_XAF = [5_000, 10_000, 15_000, 20_000] as const;

/**
 * Achat d'une formation à l'unité (SUB-02).
 *
 * Un seul point d'entrée sert les deux cas, avec ou sans compte : c'est ce qui garantit
 * qu'un prix et une promotion sont décidés au même endroit. Sans session, `fullName` et
 * `email` deviennent obligatoires — le serveur le vérifie, et crée le compte au passage.
 *
 * Comme pour l'abonnement, les identifiants ne sont engendrés qu'à la **confirmation du
 * paiement** : un panier abandonné ne laisse derrière lui aucun mot de passe envoyé à
 * quelqu'un qui n'a rien payé.
 */
export const BuyCourseRequestSchema = z.object({
  /** Requis sans session. Ignoré quand une session existe : on ne renomme pas un compte. */
  fullName: z.string().trim().min(2, 'Indiquez votre nom.').max(80).optional(),
  /** Requis sans session. Ignoré quand une session existe. */
  email: z.string().trim().toLowerCase().pipe(z.email('Indiquez une adresse électronique valide.')).optional(),
  payerPhone: CameroonPhoneSchema,
  paymentMethod: z.enum(['MTN_MOMO', 'ORANGE_MONEY']),
  promotionCode: z.string().trim().max(24).nullable().default(null),
});
export type BuyCourseRequest = z.infer<typeof BuyCourseRequestSchema>;

export const CoursePurchaseStatusSchema = z.enum(['PENDING_PAYMENT', 'PAID', 'CANCELLED']);
export type CoursePurchaseStatus = z.infer<typeof CoursePurchaseStatusSchema>;

export const COURSE_PURCHASE_STATUS_LABELS: Record<CoursePurchaseStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

export const BuyCourseResponseSchema = z.object({
  purchase: z.object({
    id: z.string(),
    courseSlug: z.string(),
    courseTitle: z.string(),
    status: CoursePurchaseStatusSchema,
    statusLabel: z.string(),
    paidXaf: z.number().int(),
    createdAt: z.iso.datetime(),
  }),
  /** `null` quand la formation est offerte par une promotion : il n'y a rien à encaisser. */
  paymentReference: z.string().nullable(),
  email: z.string(),
  accountCreated: z.boolean(),
  /** Ce qui se passe maintenant, en une phrase écrite par le serveur. */
  nextStep: z.string(),
});
export type BuyCourseResponse = z.infer<typeof BuyCourseResponseSchema>;

// ───────────────────────── Briques de réponse ─────────────────────────

export const InstructorSchema = z.object({
  name: z.string(),
  /** Ce que la personne fait réellement, en une ligne. Aucun titre inventé. */
  headline: z.string(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
});
export type Instructor = z.infer<typeof InstructorSchema>;

/**
 * Note moyenne d'une formation. `average` vaut `null` tant qu'aucun avis n'a été déposé :
 * l'interface affiche alors « aucun avis », jamais une note par défaut (§54).
 */
export const CourseRatingSchema = z.object({
  average: z.number().nullable(),
  count: z.number().int(),
});
export type CourseRating = z.infer<typeof CourseRatingSchema>;

export const CourseReviewSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  publishedAt: z.iso.datetime(),
});
export type CourseReview = z.infer<typeof CourseReviewSchema>;

/** Avancement d'un compte dans une formation. `null` quand personne n'est connecté. */
export const CourseProgressSchema = z.object({
  completedLessons: z.number().int(),
  totalLessons: z.number().int(),
  percent: z.number().int().min(0).max(100),
  /** Leçon à reprendre : la première non terminée, ou `null` si tout est terminé. */
  resumeLessonSlug: z.string().nullable(),
  resumeLessonTitle: z.string().nullable(),
  lastActivityAt: z.iso.datetime().nullable(),
});
export type CourseProgress = z.infer<typeof CourseProgressSchema>;

export const CourseCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  level: CourseLevelSchema,
  levelLabel: z.string(),
  theme: CourseThemeSchema,
  themeLabel: z.string(),
  access: CourseAccessSchema,
  accessLabel: z.string(),
  /** Prix en FCFA entiers. Vaut 0 pour une formation gratuite. */
  priceXaf: z.number().int(),
  /**
   * Prix réellement proposé, promotion comprise. `originalXaf` y vaut toujours le prix
   * de la fiche : jamais une référence gonflée pour simuler une remise (§54).
   */
  priced: PricedSchema,
  /** Durée totale, somme des durées des leçons publiées. */
  durationMinutes: z.number().int(),
  lessonCount: z.number().int(),
  coverUrl: z.string().nullable(),
  instructorName: z.string(),
  rating: CourseRatingSchema,
  publishedAt: z.iso.datetime(),
  /** Vrai seulement si la session en cours a réellement un droit d'accès. */
  enrolled: z.boolean(),
  /** Avancement du compte connecté, `null` sans session ou sans inscription. */
  progress: CourseProgressSchema.nullable(),
});
export type CourseCard = z.infer<typeof CourseCardSchema>;

export const LessonSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  position: z.number().int(),
  durationMinutes: z.number().int(),
  hasVideo: z.boolean(),
  documentCount: z.number().int(),
  /** Leçon offerte en extrait, lisible sans achat. */
  preview: z.boolean(),
  /** Vrai quand le compte n'a pas le droit de la lire. */
  locked: z.boolean(),
  status: LessonStatusSchema,
});
export type LessonSummary = z.infer<typeof LessonSummarySchema>;

export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  position: z.number().int(),
  lessons: z.array(LessonSummarySchema),
  /** Identifiant du quiz de fin de chapitre, `null` quand le chapitre n'en a pas. */
  quizId: z.string().nullable(),
  quizQuestionCount: z.number().int(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const ResourceCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  type: ResourceTypeSchema,
  typeLabel: z.string(),
  theme: CourseThemeSchema,
  themeLabel: z.string(),
  /** Extension du fichier (pdf, docx…), telle qu'elle a été envoyée. */
  fileFormat: z.string(),
  sizeBytes: z.number().int().nullable(),
  pageCount: z.number().int().nullable(),
  /** Formation dont la ressource dépend, quand elle en dépend d'une. */
  courseSlug: z.string().nullable(),
  courseTitle: z.string().nullable(),
  /** Faux quand la ressource n'est ouverte qu'aux inscrits de sa formation. */
  free: z.boolean(),
  /** Vrai quand le compte peut télécharger : décidé côté serveur. */
  downloadable: z.boolean(),
  lockedReason: z.string().nullable(),
  publishedAt: z.iso.datetime(),
});
export type ResourceCard = z.infer<typeof ResourceCardSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  position: z.number().int(),
  /** Les bonnes réponses ne sont jamais envoyées avant la correction. */
  choices: z.array(z.object({ id: z.string(), label: z.string() })),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

// ───────────────────────── Réponses ─────────────────────────

export const AcademyCourseListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(CourseCardSchema),
  /** Niveaux et thèmes réellement présents en catalogue, avec leur nombre de formations. */
  levels: z.array(z.object({ level: CourseLevelSchema, label: z.string(), count: z.number().int() })),
  themes: z.array(z.object({ theme: CourseThemeSchema, label: z.string(), count: z.number().int() })),
  /**
   * Formation à reprendre (§26) : la dernière leçon travaillée par le compte connecté.
   * `null` sans session ou tant qu'aucune leçon n'a été ouverte.
   */
  resume: z
    .object({
      courseSlug: z.string(),
      courseTitle: z.string(),
      lessonSlug: z.string(),
      lessonTitle: z.string(),
      percent: z.number().int(),
      lastActivityAt: z.iso.datetime(),
    })
    .nullable(),
});
export type AcademyCourseListResponse = z.infer<typeof AcademyCourseListResponseSchema>;

export const CourseDetailResponseSchema = z.object({
  course: CourseCardSchema.extend({
    description: z.string(),
    /** Ce que la formation permet de faire, phrase par phrase. Aucune promesse de gain. */
    outcomes: z.array(z.string()),
    prerequisites: z.array(z.string()),
    instructor: InstructorSchema,
    /** Extrait de présentation, lisible sans compte quand il existe. */
    trailerUrl: z.string().nullable(),
    chapters: z.array(ChapterSchema),
    resources: z.array(ResourceCardSchema),
    reviews: z.array(CourseReviewSchema),
    /** Pourquoi le contenu est verrouillé, `null` quand il ne l'est pas. */
    lockReason: LockReasonSchema.nullable(),
    lockMessage: z.string().nullable(),
  }),
});
export type CourseDetailResponse = z.infer<typeof CourseDetailResponseSchema>;

export const LessonResponseSchema = z.object({
  courseSlug: z.string(),
  courseTitle: z.string(),
  chapterTitle: z.string(),
  lesson: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    durationMinutes: z.number().int(),
    /**
     * URL de lecture signée, valable quelques heures. Présente uniquement quand le droit
     * d'accès a été vérifié ; `null` quand aucune vidéo n'est attachée ou quand
     * l'hébergement n'est pas configuré (voir `playbackUnavailableReason`).
     */
    playbackUrl: z.string().nullable(),
    playbackUnavailableReason: z.string().nullable(),
    documents: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        fileFormat: z.string(),
        sizeBytes: z.number().int().nullable(),
        url: z.string(),
      }),
    ),
    /** Position reprise à l'ouverture, en secondes. */
    watchedSeconds: z.number().int(),
    status: LessonStatusSchema,
    notes: z.string().nullable(),
    quizId: z.string().nullable(),
  }),
  /** Sommaire complet, pour naviguer sans recharger la fiche. */
  chapters: z.array(ChapterSchema),
  progress: CourseProgressSchema,
  previousLessonSlug: z.string().nullable(),
  nextLessonSlug: z.string().nullable(),
});
export type LessonResponse = z.infer<typeof LessonResponseSchema>;

export const LessonProgressResponseSchema = z.object({
  status: LessonStatusSchema,
  watchedSeconds: z.number().int(),
  progress: CourseProgressSchema,
  /** Vrai quand cette mise à jour vient d'achever la formation. */
  courseCompleted: z.boolean(),
});
export type LessonProgressResponse = z.infer<typeof LessonProgressResponseSchema>;

export const LessonNotesResponseSchema = z.object({
  notes: z.string().nullable(),
  savedAt: z.iso.datetime(),
});
export type LessonNotesResponse = z.infer<typeof LessonNotesResponseSchema>;

export const QuizResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  courseSlug: z.string(),
  chapterTitle: z.string(),
  /** Pourcentage de bonnes réponses exigé pour réussir. */
  passScorePercent: z.number().int(),
  questions: z.array(QuizQuestionSchema),
  /** Dernier résultat du compte, `null` s'il n'a jamais passé ce quiz. */
  lastAttempt: z
    .object({ scorePercent: z.number().int(), passed: z.boolean(), takenAt: z.iso.datetime() })
    .nullable(),
});
export type QuizResponse = z.infer<typeof QuizResponseSchema>;

export const QuizResultResponseSchema = z.object({
  scorePercent: z.number().int(),
  correctCount: z.number().int(),
  questionCount: z.number().int(),
  passed: z.boolean(),
  passScorePercent: z.number().int(),
  /** Correction question par question : la bonne réponse et son explication. */
  corrections: z.array(
    z.object({
      questionId: z.string(),
      prompt: z.string(),
      correct: z.boolean(),
      chosenChoiceId: z.string().nullable(),
      correctChoiceId: z.string(),
      correctChoiceLabel: z.string(),
      explanation: z.string().nullable(),
    }),
  ),
});
export type QuizResultResponse = z.infer<typeof QuizResultResponseSchema>;

export const ResourceListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(ResourceCardSchema),
  types: z.array(z.object({ type: ResourceTypeSchema, label: z.string(), count: z.number().int() })),
  themes: z.array(z.object({ theme: CourseThemeSchema, label: z.string(), count: z.number().int() })),
});
export type ResourceListResponse = z.infer<typeof ResourceListResponseSchema>;

export const ResourceDownloadResponseSchema = z.object({
  url: z.string(),
  fileFormat: z.string(),
  /** Fin de validité du lien signé. */
  expiresAt: z.iso.datetime(),
});
export type ResourceDownloadResponse = z.infer<typeof ResourceDownloadResponseSchema>;

export const GrantEnrollmentResponseSchema = z.object({
  userId: z.string(),
  courseSlug: z.string(),
  source: EnrollmentSourceSchema,
  sourceLabel: z.string(),
  enrolledAt: z.iso.datetime(),
  /** Vrai quand l'inscription existait déjà : l'appel est idempotent. */
  alreadyEnrolled: z.boolean(),
});
export type GrantEnrollmentResponse = z.infer<typeof GrantEnrollmentResponseSchema>;

// ───────────────────────── Règles partagées ─────────────────────────

/** Avancement d'une formation en pourcentage entier. Sans leçon, l'avancement vaut 0. */
export function courseProgressPercent(completedLessons: number, totalLessons: number): number {
  if (totalLessons <= 0) return 0;
  const percent = Math.round((completedLessons / totalLessons) * 100);
  return Math.min(100, Math.max(0, percent));
}

/** Score d'un quiz en pourcentage entier de bonnes réponses. */
export function quizScorePercent(correctCount: number, questionCount: number): number {
  if (questionCount <= 0) return 0;
  return Math.round((correctCount / questionCount) * 100);
}

/** Durée lisible : « 1 h 25 » ou « 45 min ». Jamais « 85 minutes ». */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}
