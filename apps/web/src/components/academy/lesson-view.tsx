'use client';

import { formatDuration, type LessonResponse } from '@ws/contracts';
import { Badge, Button, Card, Progress, Skeleton } from '@ws/ui';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Lock,
  NotebookPen,
  PlayCircle,
  RefreshCw,
  VideoOff,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-fetcher';
import { formatFileSize, useAcademyLesson, useSaveNotes, useSaveProgress } from './academy-client';
import { QuizPanel } from './quiz-panel';

/** Fréquence d'enregistrement de la position de lecture : assez rare pour un réseau lent. */
const PROGRESS_INTERVAL_SECONDS = 15;

/**
 * Lecteur de leçon (ACA-02, ACA-04).
 *
 * La vidéo n'est lue que si le serveur a renvoyé une URL : l'écran ne tente jamais de
 * reconstituer un lien. La lecture reprend à la seconde enregistrée, et la position repart
 * vers le serveur toutes les quinze secondes — pas à chaque image.
 */
export function LessonView({ courseSlug, lessonSlug }: { courseSlug: string; lessonSlug: string }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useAcademyLesson(courseSlug, lessonSlug);

  if (isPending) return <LessonSkeleton />;

  if (isError) {
    const locked = error instanceof ApiError && error.status === 403;

    return (
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
        <Card className="flex flex-col items-start">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
            <Lock className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-lg font-bold">
            {locked ? 'Cette leçon n’est pas ouverte à votre compte' : 'Cette leçon n’a pas pu être chargée'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href={`/academy/${courseSlug}`}>Revenir à la formation</Link>
            </Button>
            {!locked && (
              <Button onClick={() => void refetch()} loading={isRefetching}>
                <RefreshCw aria-hidden />
                Réessayer
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return <LessonContent key={`${courseSlug}/${lessonSlug}`} courseSlug={courseSlug} data={data} />;
}

function LessonContent({ courseSlug, data }: { courseSlug: string; data: LessonResponse }) {
  const { lesson } = data;
  const progress = useSaveProgress(courseSlug, lesson.slug);
  const [status, setStatus] = useState(lesson.status);
  const [percent, setPercent] = useState(data.progress.percent);
  const [quizOpen, setQuizOpen] = useState(false);

  function record(watchedSeconds: number, completed = false) {
    progress.mutate(
      { watchedSeconds, completed },
      {
        onSuccess: (result) => {
          setStatus(result.status);
          setPercent(result.progress.percent);
        },
      },
    );
  }

  // Où l'on en est dans la formation, en clair. Sans ce repère, « leçon suivante » est le
  // seul indice de position, et on ne sait jamais combien il en reste.
  const toutes = data.chapters.flatMap((chapitre) => chapitre.lessons);
  const rang = toutes.findIndex((item) => item.slug === lesson.slug) + 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <Link
        href={`/academy/${courseSlug}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {data.courseTitle}
      </Link>

      {/*
        Deux colonnes sur grand écran, le programme à droite et collant.
        Il était auparavant tout en bas, après le quiz et les notes : pour atteindre la
        leçon suivante autrement qu'en suivant le bouton, il fallait dérouler toute la page.
        Sur petit écran la colonne de droite repasse dessous — c'est l'ordre d'avant, et il
        n'y a pas la place pour mieux.
      */}
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-5">
          <header>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {data.chapterTitle}
            </p>
            <h1 className="mt-0.5 font-display text-xl font-bold tracking-tight">{lesson.title}</h1>
            <p className="figures mt-1 text-xs text-muted-foreground">
              Leçon {rang} sur {data.progress.totalLessons} — {formatDuration(lesson.durationMinutes)}
              {status === 'COMPLETED' && ' — terminée'}
            </p>
            {lesson.summary && <p className="mt-2 text-sm text-muted-foreground">{lesson.summary}</p>}
          </header>

          <Player lesson={lesson} onProgress={record} />

          {/* L'action qui suit le visionnage, juste sous le lecteur : c'est là qu'on la cherche. */}
          <div className="flex flex-wrap items-center gap-3">
            {status === 'COMPLETED' ? (
              <Badge tone="success">
                <CheckCircle2 aria-hidden />
                Leçon terminée
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                loading={progress.isPending}
                onClick={() => record(lesson.watchedSeconds, true)}
              >
                <CheckCircle2 aria-hidden />
                Marquer cette leçon comme terminée
              </Button>
            )}

            {data.nextLessonSlug && status === 'COMPLETED' && (
              <Button size="sm" asChild>
                <Link href={`/academy/${courseSlug}/${data.nextLessonSlug}`}>
                  Leçon suivante
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            )}
          </div>

          {progress.isError && (
            <p className="text-xs text-danger">
              {progress.error instanceof Error
                ? progress.error.message
                : 'Votre avancement n’a pas pu être enregistré.'}
            </p>
          )}

          {lesson.documents.length > 0 && (
            <Card>
              <h2 className="font-semibold">Documents de la leçon</h2>
              <ul className="mt-3 divide-y divide-border">
                {lesson.documents.map((document) => {
                  const size = formatFileSize(document.sizeBytes);
                  return (
                    <li key={document.id}>
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex min-h-11 items-center gap-3 py-3 text-sm hover:text-imperial-hover"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{document.title}</span>
                          <span className="figures block text-xs text-muted-foreground">
                            {document.fileFormat.toUpperCase()}
                            {size !== null && ` — ${size}`}
                          </span>
                        </span>
                        <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <NotesPanel courseSlug={courseSlug} lessonSlug={lesson.slug} initialNotes={lesson.notes} />

          {lesson.quizId && (
            <section className="grid gap-3">
              {quizOpen ? (
                <QuizPanel quizId={lesson.quizId} />
              ) : (
                <Card className="flex flex-col items-start">
                  <h2 className="font-semibold">Quiz de fin de chapitre</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quelques questions pour vérifier ce qui est acquis. Le score est calculé par le serveur et la
                    correction explique chaque réponse.
                  </p>
                  <Button className="mt-4" variant="outline" size="sm" onClick={() => setQuizOpen(true)}>
                    Ouvrir le quiz
                  </Button>
                </Card>
              )}
            </section>
          )}

          <nav
            className="flex items-center justify-between gap-3 border-t border-border pt-5"
            aria-label="Navigation dans la formation"
          >
            {data.previousLessonSlug ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/academy/${courseSlug}/${data.previousLessonSlug}`}>
                  <ChevronLeft aria-hidden />
                  Leçon précédente
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {data.nextLessonSlug ? (
              <Button size="sm" asChild>
                <Link href={`/academy/${courseSlug}/${data.nextLessonSlug}`}>
                  Leçon suivante
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        </div>

        <Programme
          courseSlug={courseSlug}
          chapters={data.chapters}
          lessonSlug={lesson.slug}
          percent={percent}
          completed={data.progress.completedLessons}
          total={data.progress.totalLessons}
        />
      </div>
    </div>
  );
}

/**
 * Programme de la formation : avancement en tête, puis chapitres et leçons.
 *
 * Collant sur grand écran, avec son propre défilement. Sans hauteur maximale, un programme
 * de trente leçons dépasse l'écran, et sa partie basse devient inatteignable une fois le
 * bloc collé.
 *
 * La leçon en cours porte un filet vertical et un fond, pas seulement une graisse : sur une
 * liste longue, un titre en gras se repère mal. Une leçon verrouillée reste visible — savoir
 * ce qu'on n'a pas encore ouvert fait partie du programme — mais ne mène nulle part.
 */
function Programme({
  courseSlug,
  chapters,
  lessonSlug,
  percent,
  completed,
  total,
}: {
  courseSlug: string;
  chapters: LessonResponse['chapters'];
  lessonSlug: string;
  percent: number;
  completed: number;
  total: number;
}) {
  return (
    <aside className="lg:sticky lg:top-6">
      <Card className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="font-display font-bold">Programme</h2>
          <Progress className="mt-3" value={percent} aria-label={`Avancement : ${percent} %`} />
          <p className="figures mt-2 text-xs text-muted-foreground">
            {completed} leçon{completed > 1 ? 's' : ''} sur {total} — {percent} %
          </p>
        </div>

        <div className="lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto">
          {chapters.map((chapter) => (
            <section key={chapter.id}>
              <p className="sticky top-0 border-b border-border bg-surface-muted px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {chapter.title}
              </p>
              <ul className="divide-y divide-border">
                {chapter.lessons.map((item) => {
                  const courante = item.slug === lessonSlug;
                  const contenu = (
                    <span
                      className={`flex min-h-11 items-center gap-3 border-l-2 px-4 py-3 text-left ${
                        courante ? 'border-imperial bg-imperial-soft/50' : 'border-transparent'
                      }`}
                    >
                      <span className="shrink-0 text-muted-foreground">
                        {item.locked ? (
                          <Lock className="size-4" aria-hidden />
                        ) : item.status === 'COMPLETED' ? (
                          <CheckCircle2 className="size-4 text-success" aria-hidden />
                        ) : (
                          <PlayCircle className="size-4" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm leading-snug ${courante ? 'font-semibold' : ''}`}>
                          {item.title}
                        </span>
                        <span className="figures block text-xs text-muted-foreground">
                          {formatDuration(item.durationMinutes)}
                          {courante && ' — en cours'}
                        </span>
                      </span>
                    </span>
                  );

                  return (
                    <li key={item.id}>
                      {item.locked ? (
                        <span className="flex opacity-60" aria-disabled="true">
                          {contenu}
                        </span>
                      ) : (
                        <Link
                          href={`/academy/${courseSlug}/${item.slug}`}
                          aria-current={courante ? 'page' : undefined}
                          className="flex hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
                        >
                          {contenu}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </Card>
    </aside>
  );
}

/**
 * Lecteur vidéo. Reprise à `watchedSeconds`, position renvoyée au serveur par paliers.
 * Sans URL de lecture, l'écran affiche la raison donnée par le serveur : on ne laisse pas
 * un cadre noir sans explication.
 */
function Player({
  lesson,
  onProgress,
}: {
  lesson: LessonResponse['lesson'];
  onProgress: (watchedSeconds: number, completed?: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(lesson.watchedSeconds);

  useEffect(() => {
    const element = video.current;
    if (!element || lesson.watchedSeconds <= 0) return;

    // La reprise se place une fois les métadonnées connues : avant, `currentTime` est ignoré.
    function resume() {
      if (element && element.currentTime < lesson.watchedSeconds) {
        element.currentTime = lesson.watchedSeconds;
      }
    }

    if (element.readyState >= 1) resume();
    else element.addEventListener('loadedmetadata', resume, { once: true });

    return () => element.removeEventListener('loadedmetadata', resume);
  }, [lesson.watchedSeconds, lesson.playbackUrl]);

  if (!lesson.playbackUrl) {
    return (
      <Card className="flex flex-col items-start">
        <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
          <VideoOff className="size-5" aria-hidden />
        </span>
        <h2 className="font-semibold">Pas de vidéo pour cette leçon</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lesson.playbackUnavailableReason ??
            'La vidéo de cette leçon n’est pas disponible pour le moment.'}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <video
        ref={video}
        controls
        playsInline
        preload="metadata"
        src={lesson.playbackUrl}
        className="aspect-16/9 w-full rounded-lg bg-night"
        onTimeUpdate={(event) => {
          const seconds = Math.floor(event.currentTarget.currentTime);
          if (seconds - lastSaved.current >= PROGRESS_INTERVAL_SECONDS) {
            lastSaved.current = seconds;
            onProgress(seconds);
          }
        }}
        onEnded={(event) => {
          const seconds = Math.floor(event.currentTarget.duration || event.currentTarget.currentTime);
          lastSaved.current = seconds;
          onProgress(seconds, true);
        }}
      >
        Votre navigateur ne sait pas lire cette vidéo.
      </video>
    </Card>
  );
}

/** Notes personnelles (ACA-04). Enregistrées sur demande, jamais à chaque frappe. */
function NotesPanel({
  courseSlug,
  lessonSlug,
  initialNotes,
}: {
  courseSlug: string;
  lessonSlug: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? '');
  const save = useSaveNotes(courseSlug, lessonSlug);
  const changed = notes !== (initialNotes ?? '') || save.isSuccess;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
          <NotebookPen className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Vos notes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visibles de vous seul. Vider le champ efface la note.
          </p>
        </div>
      </div>

      <label className="mt-3 grid gap-1 text-sm">
        <span className="sr-only">Notes personnelles de cette leçon</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={5_000}
          rows={5}
          placeholder="Ce que vous voulez retenir, un prix relevé, une question à poser au fournisseur…"
          className="w-full rounded-md border border-border bg-surface p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-imperial"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" loading={save.isPending} disabled={!changed} onClick={() => save.mutate(notes)}>
          Enregistrer
        </Button>
        <span className="figures text-xs text-muted-foreground">{notes.length} / 5 000</span>
        {save.isSuccess && (
          <span className="text-xs text-success">
            {save.data.notes === null ? 'Note effacée.' : 'Note enregistrée.'}
          </span>
        )}
        {save.isError && (
          <span className="text-xs text-danger">
            {save.error instanceof Error ? save.error.message : 'La note n’a pas pu être enregistrée.'}
          </span>
        )}
      </div>
    </Card>
  );
}

function LessonSkeleton() {
  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="aspect-16/9 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
