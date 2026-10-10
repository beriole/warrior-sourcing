'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AcademyCourseListResponse,
  CourseAccess,
  CourseDetailResponse,
  CourseLevel,
  CourseTheme,
  LessonNotesResponse,
  LessonProgressResponse,
  LessonResponse,
  QuizResponse,
  QuizResultResponse,
  ResourceDownloadResponse,
  ResourceListResponse,
  ResourceType,
} from '@ws/contracts';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Accès aux routes de l'Academy (lot ACA).
 *
 * Le client généré par Orval ne couvre pas encore ces routes : il est reconstruit par
 * `pnpm generate:api`, qui écrit dans des fichiers partagés avec les autres lots.
 * En attendant cette régénération, les appels passent par le même transport (`apiRequest`)
 * et sont typés avec les schémas de `@ws/contracts` : le contrat reste unique.
 */

/** Filtres du catalogue, tels que l'utilisateur les manipule. */
export interface CourseFilters {
  level?: CourseLevel;
  theme?: CourseTheme;
  access?: CourseAccess;
  search?: string;
}

/** Filtres de la bibliothèque. */
export interface ResourceFilters {
  type?: ResourceType;
  theme?: CourseTheme;
  search?: string;
}

export const EMPTY_COURSE_FILTERS: CourseFilters = {};
export const EMPTY_RESOURCE_FILTERS: ResourceFilters = {};

export function countActiveFilters(filters: CourseFilters | ResourceFilters): number {
  return Object.values(filters).filter((value) => value !== undefined && value !== '').length;
}

function toSearchParams(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

/** Catalogue paginé des formations, avec la formation à reprendre quand il y en a une. */
export function useAcademyCourses(args: { page: number; perPage: number; filters: CourseFilters }) {
  const query = toSearchParams({ page: args.page, perPage: args.perPage, ...args.filters });

  return useQuery<AcademyCourseListResponse>({
    queryKey: ['academy', 'formations', query],
    queryFn: ({ signal }) => apiRequest<AcademyCourseListResponse>(`/v1/academy/courses?${query}`, { signal }),
    // La reprise et l'inscription dépendent de la session : on garde la page précédente
    // affichée pendant le rechargement plutôt que de faire clignoter l'écran.
    placeholderData: (previous) => previous,
  });
}

/** Fiche d'une formation : programme, formateur, avis, ressources. */
export function useAcademyCourse(slug: string) {
  return useQuery<CourseDetailResponse>({
    queryKey: ['academy', 'formation', slug],
    queryFn: ({ signal }) =>
      apiRequest<CourseDetailResponse>(`/v1/academy/courses/${encodeURIComponent(slug)}`, { signal }),
  });
}

function lessonPath(courseSlug: string, lessonSlug: string): string {
  return `/v1/academy/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`;
}

/** Leçon et son URL de lecture. Le serveur décide s'il y en a une. */
export function useAcademyLesson(courseSlug: string, lessonSlug: string) {
  return useQuery<LessonResponse>({
    queryKey: ['academy', 'lecon', courseSlug, lessonSlug],
    queryFn: ({ signal }) => apiRequest<LessonResponse>(lessonPath(courseSlug, lessonSlug), { signal }),
    // L'URL de lecture est signée pour quelques heures : inutile de la redemander sans cesse.
    staleTime: 60_000,
  });
}

/** Enregistrement de la position de lecture et de l'achèvement d'une leçon. */
export function useSaveProgress(courseSlug: string, lessonSlug: string) {
  const queryClient = useQueryClient();

  return useMutation<LessonProgressResponse, Error, { watchedSeconds: number; completed?: boolean }>({
    mutationFn: (body) =>
      apiRequest<LessonProgressResponse>(`${lessonPath(courseSlug, lessonSlug)}/progress`, {
        method: 'POST',
        body: JSON.stringify({ watchedSeconds: body.watchedSeconds, completed: body.completed ?? false }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academy', 'formations'] });
      void queryClient.invalidateQueries({ queryKey: ['academy', 'formation', courseSlug] });
    },
  });
}

/** Notes personnelles d'une leçon. Un champ vidé efface la note. */
export function useSaveNotes(courseSlug: string, lessonSlug: string) {
  return useMutation<LessonNotesResponse, Error, string>({
    mutationFn: (notes) =>
      apiRequest<LessonNotesResponse>(`${lessonPath(courseSlug, lessonSlug)}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes }),
      }),
  });
}

/** Questions d'un quiz. Les bonnes réponses ne sont pas envoyées avant la correction. */
export function useQuiz(quizId: string | null) {
  return useQuery<QuizResponse>({
    queryKey: ['academy', 'quiz', quizId],
    queryFn: ({ signal }) => apiRequest<QuizResponse>(`/v1/academy/quizzes/${encodeURIComponent(quizId!)}`, { signal }),
    enabled: quizId !== null,
  });
}

/** Correction d'un quiz, calculée côté serveur. */
export function useSubmitQuiz(quizId: string) {
  return useMutation<QuizResultResponse, Error, { questionId: string; choiceId: string }[]>({
    mutationFn: (answers) =>
      apiRequest<QuizResultResponse>(`/v1/academy/quizzes/${encodeURIComponent(quizId)}/attempts`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
  });
}

/** Bibliothèque paginée : PDF, guides, checklists, modèles et fiches pratiques. */
export function useLibrary(args: { page: number; perPage: number; filters: ResourceFilters }) {
  const query = toSearchParams({ page: args.page, perPage: args.perPage, ...args.filters });

  return useQuery<ResourceListResponse>({
    queryKey: ['academy', 'bibliotheque', query],
    queryFn: ({ signal }) => apiRequest<ResourceListResponse>(`/v1/academy/resources?${query}`, { signal }),
    placeholderData: (previous) => previous,
  });
}

/** Lien de téléchargement d'une ressource. Le droit est vérifié côté serveur. */
export function useResourceDownload() {
  return useMutation<ResourceDownloadResponse, Error, string>({
    mutationFn: (slug) =>
      apiRequest<ResourceDownloadResponse>(`/v1/academy/resources/${encodeURIComponent(slug)}/download`),
  });
}

/** Date courte en français : aucun chiffre daté ne s'affiche sans elle. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CM', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Taille lisible d'un fichier. `null` reste « taille inconnue », jamais 0. */
export function formatFileSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
