import { z } from 'zod';

/**
 * Uploads et tâches de fond (lot PLAT).
 *
 * Schémas de requête et de réponse de ce lot. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client du site d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 */

// ───────────────────────── Uploads (PLAT-06) ─────────────────────────

/** Familles de fichiers acceptées. Tout autre type est refusé avant signature. */
export const UPLOAD_KINDS = ['IMAGE', 'DOCUMENT', 'VIDEO'] as const;
export const UploadKindSchema = z.enum(UPLOAD_KINDS);
export type UploadKind = z.infer<typeof UploadKindSchema>;

/** Types MIME autorisés par famille. La liste est fermée : un exécutable n'y entrera jamais. */
export const UPLOAD_ACCEPTED_TYPES: Record<UploadKind, readonly string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  DOCUMENT: ['application/pdf'],
  VIDEO: ['video/mp4'],
};

/** Taille maximale par famille, en octets (images 5 Mo, PDF 10 Mo, vidéo 200 Mo). */
export const UPLOAD_MAX_BYTES: Record<UploadKind, number> = {
  IMAGE: 5 * 1024 * 1024,
  DOCUMENT: 10 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,
};

/** Extensions que Cloudinary acceptera pour la famille (paramètre signé `allowed_formats`). */
export const UPLOAD_ALLOWED_FORMATS: Record<UploadKind, readonly string[]> = {
  IMAGE: ['jpg', 'jpeg', 'png', 'webp'],
  DOCUMENT: ['pdf'],
  VIDEO: ['mp4'],
};

/** Dossiers Cloudinary ouverts à l'envoi. Un module qui a besoin d'un nouveau dossier l'ajoute ici. */
export const UPLOAD_FOLDERS = ['products', 'suppliers', 'inspections', 'academy', 'messages', 'profiles', 'sourcing'] as const;
export const UploadFolderSchema = z.enum(UPLOAD_FOLDERS);
export type UploadFolder = z.infer<typeof UploadFolderSchema>;

/** Famille d'un type MIME, ou `null` si le type n'est pas accepté. */
export function uploadKindForContentType(contentType: string): UploadKind | null {
  const normalized = contentType.trim().toLowerCase();
  for (const kind of UPLOAD_KINDS) {
    if (UPLOAD_ACCEPTED_TYPES[kind].includes(normalized)) return kind;
  }
  return null;
}

/** Valeur prête pour l'attribut `accept` d'un champ fichier. */
export function uploadAcceptAttribute(kinds: readonly UploadKind[] = UPLOAD_KINDS): string {
  return kinds.flatMap((kind) => UPLOAD_ACCEPTED_TYPES[kind]).join(',');
}

export const SignUploadRequestSchema = z.object({
  /** Type MIME annoncé par le navigateur. */
  contentType: z.string().min(1).max(100),
  /** Taille du fichier en octets. */
  sizeBytes: z.number().int().positive(),
  folder: UploadFolderSchema,
  /** Nom d'origine, uniquement informatif (jamais utilisé tel quel comme identifiant). */
  fileName: z.string().max(255).optional(),
});
export type SignUploadRequest = z.infer<typeof SignUploadRequestSchema>;

export const CloudinaryResourceTypeSchema = z.enum(['image', 'video', 'raw']);
export type CloudinaryResourceType = z.infer<typeof CloudinaryResourceTypeSchema>;

/**
 * Tout ce dont le navigateur a besoin pour envoyer le fichier directement à Cloudinary :
 * le serveur ne relaie jamais les octets, il ne fait que signer.
 */
export const SignUploadResponseSchema = z.object({
  /** Adresse de l'API d'envoi Cloudinary pour ce type de ressource. */
  uploadUrl: z.url(),
  /** Champs à joindre au formulaire multipart, en plus du fichier (`file`). */
  fields: z.record(z.string(), z.string()),
  kind: UploadKindSchema,
  resourceType: CloudinaryResourceTypeSchema,
  publicId: z.string(),
  folder: z.string(),
  maxBytes: z.number().int(),
  /** Après cette date, Cloudinary refuse la signature (une heure). */
  expiresAt: z.iso.datetime(),
});
export type SignUploadResponse = z.infer<typeof SignUploadResponseSchema>;

/** Ce que Cloudinary renvoie après un envoi réussi (sous-ensemble utile). */
export const UploadedAssetSchema = z.object({
  url: z.url(),
  publicId: z.string(),
  resourceType: CloudinaryResourceTypeSchema,
  bytes: z.number().int(),
  format: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
export type UploadedAsset = z.infer<typeof UploadedAssetSchema>;

/** Transformations d'image nommées : vignette carrée, carte, plein écran. Format et qualité automatiques. */
export const IMAGE_TRANSFORMATIONS = {
  thumbnail: 'c_fill,g_auto,w_320,h_320,f_auto,q_auto',
  card: 'c_limit,w_800,f_auto,q_auto',
  full: 'c_limit,w_1600,f_auto,q_auto',
} as const;
export type ImageTransformation = keyof typeof IMAGE_TRANSFORMATIONS;

/**
 * Insère une transformation dans une URL de livraison Cloudinary
 * (`…/image/upload/<transformation>/…`). Une URL qui n'est pas Cloudinary est renvoyée telle quelle.
 */
export function withImageTransformation(url: string, transformation: ImageTransformation): string {
  const marker = '/image/upload/';
  const index = url.indexOf(marker);
  if (index === -1) return url;
  const head = url.slice(0, index + marker.length);
  const tail = url.slice(index + marker.length);
  return `${head}${IMAGE_TRANSFORMATIONS[transformation]}/${tail}`;
}

// ───────────────────────── Tâches de fond (PLAT-07) ─────────────────────────

export const JOB_STATUSES = ['SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export const JobStatusSchema = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JOB_KINDS = ['DELAYED', 'REPEATING'] as const;
export const JobKindSchema = z.enum(JOB_KINDS);
export type JobKind = z.infer<typeof JobKindSchema>;

export const JobSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: JobKindSchema,
  status: JobStatusSchema,
  payload: z.unknown(),
  /** Intervalle en millisecondes ou expression cron, pour une tâche récurrente. */
  schedule: z.string().nullable(),
  nextRunAt: z.iso.datetime().nullable(),
  lastRunAt: z.iso.datetime().nullable(),
  lastError: z.string().nullable(),
  runs: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type JobSummary = z.infer<typeof JobSummarySchema>;

export const JobsBackendSchema = z.enum(['MEMORY', 'REDIS']);
export type JobsBackend = z.infer<typeof JobsBackendSchema>;

export const AdminJobsResponseSchema = z.object({
  backend: JobsBackendSchema,
  jobs: z.array(JobSummarySchema),
});
export type AdminJobsResponse = z.infer<typeof AdminJobsResponseSchema>;

// ───────────────────────── Recherche globale (PLAT-08, §36) ─────────────────────────

/**
 * Familles de résultats de la recherche globale. Une famille = une table interrogée,
 * et un chemin d'ouverture connu du client.
 */
export const SEARCH_ENTITY_TYPES = ['PRODUCT', 'SUPPLIER', 'COURSE', 'SERVICE'] as const;
export const SearchEntityTypeSchema = z.enum(SEARCH_ENTITY_TYPES);
export type SearchEntityType = z.infer<typeof SearchEntityTypeSchema>;

export const SEARCH_ENTITY_TYPE_LABELS: Record<SearchEntityType, { label: string; plural: string }> = {
  PRODUCT: { label: 'Produit', plural: 'Produits' },
  SUPPLIER: { label: 'Fournisseur', plural: 'Fournisseurs' },
  COURSE: { label: 'Formation', plural: 'Formations' },
  SERVICE: { label: 'Prestation', plural: 'Prestations' },
};

/**
 * Seuil de ressemblance en dessous duquel un résultat n'est pas proposé.
 * Mesuré avec `word_similarity` de pg_trgm, sur un texte désaccentué et en minuscules :
 * « telefone » ressemble à « téléphone » à ~0,46, bien au-dessus de ce seuil, alors que
 * deux mots sans rapport tombent sous 0,2. Descendre plus bas remonterait du bruit.
 */
export const SEARCH_MIN_SCORE = 0.3;

/** Nombre de résultats servis par famille lorsqu'aucune famille n'est imposée. */
export const SEARCH_PER_TYPE = 5;

export const GlobalSearchQuerySchema = z.object({
  /** Le texte cherché, tel que l'utilisateur l'a tapé, fautes comprises. */
  q: z.string().trim().min(2).max(80),
  /** Restreint la recherche à une famille. Absent : les quatre familles sont interrogées. */
  type: SearchEntityTypeSchema.optional(),
  /** Nombre total de résultats au plus. */
  limit: z.coerce.number().int().positive().max(50).default(20),
});
export type GlobalSearchQuery = z.infer<typeof GlobalSearchQuerySchema>;

export const SearchHitSchema = z.object({
  type: SearchEntityTypeSchema,
  typeLabel: z.string(),
  id: z.string(),
  /** Identifiant d'URL quand la fiche en a un ; sinon l'identifiant technique. */
  slug: z.string(),
  title: z.string(),
  /** Une ligne de contexte, `null` quand la fiche n'en porte pas. Jamais inventée. */
  subtitle: z.string().nullable(),
  /** Chemin d'ouverture de la fiche dans le site. */
  href: z.string(),
  /** Ressemblance mesurée, entre 0 et 1 : sert à trier, pas à rassurer. */
  score: z.number(),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const GlobalSearchResponseSchema = z.object({
  /** La requête telle qu'elle a été interprétée (texte réduit, accents retirés). */
  query: z.string(),
  total: z.number().int(),
  items: z.array(SearchHitSchema),
  /** Nombre de résultats par famille, pour les onglets. */
  counts: z.array(
    z.object({ type: SearchEntityTypeSchema, label: z.string(), count: z.number().int() }),
  ),
});
export type GlobalSearchResponse = z.infer<typeof GlobalSearchResponseSchema>;

// ───────────────────────── Favoris (PLAT-09, §36) ─────────────────────────

/** Ce qu'un compte peut mettre en favori. Mêmes familles que la recherche globale. */
export const FAVORITE_TARGET_TYPES = ['PRODUCT', 'SUPPLIER', 'COURSE', 'SERVICE'] as const;
export const FavoriteTargetTypeSchema = z.enum(FAVORITE_TARGET_TYPES);
export type FavoriteTargetType = z.infer<typeof FavoriteTargetTypeSchema>;

export const FAVORITE_TARGET_TYPE_LABELS: Record<FavoriteTargetType, { label: string; plural: string }> = {
  PRODUCT: { label: 'Produit', plural: 'Produits' },
  SUPPLIER: { label: 'Fournisseur', plural: 'Fournisseurs' },
  COURSE: { label: 'Formation', plural: 'Formations' },
  SERVICE: { label: 'Prestation', plural: 'Prestations' },
};

/** Ajout d'un favori. Idempotent : rappeler la route ne crée pas de doublon. */
export const AddFavoriteRequestSchema = z.object({
  targetType: FavoriteTargetTypeSchema,
  /** Identifiant technique de la fiche. Son existence est vérifiée côté serveur. */
  targetId: z.string().min(1).max(100),
});
export type AddFavoriteRequest = z.infer<typeof AddFavoriteRequestSchema>;

export const FavoriteQuerySchema = z.object({
  type: FavoriteTargetTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(24),
});
export type FavoriteQuery = z.infer<typeof FavoriteQuerySchema>;

export const FavoriteSchema = z.object({
  targetType: FavoriteTargetTypeSchema,
  targetTypeLabel: z.string(),
  targetId: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
  addedAt: z.iso.datetime(),
});
export type Favorite = z.infer<typeof FavoriteSchema>;

export const FavoriteListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(FavoriteSchema),
  counts: z.array(
    z.object({ type: FavoriteTargetTypeSchema, label: z.string(), count: z.number().int() }),
  ),
});
export type FavoriteListResponse = z.infer<typeof FavoriteListResponseSchema>;

/**
 * Résultat d'un ajout ou d'un retrait. `favorite` dit l'état après l'appel,
 * `changed` dit si l'appel a réellement écrit quelque chose : les deux routes sont
 * idempotentes, et l'interface a besoin de savoir l'état, pas de le deviner.
 */
export const FavoriteMutationResponseSchema = z.object({
  targetType: FavoriteTargetTypeSchema,
  targetId: z.string(),
  favorite: z.boolean(),
  changed: z.boolean(),
  /** Nombre total de favoris du compte après l'appel. */
  total: z.number().int(),
});
export type FavoriteMutationResponse = z.infer<typeof FavoriteMutationResponseSchema>;
