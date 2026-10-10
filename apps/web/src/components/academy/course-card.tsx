'use client';

import { formatDuration, type CourseCard as CourseCardData } from '@ws/contracts';
import { Badge, Card, Prix, Progress } from '@ws/ui';
import { Clock, ImageOff, PlayCircle, Star } from 'lucide-react';
import Link from 'next/link';

/**
 * Carte compacte d'une formation (§26).
 *
 * Sans avis, la carte écrit « aucun avis » : jamais d'étoiles par défaut (§54).
 * Le prix n'apparaît que lorsqu'il y en a un.
 */
export function AcademyCourseCard({ course }: { course: CourseCardData }) {
  return (
    <Card className="flex h-full flex-col p-0">
      <Link
        href={`/academy/${course.slug}`}
        className="flex h-full flex-col rounded-lg focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
      >
        <Cover course={course} />

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="night">{course.levelLabel}</Badge>
            <Badge tone="neutral">{course.themeLabel}</Badge>
            {course.access === 'FREE' ? (
              <Badge tone="success">Gratuite</Badge>
            ) : course.access === 'SUBSCRIPTION' ? (
              <Badge tone="brand">Incluse dans l’abonnement</Badge>
            ) : (
              <Badge tone="gold">
                <Prix priced={course.priced} tailleEtiquette="petite" />
              </Badge>
            )}
            {course.enrolled && <Badge tone="verified">Accès ouvert</Badge>}
          </div>

          <div>
            <h3 className="line-clamp-2 font-semibold leading-tight">{course.title}</h3>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{course.summary}</p>
          </div>

          <dl className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">Durée et nombre de leçons</dt>
              <dd className="figures">
                {formatDuration(course.durationMinutes)} — {course.lessonCount} leçon
                {course.lessonCount > 1 ? 's' : ''}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">Avis</dt>
              <dd>
                {course.rating.count === 0 ? (
                  'Aucun avis pour le moment'
                ) : (
                  <span className="figures">
                    {course.rating.average?.toLocaleString('fr-FR')} sur 5 — {course.rating.count} avis
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">Animée par {course.instructorName}</p>

          {course.progress && (
            <div className="mt-auto grid gap-1.5">
              <Progress value={course.progress.percent} aria-label={`Avancement : ${course.progress.percent} %`} />
              <p className="figures text-xs text-muted-foreground">
                {course.progress.completedLessons} leçon{course.progress.completedLessons > 1 ? 's' : ''} sur{' '}
                {course.progress.totalLessons} — {course.progress.percent} %
              </p>
            </div>
          )}
        </div>
      </Link>
    </Card>
  );
}

/**
 * Visuel de la formation. Les images sont servies telles quelles (elles peuvent être des
 * données intégrées) : on n'utilise donc pas l'optimiseur d'images.
 */
function Cover({ course }: { course: CourseCardData }) {
  if (!course.coverUrl) {
    return (
      <div className="flex aspect-16/9 items-center justify-center rounded-t-lg bg-surface-muted text-muted-foreground">
        <span className="flex flex-col items-center gap-1 text-xs">
          <ImageOff className="size-6" aria-hidden />
          Aucun visuel disponible
        </span>
      </div>
    );
  }

  return (
    <span className="relative block">
      {/* eslint-disable-next-line @next/next/no-img-element -- source distante ou intégrée, sans optimiseur */}
      <img
        src={course.coverUrl}
        alt={`Visuel de la formation ${course.title}`}
        loading="lazy"
        className="aspect-16/9 w-full rounded-t-lg bg-surface-muted object-cover"
      />
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-sm bg-night/85 px-2 py-0.5 text-xs font-semibold text-white">
        <PlayCircle className="size-3.5" aria-hidden />
        {course.lessonCount} leçon{course.lessonCount > 1 ? 's' : ''}
      </span>
    </span>
  );
}
