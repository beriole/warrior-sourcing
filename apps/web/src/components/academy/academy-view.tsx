'use client';

import {
  COURSE_ACCESSES,
  COURSE_ACCESS_LABELS,
  COURSE_LEVELS,
  COURSE_LEVEL_LABELS,
  COURSE_THEMES,
  COURSE_THEME_LABELS,
  type CourseAccess,
  type CourseTheme,
} from '@ws/contracts';
import { Badge, Button, Card, Entree, GrilleAnimee, Progress, Skeleton } from '@ws/ui';
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap, Library, PlayCircle, RefreshCw, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  EMPTY_COURSE_FILTERS,
  countActiveFilters,
  formatDate,
  useAcademyCourses,
  type CourseFilters,
} from './academy-client';
import { AcademyCourseCard } from './course-card';

const PER_PAGE = 12;

/**
 * Écran Academy (§26).
 *
 * Trois choses dans cet ordre : reprendre là où on s'est arrêté, parcourir le catalogue par
 * niveau et par thème, rejoindre la bibliothèque. Mobile d'abord : une colonne, onglets de
 * niveau défilants, zones tactiles d'au moins 44 px.
 */
export function AcademyView() {
  const [filters, setFilters] = useState<CourseFilters>(EMPTY_COURSE_FILTERS);
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useAcademyCourses({
    page,
    perPage: PER_PAGE,
    filters,
  });

  const activeFilters = countActiveFilters(filters);

  function changeFilters(next: CourseFilters) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <Entree geste="texte" as="h1" className="font-display text-2xl font-bold tracking-tight">
          Academy
        </Entree>
        <Entree geste="paragraphe" delai={0.06} as="p" className="mt-1 text-sm text-muted-foreground">
          Des formations courtes sur l’importation depuis la Chine : trouver un produit, choisir un
          fournisseur, calculer un coût rendu, passer la douane. Les durées annoncées sont celles des
          leçons publiées.
        </Entree>
      </header>

      {data?.resume && <ResumeCard resume={data.resume} />}

      <nav aria-label="Niveau" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2">
          <li>
            <LevelButton selected={filters.level === undefined} onClick={() => changeFilters({ ...filters, level: undefined })}>
              Tous les niveaux
            </LevelButton>
          </li>
          {COURSE_LEVELS.map((level) => {
            const count = data?.levels.find((entry) => entry.level === level)?.count ?? 0;
            return (
              <li key={level}>
                <LevelButton
                  selected={filters.level === level}
                  onClick={() => changeFilters({ ...filters, level })}
                  title={COURSE_LEVEL_LABELS[level].description}
                >
                  {COURSE_LEVEL_LABELS[level].label}
                  {count > 0 && <span className="figures ml-1.5 text-xs font-normal opacity-70">{count}</span>}
                </LevelButton>
              </li>
            );
          })}
        </ul>
      </nav>

      {filters.level && (
        <p className="text-sm text-muted-foreground">{COURSE_LEVEL_LABELS[filters.level].description}</p>
      )}

      <FiltersPanel
        filters={filters}
        activeFilters={activeFilters}
        themes={data?.themes ?? []}
        onChange={changeFilters}
      />

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">Les formations n’ont pas pu être chargées</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      ) : data.items.length === 0 ? (
        <Card className="flex flex-col items-start">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <h2 className="font-semibold">Aucune formation ne correspond</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeFilters > 0
              ? 'Essayez un autre niveau ou un autre thème : le catalogue est encore court.'
              : 'Une formation n’est publiée qu’une fois son programme complet et ses leçons enregistrées. Revenez bientôt.'}
          </p>
          {activeFilters > 0 && (
            <Button className="mt-4" variant="outline" size="sm" onClick={() => changeFilters(EMPTY_COURSE_FILTERS)}>
              Effacer les filtres
            </Button>
          )}
        </Card>
      ) : (
        <>
          <p className="figures text-xs text-muted-foreground">
            {data.total} formation{data.total > 1 ? 's' : ''} — page {data.page} sur {data.totalPages}
          </p>

          <div aria-busy={isPlaceholderData || undefined} className={isPlaceholderData ? 'opacity-60' : ''}>
            <GrilleAnimee
              signature={`${page}|${JSON.stringify(filters)}`}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {data.items.map((course) => (
                <AcademyCourseCard key={course.id} course={course} />
              ))}
            </GrilleAnimee>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden />
                Précédent
              </Button>
              <span className="figures text-sm text-muted-foreground">
                {data.page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Suivant
                <ChevronRight aria-hidden />
              </Button>
            </div>
          )}
        </>
      )}

      <Card className="flex flex-col items-start">
        <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
          <Library className="size-5" aria-hidden />
        </span>
        <h2 className="font-semibold">Bibliothèque</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les guides, checklists, modèles et fiches pratiques, séparés des formations : à consulter quand
          une commande est en cours.
        </p>
        <Button className="mt-4" variant="outline" size="sm" asChild>
          <Link href="/academy/bibliotheque">
            Ouvrir la bibliothèque
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </Card>
    </div>
  );
}

/** Reprendre la dernière leçon travaillée (§26). Ne s'affiche que s'il y en a une. */
function ResumeCard({
  resume,
}: {
  resume: NonNullable<ReturnType<typeof useAcademyCourses>['data']>['resume'];
}) {
  if (!resume) return null;

  return (
    <Card className="border-imperial/30 bg-imperial-soft/40">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-surface text-imperial-hover">
          <PlayCircle className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-imperial-hover">Reprendre</p>
          <h2 className="mt-0.5 truncate font-semibold">{resume.courseTitle}</h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{resume.lessonTitle}</p>
          <Progress
            className="mt-3"
            value={resume.percent}
            aria-label={`Avancement : ${resume.percent} %`}
          />
          <p className="figures mt-1 text-xs text-muted-foreground">
            {resume.percent} % — dernière activité le {formatDate(resume.lastActivityAt)}
          </p>
        </div>
      </div>
      <Button className="mt-4" block asChild>
        <Link href={`/academy/${resume.courseSlug}/${resume.lessonSlug}`}>
          <BookOpen aria-hidden />
          Continuer la leçon
        </Link>
      </Button>
    </Card>
  );
}

function LevelButton({
  selected,
  onClick,
  title,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={selected ? 'true' : undefined}
      className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
        selected
          ? 'border-transparent bg-night text-white'
          : 'border-border bg-surface text-foreground hover:bg-surface-muted'
      }`}
    >
      {children}
    </button>
  );
}

/** Filtres repliés par défaut : l'écran reste lisible sur un téléphone d'entrée de gamme. */
function FiltersPanel({
  filters,
  activeFilters,
  themes,
  onChange,
}: {
  filters: CourseFilters;
  activeFilters: number;
  themes: { theme: CourseTheme; label: string; count: number }[];
  onChange: (filters: CourseFilters) => void;
}) {
  const update = (patch: CourseFilters) => onChange({ ...filters, ...patch });

  return (
    <details className="rounded-lg border border-border bg-surface shadow-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <SlidersHorizontal className="size-4" aria-hidden />
        Thème, accès, recherche
        {activeFilters > 0 && (
          <Badge tone="brand">
            {activeFilters} actif{activeFilters > 1 ? 's' : ''}
          </Badge>
        )}
      </summary>

      <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Thème</span>
          <select
            value={filters.theme ?? ''}
            onChange={(event) => update({ theme: (event.target.value || undefined) as CourseTheme | undefined })}
            className={inputClass}
          >
            <option value="">Tous les thèmes</option>
            {COURSE_THEMES.map((theme) => {
              const count = themes.find((entry) => entry.theme === theme)?.count ?? 0;
              return (
                <option key={theme} value={theme}>
                  {COURSE_THEME_LABELS[theme]}
                  {count > 0 ? ` (${count})` : ''}
                </option>
              );
            })}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Accès</span>
          <select
            value={filters.access ?? ''}
            onChange={(event) => update({ access: (event.target.value || undefined) as CourseAccess | undefined })}
            className={inputClass}
          >
            <option value="">Toutes les formations</option>
            {COURSE_ACCESSES.map((access) => (
              <option key={access} value={access}>
                {COURSE_ACCESS_LABELS[access]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Recherche</span>
          <input
            type="search"
            value={filters.search ?? ''}
            onChange={(event) => update({ search: event.target.value || undefined })}
            placeholder="Par exemple « douane » ou « négociation »"
            className={inputClass}
          />
        </label>

        <div className="flex items-end sm:col-span-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_COURSE_FILTERS)} disabled={activeFilters === 0}>
            Effacer les filtres
          </Button>
        </div>
      </div>
    </details>
  );
}

const inputClass =
  'min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-imperial';

function ListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <Skeleton className="aspect-16/9 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
