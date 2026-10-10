'use client';

import { formatDuration, type Chapter, type CourseReview, type LessonSummary } from '@ws/contracts';
import { Badge, Button, Card, ElementDeSerie, Entree, Prix, Progress, Serie, Skeleton } from '@ws/ui';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Clock,
  Lock,
  PlayCircle,
  RefreshCw,
  Star,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { formatDate, useAcademyCourse } from './academy-client';
import { PanneauAchat } from './course-purchase-panel';
import { ResourceCardView } from './resource-card';

/**
 * Fiche d'une formation (§26) : extrait, programme, durée, avis, prix.
 *
 * Ce que l'écran n'invente pas : une note sans avis, une bande-annonce absente, une durée
 * arrondie. Les leçons verrouillées sont annoncées comme telles, avec la raison donnée par
 * le serveur — l'interface ne rédige pas son propre refus.
 */
export function CourseDetailView({ slug }: { slug: string }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useAcademyCourse(slug);

  if (isPending) return <DetailSkeleton />;

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Cette formation n’a pas pu être chargée</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => void refetch()} loading={isRefetching}>
              <RefreshCw aria-hidden />
              Réessayer
            </Button>
            <Button variant="outline" asChild>
              <Link href="/academy">Revenir au catalogue</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { course } = data;
  const firstOpenLesson = course.chapters
    .flatMap((chapter) => chapter.lessons)
    .find((lesson) => !lesson.locked);

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Link
        href="/academy"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Academy
      </Link>

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="night">{course.levelLabel}</Badge>
          <Badge tone="neutral">{course.themeLabel}</Badge>
          {course.access === 'PAID' ? (
            <Badge tone="gold">
              <Prix priced={course.priced} tailleEtiquette="petite" />
            </Badge>
          ) : (
            <Badge tone={course.access === 'FREE' ? 'success' : 'brand'}>{course.accessLabel}</Badge>
          )}
          {course.enrolled && <Badge tone="verified">Accès ouvert</Badge>}
        </div>

        <Entree geste="texte" as="h1" className="font-display text-2xl font-bold tracking-tight">
          {course.title}
        </Entree>
        <p className="text-sm text-muted-foreground">{course.summary}</p>

        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            <dt className="sr-only">Durée</dt>
            <dd className="figures">{formatDuration(course.durationMinutes)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <PlayCircle className="size-3.5" aria-hidden />
            <dt className="sr-only">Nombre de leçons</dt>
            <dd className="figures">
              {course.lessonCount} leçon{course.lessonCount > 1 ? 's' : ''}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="size-3.5" aria-hidden />
            <dt className="sr-only">Avis</dt>
            <dd>
              {course.rating.count === 0 ? (
                'Aucun avis'
              ) : (
                <span className="figures">
                  {course.rating.average?.toLocaleString('fr-FR')} sur 5 ({course.rating.count})
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            <dt className="sr-only">Publication</dt>
            <dd>Publiée le {formatDate(course.publishedAt)}</dd>
          </div>
        </dl>
      </header>

      {course.progress && (
        <Card>
          <h2 className="font-semibold">Votre avancement</h2>
          <Progress className="mt-3" value={course.progress.percent} aria-label={`Avancement : ${course.progress.percent} %`} />
          <p className="figures mt-1 text-xs text-muted-foreground">
            {course.progress.completedLessons} leçon{course.progress.completedLessons > 1 ? 's' : ''} terminée
            {course.progress.completedLessons > 1 ? 's' : ''} sur {course.progress.totalLessons} —{' '}
            {course.progress.percent} %
          </p>
          {course.progress.resumeLessonSlug && (
            <Button className="mt-4" block asChild>
              <Link href={`/academy/${course.slug}/${course.progress.resumeLessonSlug}`}>
                <PlayCircle aria-hidden />
                Reprendre : {course.progress.resumeLessonTitle}
              </Link>
            </Button>
          )}
        </Card>
      )}

      {/*
        Une formation payante non encore ouverte affiche de quoi l'acheter, pas seulement
        de quoi constater qu'elle est fermée. L'ancien encart annonçait un prix sans aucun
        moyen de le régler : c'est ce qui faisait croire que le bouton ne marchait pas.
      */}
      {course.access === 'PAID' && !course.enrolled && (
        <PanneauAchat course={course} connecte={course.lockReason !== 'SIGN_IN_REQUIRED'} />
      )}

      {course.lockMessage && !course.progress && course.access !== 'PAID' && (
        <Card className="border-gold/40 bg-gold-soft/40">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface text-gold-ink">
              <Lock className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold">Contenu réservé</h2>
              <p className="mt-1 text-sm text-muted-foreground">{course.lockMessage}</p>
              {course.access === 'SUBSCRIPTION' && (
                <Button className="mt-3" asChild size="sm">
                  <Link href="/abonnement">Voir les offres d’abonnement</Link>
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {firstOpenLesson && !course.progress && (
        <Button block asChild>
          <Link href={`/academy/${course.slug}/${firstOpenLesson.slug}`}>
            <PlayCircle aria-hidden />
            {firstOpenLesson.preview && !course.enrolled
              ? 'Voir l’extrait offert'
              : 'Commencer la formation'}
          </Link>
        </Button>
      )}

      {course.trailerUrl ? (
        <Card className="p-0">
          <video
            controls
            preload="metadata"
            src={course.trailerUrl}
            className="aspect-16/9 w-full rounded-lg bg-night"
          >
            Votre navigateur ne sait pas lire cette vidéo.
          </video>
        </Card>
      ) : null}

      {/*
        Le programme vient **avant** la présentation et le formateur, et c'est le point :
        ce qu'on achète, c'est une suite de leçons. Les montrer après deux paragraphes de
        description oblige à faire défiler pour savoir ce qu'il y a dans la boîte.
      */}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-lg font-bold">Programme</h2>
          {course.chapters.length > 0 && (
            <p className="figures text-sm text-muted-foreground">
              {course.chapters.length} chapitre{course.chapters.length > 1 ? 's' : ''} ·{' '}
              {course.lessonCount} leçon{course.lessonCount > 1 ? 's' : ''} ·{' '}
              {formatDuration(course.durationMinutes)}
            </p>
          )}
        </div>

        {course.chapters.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              Le programme de cette formation n’a pas encore été publié.
            </p>
          </Card>
        ) : (
          <Serie className="grid gap-3">
            {course.chapters.map((chapter, index) => (
              <ElementDeSerie key={chapter.id} index={index} total={course.chapters.length}>
                <ChapterBlock chapter={chapter} index={index} courseSlug={course.slug} />
              </ElementDeSerie>
            ))}
          </Serie>
        )}
      </section>

      <Card>
        <h2 className="font-semibold">À propos de cette formation</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{course.description}</p>

        {course.outcomes.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">Ce que vous saurez faire</h3>
            <ul className="mt-2 grid gap-1.5">
              {course.outcomes.map((outcome) => (
                <li key={outcome} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {outcome}
                </li>
              ))}
            </ul>
          </>
        )}

        {course.prerequisites.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">Avant de commencer</h3>
            <ul className="mt-2 grid gap-1.5">
              {course.prerequisites.map((prerequisite) => (
                <li key={prerequisite} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CircleDot className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {prerequisite}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Le formateur</h2>
        <p className="mt-2 text-sm font-semibold">{course.instructor.name}</p>
        <p className="text-sm text-muted-foreground">{course.instructor.headline}</p>
        {course.instructor.bio && <p className="mt-2 text-sm text-muted-foreground">{course.instructor.bio}</p>}
      </Card>

      {course.resources.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-lg font-bold">Documents de la formation</h2>
          <div className="grid gap-3">
            {course.resources.map((resource) => (
              <ResourceCardView key={resource.id} resource={resource} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="font-display text-lg font-bold">Avis</h2>
        {course.reviews.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              Aucun avis pour le moment. Les avis viennent de comptes qui ont suivi la formation : nous n’en
              affichons aucun autre.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {course.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChapterBlock({
  chapter,
  index,
  courseSlug,
}: {
  chapter: Chapter;
  index: number;
  courseSlug: string;
}) {
  return (
    <Card className="p-0">
      <div className="border-b border-border p-4">
        <p className="figures text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Chapitre {index + 1}
        </p>
        <h3 className="mt-0.5 font-semibold">{chapter.title}</h3>
        {chapter.summary && <p className="mt-1 text-sm text-muted-foreground">{chapter.summary}</p>}
      </div>

      <ul className="divide-y divide-border">
        {chapter.lessons.map((lesson) => (
          <li key={lesson.id}>
            <LessonRow lesson={lesson} courseSlug={courseSlug} />
          </li>
        ))}
      </ul>

      {chapter.quizId && (
        <p className="flex items-center gap-1.5 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5" aria-hidden />
          Quiz de fin de chapitre — <span className="figures">{chapter.quizQuestionCount}</span> question
          {chapter.quizQuestionCount > 1 ? 's' : ''}
        </p>
      )}
    </Card>
  );
}

function LessonRow({ lesson, courseSlug }: { lesson: LessonSummary; courseSlug: string }) {
  const content = (
    <span className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left">
      <span className="shrink-0 text-muted-foreground">
        {lesson.locked ? (
          <Lock className="size-4" aria-hidden />
        ) : lesson.status === 'COMPLETED' ? (
          <CheckCircle2 className="size-4 text-success" aria-hidden />
        ) : (
          <PlayCircle className="size-4" aria-hidden />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{lesson.title}</span>
        <span className="figures block text-xs text-muted-foreground">
          {formatDuration(lesson.durationMinutes)}
          {lesson.documentCount > 0 && ` — ${lesson.documentCount} document${lesson.documentCount > 1 ? 's' : ''}`}
          {lesson.status === 'IN_PROGRESS' && ' — commencée'}
        </span>
      </span>

      {lesson.preview && !lesson.locked && (
        <Badge tone="success" className="shrink-0">
          Extrait offert
        </Badge>
      )}
    </span>
  );

  if (lesson.locked) {
    return (
      <span className="flex opacity-60" aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link
      href={`/academy/${courseSlug}/${lesson.slug}`}
      className="flex hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
    >
      {content}
    </Link>
  );
}

function ReviewCard({ review }: { review: CourseReview }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{review.authorName}</p>
        <p className="figures flex shrink-0 items-center gap-1 text-sm">
          <Star className="size-3.5 text-gold-ink" aria-hidden />
          {review.rating} / 5
        </p>
      </div>
      {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Déposé le {formatDate(review.publishedAt)}</p>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="aspect-16/9 w-full rounded-lg" />
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}
