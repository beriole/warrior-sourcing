'use client';

import { formatDuration, type CourseCard as CourseCardData } from '@ws/contracts';
import { Badge, Card, Prix, Progress } from '@ws/ui';
import { Clock, ImageOff, PlayCircle, Star } from 'lucide-react';
import Link from 'next/link';

/**
 * Carte d'une formation (§26).
 *
 * ## Ce qui a changé, et pourquoi
 *
 * La version précédente empilait quatre badges sur la même ligne — niveau, thème, accès,
 * prix. À la largeur d'une carte, ils passaient à la ligne, et le prix se retrouvait seul
 * en deuxième rang, perdu entre deux étiquettes grises. Sur une page qui vend des
 * formations, le prix est l'information qu'on cherche en premier.
 *
 * Il est donc remonté **sur la photo**, dans une pastille pleine à fort contraste, en bas
 * à droite — l'endroit où l'œil arrive après avoir balayé l'image. Le niveau occupe le coin
 * opposé. La durée et le nombre de leçons sont posés sur le dégradé : ils accompagnent la
 * photo au lieu de consommer une ligne de texte.
 *
 * Le thème redescend en surtitre plutôt qu'en badge. Un badge attire l'œil ; « Paiement »
 * ou « Douane et conformité » n'a pas à rivaliser avec le prix.
 *
 * ## Deux règles qui tiennent (§54)
 *
 * Sans avis, la carte écrit « Pas encore d'avis » et n'affiche aucune étoile. Pas de
 * moyenne par défaut, pas de cinq étoiles grises qui ressemblent à une note.
 *
 * Le prix barré, quand il existe, vient du serveur : c'est le prix réellement pratiqué,
 * jamais une référence gonflée pour faire paraître la remise plus grande.
 */
export function AcademyCourseCard({ course }: { course: CourseCardData }) {
  const note = course.rating.count > 0 ? course.rating : null;

  return (
    <Card className="group flex h-full flex-col overflow-hidden p-0 transition-shadow duration-200 hover:shadow-lg">
      <Link
        href={`/academy/${course.slug}`}
        className="flex h-full flex-col rounded-lg focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
      >
        <Couverture course={course} />

        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {course.themeLabel}
          </p>

          {/* Deux lignes imposées pour le titre et le résumé : sans elles, trois cartes
              côte à côte ne s'alignent sur rien et la grille paraît bancale. */}
          <h3 className="line-clamp-2 min-h-[2.75rem] font-display leading-snug font-bold text-balance">
            {course.title}
          </h3>
          <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
            {course.summary}
          </p>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
            <span className="truncate text-muted-foreground">{course.instructorName}</span>

            {note ? (
              <span className="figures inline-flex shrink-0 items-center gap-1 font-semibold text-gold-ink">
                <Star className="size-3.5 fill-current" aria-hidden />
                {note.average?.toLocaleString('fr-FR')}
                <span className="font-normal text-muted-foreground">({note.count})</span>
              </span>
            ) : (
              <span className="shrink-0 text-muted-foreground">Pas encore d’avis</span>
            )}
          </div>

          {course.progress && (
            <div className="grid gap-1.5 pt-1">
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
 * Visuel de la formation, et tout ce qui se lit dessus.
 *
 * Les images sont servies telles quelles, sans passer par l'optimiseur de Next : la source
 * peut être un chemin local, une adresse distante ou une donnée intégrée, et l'optimiseur
 * refuse les deux dernières sans configuration préalable.
 *
 * Le dégradé n'est pas décoratif : sans lui, un texte blanc posé sur une photo claire
 * devient illisible, et on ne choisit pas la photo que l'administration téléversera.
 */
function Couverture({ course }: { course: CourseCardData }) {
  return (
    <div className="relative aspect-16/9 w-full overflow-hidden bg-surface-muted">
      {course.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- source locale, distante ou intégrée
        <img
          src={course.coverUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <ImageOff className="size-6" aria-hidden />
          Aucun visuel disponible
        </span>
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-night/85 via-night/35 to-transparent" />

      <span className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
        <Badge tone="night" className="bg-night/85 text-white backdrop-blur-sm">
          {course.levelLabel}
        </Badge>
        {course.enrolled && (
          <Badge tone="verified" className="bg-verified/90 text-white backdrop-blur-sm">
            Accès ouvert
          </Badge>
        )}
      </span>

      <span className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2">
        <span className="figures flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-white/95">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatDuration(course.durationMinutes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <PlayCircle className="size-3.5" aria-hidden />
            {course.lessonCount} leçon{course.lessonCount > 1 ? 's' : ''}
          </span>
        </span>

        <Etiquette course={course} />
      </span>
    </div>
  );
}

/** Ce que coûte la formation, dit en un seul endroit. */
function Etiquette({ course }: { course: CourseCardData }) {
  const commun = 'shrink-0 rounded-md px-2.5 py-1 text-sm font-bold shadow-sm';

  if (course.access === 'FREE') {
    return <span className={`${commun} bg-success text-white`}>Gratuite</span>;
  }

  if (course.access === 'SUBSCRIPTION') {
    return <span className={`${commun} bg-imperial text-xs text-white`}>Incluse dans l’abonnement</span>;
  }

  return (
    <span className={`${commun} bg-white text-night`}>
      <Prix priced={course.priced} tailleEtiquette="petite" />
    </span>
  );
}
