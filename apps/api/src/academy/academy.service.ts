import { ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COURSE_ACCESS_LABELS,
  COURSE_LEVEL_LABELS,
  COURSE_THEME_LABELS,
  ENROLLMENT_SOURCE_LABELS,
  RESOURCE_TYPE_LABELS,
  courseProgressPercent,
  formatDuration,
  quizScorePercent,
  type AcademyCourseListResponse,
  type AcademyCourseQuery,
  type Chapter,
  type CourseCard,
  type CourseDetailResponse,
  type CourseProgress,
  type CourseRating,
  type GrantEnrollmentRequest,
  type GrantEnrollmentResponse,
  type LessonNotesResponse,
  type LessonProgressRequest,
  type LessonProgressResponse,
  type LessonResponse,
  type LessonSummary,
  type QuizAttemptRequest,
  type QuizResponse,
  type QuizResultResponse,
  type ResourceCard,
  type ResourceDownloadResponse,
  type ResourceListResponse,
  type ResourceQuery,
} from '@ws/contracts';
import type { Env } from '../config/env.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { priceWithoutPromotion, type Priced } from '@ws/contracts';
import { PromotionsService } from '../billing/promotions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { courseAccess, lessonAccess, resourceAccess, type AccessDecision } from './access.js';
import type { AcademyVisitor } from './academy-session.js';
import { AcademyMedia, MEDIA_LINK_TTL_MS } from './media.js';

/** Le visiteur, tel que le service le reçoit : un compte connecté, ou personne. */
type Visitor = AcademyVisitor | null;

/** Nombre d'avis servis sur une fiche : les plus récents d'abord. */
const REVIEWS_SHOWN = 20;

/** Anti-spam de la relance « course-progress » : au plus un email par jour et par compte. */
const PROGRESS_EMAIL_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Filtre « publié » commun aux formations, aux leçons et aux ressources. */
const PUBLISHED: { publishedAt: { not: null } } = { publishedAt: { not: null } };

/** Arbre complet d'une formation publiée : chapitres, leçons publiées, quiz, documents. */
const COURSE_TREE = {
  instructor: true,
  chapters: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    include: {
      lessons: {
        where: PUBLISHED,
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { documents: true } } },
      },
      quiz: { select: { id: true, _count: { select: { questions: true } } } },
    },
  },
} satisfies Prisma.CourseInclude;

type CourseTreeRow = Prisma.CourseGetPayload<{ include: typeof COURSE_TREE }>;
type TreeLesson = CourseTreeRow['chapters'][number]['lessons'][number];

/** Avancement d'une leçon, tel qu'il sert à construire une réponse. */
type ProgressRow = { lessonId: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; watchedSeconds: number; updatedAt: Date };

/**
 * Academy (lot ACA, §26) : catalogue, fiches, lecteur de leçon, quiz, progression et bibliothèque.
 *
 * Deux règles tiennent tout le module :
 *   1. le droit d'accès est décidé ici, jamais par le client (`access.ts`) ;
 *   2. aucun chiffre n'est inventé : sans avis, la note vaut `null` et le compte vaut 0 ;
 *      sans vidéo ou sans hébergement configuré, l'URL de lecture vaut `null` et la raison
 *      est écrite en français.
 */
@Injectable()
export class AcademyService {
  private readonly logger = new Logger(AcademyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: AcademyMedia,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
    private readonly promotions: PromotionsService,
  ) {}

  // ───────────────────────── Catalogue (ACA-03) ─────────────────────────

  /** Catalogue paginé, filtrable par niveau, thème et condition d'accès. */
  async listCourses(query: AcademyCourseQuery, visitor: Visitor): Promise<AcademyCourseListResponse> {
    const where: Prisma.CourseWhereInput = {
      ...PUBLISHED,
      ...(query.level ? { level: query.level } : {}),
      ...(query.theme ? { theme: query.theme } : {}),
      ...(query.access ? { access: query.access } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { summary: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const total = await this.prisma.course.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / query.perPage));
    const page = Math.min(query.page, totalPages);

    const rows = await this.prisma.course.findMany({
      where,
      include: {
        instructor: true,
        lessons: {
          where: PUBLISHED,
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: { id: true, slug: true, title: true, durationMinutes: true },
        },
      },
      // Les plus récentes d'abord, puis l'identifiant : deux appels identiques rendent la même page.
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * query.perPage,
      take: query.perPage,
    });

    const courseIds = rows.map((row) => row.id);
    const ratings = await this.ratings(courseIds);
    const enrolled = await this.enrolledCourseIds(visitor, courseIds);
    const progress = await this.progressRows(visitor, courseIds);

    // Les compteurs de niveaux et de thèmes portent sur tout le catalogue publié, pas sur la
    // page courante : ils servent à savoir ce qui existe, pas à décrire le résultat affiché.
    // Les prix remisés de toute la page, en une fois : une résolution par formation
    // aurait multiplié les requêtes sur l'écran le plus consulté.
    const prix = await this.promotions.pricesForCourses(
      rows.map((row) => ({ id: row.id, priceXaf: row.priceXaf, theme: row.theme })),
      visitor?.id ?? null,
    );

    const [byLevel, byTheme] = await Promise.all([
      this.prisma.course.groupBy({ by: ['level'], where: PUBLISHED, _count: { _all: true } }),
      this.prisma.course.groupBy({ by: ['theme'], where: PUBLISHED, _count: { _all: true } }),
    ]);

    return {
      page,
      perPage: query.perPage,
      total,
      totalPages,
      items: rows.map((row) =>
        this.buildCard(
          row,
          row.lessons,
          ratings.get(row.id),
          enrolled.has(row.id),
          progress,
          prix.get(row.id) ?? priceWithoutPromotion(row.priceXaf),
        ),
      ),
      levels: byLevel.map((group) => ({
        level: group.level,
        label: COURSE_LEVEL_LABELS[group.level].label,
        count: group._count._all,
      })),
      themes: byTheme.map((group) => ({
        theme: group.theme,
        label: COURSE_THEME_LABELS[group.theme],
        count: group._count._all,
      })),
      resume: await this.resume(visitor),
    };
  }

  /** Fiche d'une formation : programme, formateur, avis, ressources, et pourquoi c'est fermé. */
  async course(slug: string, visitor: Visitor): Promise<CourseDetailResponse> {
    const row = await this.courseTree(slug);
    const lessons = flatten(row);

    const enrolled = visitor ? await this.isEnrolled(visitor.id, row.id) : false;
    const decision = courseAccess({
      access: row.access,
      signedIn: visitor !== null,
      enrolled,
      academyIncluded: visitor?.academyIncluded ?? false,
    });
    const progressRows = await this.progressRows(visitor, [row.id]);

    const [rating, resources, reviews] = await Promise.all([
      this.rating(row.id),
      this.prisma.libraryResource.findMany({
        where: { courseId: row.id, ...PUBLISHED },
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.courseReview.findMany({
        where: { courseId: row.id },
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        take: REVIEWS_SHOWN,
      }),
    ]);

    const prix = await this.promotions.priceFor(
      row.priceXaf,
      { kind: 'COURSE', id: row.id, theme: row.theme },
      visitor?.id ?? null,
    );
    const card = this.buildCard(row, lessons, rating, enrolled, progressRows, prix);

    return {
      course: {
        ...card,
        description: row.description,
        outcomes: row.outcomes,
        prerequisites: row.prerequisites,
        instructor: {
          name: row.instructor.name,
          headline: row.instructor.headline,
          bio: row.instructor.bio,
          photoUrl: row.instructor.photoUrl,
        },
        trailerUrl: row.trailerUrl,
        chapters: this.buildChapters(row, decision, progressRows),
        resources: resources.map((resource) =>
          this.buildResourceCard(resource, { slug: row.slug, title: row.title }, resourceAccess({
            free: resource.free,
            course: { access: row.access },
            signedIn: visitor !== null,
            enrolled,
            academyIncluded: visitor?.academyIncluded ?? false,
          })),
        ),
        reviews: reviews.map((review) => ({
          id: review.id,
          authorName: review.authorName,
          rating: review.rating,
          comment: review.comment,
          publishedAt: review.publishedAt.toISOString(),
        })),
        lockReason: decision.reason,
        lockMessage: decision.message,
      },
    };
  }

  // ───────────────────────── Lecteur de leçon (ACA-02) ─────────────────────────

  /**
   * Leçon et son URL de lecture.
   *
   * L'URL n'est signée qu'après vérification du droit : une leçon payante sans droit
   * renvoie un refus, pas une réponse sans URL. La reprise se fait à `watchedSeconds`.
   */
  async lesson(courseSlug: string, lessonSlug: string, visitor: Visitor): Promise<LessonResponse> {
    const row = await this.courseTree(courseSlug);
    const located = locate(row, lessonSlug);
    if (!located) throw new NotFoundException('Cette leçon n’existe pas ou n’est pas encore publiée.');

    const { chapter, lesson } = located;
    const enrolled = visitor ? await this.isEnrolled(visitor.id, row.id) : false;
    const incluse = row.access === 'SUBSCRIPTION' && (visitor?.academyIncluded ?? false);
    const decision = lessonAccess({
      access: row.access,
      signedIn: visitor !== null,
      enrolled,
      preview: lesson.preview,
      academyIncluded: visitor?.academyIncluded ?? false,
    });
    if (!decision.allowed) throw new ForbiddenException({ message: decision.message, code: 'lesson_locked' });

    // Une formation ouverte par son droit — gratuite, ou incluse dans l'abonnement en cours —
    // crée son inscription à la première ouverture : c'est elle qui porte ensuite la
    // progression et la reprise de lecture. L'origine enregistrée dit laquelle des deux.
    const ouvrable = visitor !== null && !enrolled && (row.access === 'FREE' || incluse);
    const inscrit = enrolled || ouvrable;
    if (visitor && ouvrable) {
      await this.enroll(visitor.id, row.id, row.access === 'FREE' ? 'FREE_COURSE' : 'SUBSCRIPTION');
    }

    const progressRows = await this.progressRows(visitor, [row.id]);
    const mine = progressRows.find((entry) => entry.lessonId === lesson.id) ?? null;

    const [documents, notes] = await Promise.all([
      this.prisma.lessonDocument.findMany({
        where: { lessonId: lesson.id },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
      visitor
        ? this.prisma.lessonNote.findUnique({ where: { userId_lessonId: { userId: visitor.id, lessonId: lesson.id } } })
        : null,
    ]);

    const playback = this.playback(lesson);
    const lessons = flatten(row);
    const index = lessons.findIndex((candidate) => candidate.id === lesson.id);

    return {
      courseSlug: row.slug,
      courseTitle: row.title,
      chapterTitle: chapter.title,
      lesson: {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        durationMinutes: lesson.durationMinutes,
        playbackUrl: playback.url,
        playbackUnavailableReason: playback.reason,
        documents: documents.map((document) => ({
          id: document.id,
          title: document.title,
          fileFormat: document.fileFormat,
          sizeBytes: document.sizeBytes,
          url: document.url,
        })),
        watchedSeconds: mine?.watchedSeconds ?? 0,
        status: mine?.status ?? 'NOT_STARTED',
        notes: notes?.notes ?? null,
        quizId: chapter.quiz?.id ?? null,
      },
      // Le sommaire montre ce que ce compte peut réellement ouvrir : arriver par un extrait
      // ne déverrouille pas le reste du programme.
      chapters: this.buildChapters(
        row,
        courseAccess({
          access: row.access,
          signedIn: visitor !== null,
          enrolled: inscrit,
          academyIncluded: visitor?.academyIncluded ?? false,
        }),
        progressRows,
      ),
      progress: buildProgress(lessons, progressRows),
      previousLessonSlug: index > 0 ? lessons[index - 1].slug : null,
      nextLessonSlug: index >= 0 && index < lessons.length - 1 ? lessons[index + 1].slug : null,
    };
  }

  /** Enregistre la position de lecture et, le cas échéant, l'achèvement de la leçon (ACA-04). */
  async saveProgress(
    courseSlug: string,
    lessonSlug: string,
    body: LessonProgressRequest,
    visitor: AcademyVisitor,
  ): Promise<LessonProgressResponse> {
    const { course, lesson } = await this.openLesson(courseSlug, lessonSlug, visitor);

    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: visitor.id, lessonId: lesson.id } },
    });

    // La position ne recule jamais : un lecteur rouvert au début ne doit pas effacer la reprise.
    const watchedSeconds = Math.max(existing?.watchedSeconds ?? 0, body.watchedSeconds);
    const completed = body.completed || existing?.status === 'COMPLETED';
    const status = completed ? 'COMPLETED' : watchedSeconds > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
    const justCompleted = body.completed && existing?.status !== 'COMPLETED';

    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: visitor.id, lessonId: lesson.id } },
      create: {
        userId: visitor.id,
        lessonId: lesson.id,
        courseId: course.id,
        status,
        watchedSeconds,
        completedAt: completed ? new Date() : null,
      },
      update: {
        status,
        watchedSeconds,
        completedAt: completed ? (existing?.completedAt ?? new Date()) : null,
      },
    });

    const lessons = flatten(course);
    const progressRows = await this.progressRows(visitor, [course.id]);
    const progress = buildProgress(lessons, progressRows);
    const courseCompleted = justCompleted && progress.percent === 100;

    if (justCompleted && !courseCompleted) {
      void this.notifyProgress(course, progress, visitor);
    }

    return { status, watchedSeconds, progress, courseCompleted };
  }

  /** Notes personnelles d'une leçon. Un champ vidé efface la note (ACA-04). */
  async saveNotes(
    courseSlug: string,
    lessonSlug: string,
    notes: string,
    visitor: AcademyVisitor,
  ): Promise<LessonNotesResponse> {
    const { lesson } = await this.openLesson(courseSlug, lessonSlug, visitor);
    const key = { userId_lessonId: { userId: visitor.id, lessonId: lesson.id } };
    const trimmed = notes.trim();

    if (!trimmed) {
      await this.prisma.lessonNote.deleteMany({ where: { userId: visitor.id, lessonId: lesson.id } });
      return { notes: null, savedAt: new Date().toISOString() };
    }

    const saved = await this.prisma.lessonNote.upsert({
      where: key,
      create: { userId: visitor.id, lessonId: lesson.id, notes: trimmed },
      update: { notes: trimmed },
    });

    return { notes: saved.notes, savedAt: saved.updatedAt.toISOString() };
  }

  // ───────────────────────── Quiz (ACA-04) ─────────────────────────

  /** Questions d'un quiz. Les bonnes réponses ne sortent jamais d'ici. */
  async quiz(quizId: string, visitor: AcademyVisitor): Promise<QuizResponse> {
    const quiz = await this.loadQuiz(quizId, visitor);

    const lastAttempt = await this.prisma.quizAttempt.findFirst({
      where: { quizId: quiz.id, userId: visitor.id },
      orderBy: { takenAt: 'desc' },
    });

    return {
      id: quiz.id,
      title: quiz.title,
      courseSlug: quiz.chapter.course.slug,
      chapterTitle: quiz.chapter.title,
      passScorePercent: quiz.passScorePercent,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        position: question.position,
        choices: question.choices.map((choice) => ({ id: choice.id, label: choice.label })),
      })),
      lastAttempt: lastAttempt
        ? {
            scorePercent: lastAttempt.scorePercent,
            passed: lastAttempt.passed,
            takenAt: lastAttempt.takenAt.toISOString(),
          }
        : null,
    };
  }

  /** Correction d'un quiz. Le score est calculé côté serveur, question par question. */
  async submitQuiz(quizId: string, body: QuizAttemptRequest, visitor: AcademyVisitor): Promise<QuizResultResponse> {
    const quiz = await this.loadQuiz(quizId, visitor);

    const chosen = new Map(body.answers.map((answer) => [answer.questionId, answer.choiceId]));
    let correctCount = 0;

    const corrections = quiz.questions.map((question) => {
      const expected = question.choices.find((choice) => choice.correct);
      if (!expected) {
        // Une question sans bonne réponse est une erreur de saisie : on ne la compte pas juste.
        this.logger.warn(`Question ${question.id} sans bonne réponse enregistrée.`);
      }
      const chosenChoiceId = chosen.get(question.id) ?? null;
      const correct = expected !== undefined && chosenChoiceId === expected.id;
      if (correct) correctCount += 1;

      return {
        questionId: question.id,
        prompt: question.prompt,
        correct,
        chosenChoiceId,
        correctChoiceId: expected?.id ?? '',
        correctChoiceLabel: expected?.label ?? 'Réponse non renseignée',
        explanation: question.explanation,
      };
    });

    const questionCount = quiz.questions.length;
    const scorePercent = quizScorePercent(correctCount, questionCount);
    const passed = scorePercent >= quiz.passScorePercent;

    await this.prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId: visitor.id, scorePercent, correctCount, questionCount, passed },
    });

    return {
      scorePercent,
      correctCount,
      questionCount,
      passed,
      passScorePercent: quiz.passScorePercent,
      corrections,
    };
  }

  // ───────────────────────── Bibliothèque (ACA-05) ─────────────────────────

  /** Bibliothèque paginée : recherche libre, filtres par nature et par thème. */
  async listResources(query: ResourceQuery, visitor: Visitor): Promise<ResourceListResponse> {
    const where: Prisma.LibraryResourceWhereInput = {
      ...PUBLISHED,
      ...(query.type ? { type: query.type } : {}),
      ...(query.theme ? { theme: query.theme } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const total = await this.prisma.libraryResource.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / query.perPage));
    const page = Math.min(query.page, totalPages);

    const rows = await this.prisma.libraryResource.findMany({
      where,
      include: { course: { select: { id: true, slug: true, title: true, access: true } } },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * query.perPage,
      take: query.perPage,
    });

    const courseIds = rows.map((row) => row.course?.id).filter((id): id is string => id !== undefined);
    const enrolled = await this.enrolledCourseIds(visitor, courseIds);

    const [byType, byTheme] = await Promise.all([
      this.prisma.libraryResource.groupBy({ by: ['type'], where: PUBLISHED, _count: { _all: true } }),
      this.prisma.libraryResource.groupBy({ by: ['theme'], where: PUBLISHED, _count: { _all: true } }),
    ]);

    return {
      page,
      perPage: query.perPage,
      total,
      totalPages,
      items: rows.map((row) =>
        this.buildResourceCard(
          row,
          row.course ? { slug: row.course.slug, title: row.course.title } : null,
          resourceAccess({
            free: row.free,
            course: row.course ? { access: row.course.access } : null,
            signedIn: visitor !== null,
            enrolled: row.course ? enrolled.has(row.course.id) : false,
            academyIncluded: visitor?.academyIncluded ?? false,
          }),
        ),
      ),
      types: byType.map((group) => ({
        type: group.type,
        label: RESOURCE_TYPE_LABELS[group.type],
        count: group._count._all,
      })),
      themes: byTheme.map((group) => ({
        theme: group.theme,
        label: COURSE_THEME_LABELS[group.theme],
        count: group._count._all,
      })),
    };
  }

  /** Lien de téléchargement d'une ressource. Le droit est vérifié avant toute signature. */
  async downloadResource(slug: string, visitor: Visitor): Promise<ResourceDownloadResponse> {
    const row = await this.prisma.libraryResource.findFirst({
      where: { slug, ...PUBLISHED },
      include: { course: { select: { id: true, access: true } } },
    });
    if (!row) throw new NotFoundException('Cette ressource n’existe pas ou n’est pas encore publiée.');

    const enrolled = visitor && row.course ? await this.isEnrolled(visitor.id, row.course.id) : false;
    const decision = resourceAccess({
      free: row.free,
      course: row.course ? { access: row.course.access } : null,
      signedIn: visitor !== null,
      enrolled,
      academyIncluded: visitor?.academyIncluded ?? false,
    });
    if (!decision.allowed) throw new ForbiddenException({ message: decision.message, code: 'resource_locked' });

    if (row.filePublicId) {
      const signed = this.media.fileUrl(row.filePublicId, row.fileFormat);
      if (!signed) {
        throw new ServiceUnavailableException({
          message: 'Le téléchargement n’est pas disponible pour le moment : l’hébergement des fichiers n’est pas configuré.',
          code: 'storage_unavailable',
        });
      }
      return { url: signed.url, fileFormat: row.fileFormat, expiresAt: signed.expiresAt.toISOString() };
    }

    if (row.fileUrl) {
      // Fichier déjà public : il n'y a rien à signer. La date dit jusqu'à quand cette réponse
      // reste valable, après quoi le client la redemande.
      return {
        url: row.fileUrl,
        fileFormat: row.fileFormat,
        expiresAt: new Date(Date.now() + MEDIA_LINK_TTL_MS).toISOString(),
      };
    }

    throw new NotFoundException('Le fichier de cette ressource n’a pas encore été déposé.');
  }

  // ───────────────────────── Inscriptions (ACA-01) ─────────────────────────

  /**
   * Ouverture d'un accès par l'équipe, en attendant que les lots PAY et SUB prennent
   * le relais. Idempotent : rappeler la route ne crée pas de doublon.
   */
  async grantEnrollment(body: GrantEnrollmentRequest): Promise<GrantEnrollmentResponse> {
    const course = await this.prisma.course.findUnique({ where: { slug: body.courseSlug }, select: { id: true } });
    if (!course) throw new NotFoundException('Cette formation n’existe pas.');

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: body.userId, courseId: course.id } },
    });
    const enrollment = existing ?? (await this.enroll(body.userId, course.id, body.source));

    return {
      userId: body.userId,
      courseSlug: body.courseSlug,
      source: enrollment.source,
      sourceLabel: ENROLLMENT_SOURCE_LABELS[enrollment.source],
      enrolledAt: enrollment.enrolledAt.toISOString(),
      alreadyEnrolled: existing !== null,
    };
  }

  // ───────────────────────── Construction des réponses ─────────────────────────

  private buildCard(
    row: {
      id: string;
      slug: string;
      title: string;
      summary: string;
      level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
      theme: keyof typeof COURSE_THEME_LABELS;
      access: 'FREE' | 'PAID' | 'SUBSCRIPTION';
      priceXaf: number;
      coverUrl: string | null;
      publishedAt: Date | null;
      instructor: { name: string };
    },
    lessons: { id: string; slug: string; title: string; durationMinutes: number }[],
    rating: CourseRating | undefined,
    enrolled: boolean,
    progressRows: ProgressRow[],
    /** Prix remisé, résolu en amont pour tout le lot : voir `pricesForCourses`. */
    priced: Priced,
  ): CourseCard {
    const mine = progressRows.filter((entry) => lessons.some((lesson) => lesson.id === entry.lessonId));

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      level: row.level,
      levelLabel: COURSE_LEVEL_LABELS[row.level].label,
      theme: row.theme,
      themeLabel: COURSE_THEME_LABELS[row.theme],
      access: row.access,
      accessLabel: COURSE_ACCESS_LABELS[row.access],
      priceXaf: row.priceXaf,
      priced,
      durationMinutes: lessons.reduce((total, lesson) => total + lesson.durationMinutes, 0),
      lessonCount: lessons.length,
      coverUrl: row.coverUrl,
      instructorName: row.instructor.name,
      // Sans avis : 0 et `null`. Jamais de note par défaut (§54).
      rating: rating ?? { average: null, count: 0 },
      publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
      enrolled,
      progress: enrolled ? buildProgress(lessons, mine) : null,
    };
  }

  private buildChapters(row: CourseTreeRow, decision: AccessDecision, progressRows: ProgressRow[]): Chapter[] {
    const byLesson = new Map(progressRows.map((entry) => [entry.lessonId, entry]));

    return row.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      position: chapter.position,
      lessons: chapter.lessons.map((lesson): LessonSummary => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        position: lesson.position,
        durationMinutes: lesson.durationMinutes,
        hasVideo: lesson.videoPublicId !== null,
        documentCount: lesson._count.documents,
        preview: lesson.preview,
        locked: !lesson.preview && !decision.allowed,
        status: byLesson.get(lesson.id)?.status ?? 'NOT_STARTED',
      })),
      quizId: chapter.quiz?.id ?? null,
      quizQuestionCount: chapter.quiz?._count.questions ?? 0,
    }));
  }

  private buildResourceCard(
    row: {
      id: string;
      slug: string;
      title: string;
      description: string;
      type: keyof typeof RESOURCE_TYPE_LABELS;
      theme: keyof typeof COURSE_THEME_LABELS;
      fileFormat: string;
      sizeBytes: number | null;
      pageCount: number | null;
      filePublicId: string | null;
      fileUrl: string | null;
      free: boolean;
      publishedAt: Date | null;
    },
    course: { slug: string; title: string } | null,
    decision: AccessDecision,
  ): ResourceCard {
    const hasFile = row.filePublicId !== null || row.fileUrl !== null;
    const storageReady = row.filePublicId === null || this.media.enabled;

    const lockedReason = !decision.allowed
      ? decision.message
      : !hasFile
        ? 'Le fichier n’a pas encore été déposé.'
        : !storageReady
          ? 'Le téléchargement n’est pas disponible : l’hébergement des fichiers n’est pas configuré.'
          : null;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      type: row.type,
      typeLabel: RESOURCE_TYPE_LABELS[row.type],
      theme: row.theme,
      themeLabel: COURSE_THEME_LABELS[row.theme],
      fileFormat: row.fileFormat,
      sizeBytes: row.sizeBytes,
      pageCount: row.pageCount,
      courseSlug: course?.slug ?? null,
      courseTitle: course?.title ?? null,
      free: row.free,
      downloadable: lockedReason === null,
      lockedReason,
      publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
    };
  }

  /** URL de lecture, ou l'explication de son absence. Jamais de chaîne vide ni d'URL fausse. */
  private playback(lesson: { videoPublicId: string | null; videoFormat: string | null }): {
    url: string | null;
    reason: string | null;
  } {
    if (!lesson.videoPublicId) {
      return { url: null, reason: 'Aucune vidéo n’est encore déposée pour cette leçon.' };
    }

    const signed = this.media.videoUrl(lesson.videoPublicId, lesson.videoFormat ?? 'mp4');
    if (!signed) {
      return {
        url: null,
        reason: 'La lecture vidéo n’est pas disponible pour le moment : l’hébergement n’est pas configuré.',
      };
    }

    return { url: signed.url, reason: null };
  }

  // ───────────────────────── Accès aux données ─────────────────────────

  private async courseTree(slug: string): Promise<CourseTreeRow> {
    const row = await this.prisma.course.findFirst({ where: { slug, ...PUBLISHED }, include: COURSE_TREE });
    if (!row) throw new NotFoundException('Cette formation n’existe pas ou n’est pas encore publiée.');
    return row;
  }

  /**
   * Charge une leçon après avoir vérifié le droit d'accès du compte.
   * Partagé par la progression et les notes : impossible d'écrire sur une leçon fermée.
   */
  private async openLesson(
    courseSlug: string,
    lessonSlug: string,
    visitor: AcademyVisitor,
  ): Promise<{ course: CourseTreeRow; lesson: TreeLesson }> {
    const course = await this.courseTree(courseSlug);
    const located = locate(course, lessonSlug);
    if (!located) throw new NotFoundException('Cette leçon n’existe pas ou n’est pas encore publiée.');

    const enrolled = await this.isEnrolled(visitor.id, course.id);
    const decision = lessonAccess({
      access: course.access,
      signedIn: true,
      enrolled,
      preview: located.lesson.preview,
      academyIncluded: visitor.academyIncluded,
    });
    if (!decision.allowed) throw new ForbiddenException({ message: decision.message, code: 'lesson_locked' });

    const incluse = course.access === 'SUBSCRIPTION' && visitor.academyIncluded;
    if (!enrolled && (course.access === 'FREE' || incluse)) {
      await this.enroll(visitor.id, course.id, course.access === 'FREE' ? 'FREE_COURSE' : 'SUBSCRIPTION');
    }

    return { course, lesson: located.lesson };
  }

  private async loadQuiz(quizId: string, visitor: AcademyVisitor) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        chapter: { include: { course: { select: { id: true, slug: true, access: true, publishedAt: true } } } },
        questions: {
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          include: { choices: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
        },
      },
    });
    if (!quiz || quiz.chapter.course.publishedAt === null) {
      throw new NotFoundException('Ce quiz n’existe pas ou n’est pas encore publié.');
    }

    const enrolled = await this.isEnrolled(visitor.id, quiz.chapter.course.id);
    const decision = courseAccess({
      access: quiz.chapter.course.access,
      signedIn: true,
      enrolled,
      academyIncluded: visitor.academyIncluded,
    });
    if (!decision.allowed) throw new ForbiddenException({ message: decision.message, code: 'quiz_locked' });

    return quiz;
  }

  private async enroll(userId: string, courseId: string, source: 'FREE_COURSE' | 'PURCHASE' | 'SUBSCRIPTION' | 'GRANTED') {
    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, source },
      update: {},
    });
  }

  private async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const found = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    return found !== null;
  }

  private async enrolledCourseIds(visitor: Visitor, courseIds: string[]): Promise<Set<string>> {
    if (!visitor || courseIds.length === 0) return new Set();
    const rows = await this.prisma.enrollment.findMany({
      where: { userId: visitor.id, courseId: { in: courseIds } },
      select: { courseId: true },
    });
    return new Set(rows.map((row) => row.courseId));
  }

  private async progressRows(visitor: Visitor, courseIds: string[]): Promise<ProgressRow[]> {
    if (!visitor || courseIds.length === 0) return [];
    return this.prisma.lessonProgress.findMany({
      where: { userId: visitor.id, courseId: { in: courseIds } },
      select: { lessonId: true, status: true, watchedSeconds: true, updatedAt: true },
    });
  }

  /** Note moyenne et nombre d'avis de plusieurs formations, en une requête. */
  private async ratings(courseIds: string[]): Promise<Map<string, CourseRating>> {
    if (courseIds.length === 0) return new Map();
    const groups = await this.prisma.courseReview.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return new Map(
      groups.map((group) => [
        group.courseId,
        {
          average: group._avg.rating === null ? null : Math.round(group._avg.rating * 10) / 10,
          count: group._count._all,
        },
      ]),
    );
  }

  private async rating(courseId: string): Promise<CourseRating> {
    return (await this.ratings([courseId])).get(courseId) ?? { average: null, count: 0 };
  }

  /** Dernière leçon travaillée, toutes formations confondues (§26 : « reprendre »). */
  private async resume(visitor: Visitor): Promise<AcademyCourseListResponse['resume']> {
    if (!visitor) return null;

    const last = await this.prisma.lessonProgress.findFirst({
      where: { userId: visitor.id, lesson: PUBLISHED, course: PUBLISHED },
      orderBy: { updatedAt: 'desc' },
      include: {
        lesson: { select: { slug: true, title: true } },
        course: { select: { id: true, slug: true, title: true } },
      },
    });
    if (!last) return null;

    const [totalLessons, completedLessons] = await Promise.all([
      this.prisma.lesson.count({ where: { courseId: last.course.id, ...PUBLISHED } }),
      this.prisma.lessonProgress.count({
        where: { userId: visitor.id, courseId: last.course.id, status: 'COMPLETED', lesson: PUBLISHED },
      }),
    ]);

    return {
      courseSlug: last.course.slug,
      courseTitle: last.course.title,
      lessonSlug: last.lesson.slug,
      lessonTitle: last.lesson.title,
      percent: courseProgressPercent(completedLessons, totalLessons),
      lastActivityAt: last.updatedAt.toISOString(),
    };
  }

  /**
   * Relance « course-progress » (ACA-04). Jamais bloquante : un échec d'envoi se journalise,
   * la progression reste enregistrée. Au plus un email par jour et par compte, pour que
   * terminer quatre leçons d'affilée n'envoie pas quatre emails.
   */
  private async notifyProgress(course: CourseTreeRow, progress: CourseProgress, visitor: AcademyVisitor): Promise<void> {
    try {
      const recent = await this.prisma.emailLog.findFirst({
        where: {
          recipient: visitor.email,
          template: 'course-progress',
          createdAt: { gte: new Date(Date.now() - PROGRESS_EMAIL_INTERVAL_MS) },
        },
        select: { id: true },
      });
      if (recent) return;

      const lessons = flatten(course);
      const next = lessons.find((lesson) => lesson.slug === progress.resumeLessonSlug);
      const appUrl = this.config.get('APP_URL', { infer: true });
      const chapter = course.chapters.find((candidate) =>
        candidate.lessons.some((lesson) => lesson.slug === progress.resumeLessonSlug),
      );

      const documents = await this.prisma.lessonDocument.findMany({
        where: { lesson: { courseId: course.id } },
        select: { title: true },
        take: 5,
      });

      await this.mail.send({
        to: visitor.email,
        template: 'course-progress',
        userId: visitor.id,
        data: {
          firstName: visitor.name,
          courseTitle: course.title,
          progressPercent: progress.percent,
          nextLessonTitle: next?.title ?? 'Prochaine leçon',
          nextLessonDuration: next ? formatDuration(next.durationMinutes) : '—',
          remainingLessons: progress.totalLessons - progress.completedLessons,
          resources: documents.map((document) => document.title),
          hasQuiz: Boolean(chapter?.quiz),
          resumeUrl: progress.resumeLessonSlug
            ? `${appUrl}/academy/${encodeURIComponent(course.slug)}/${encodeURIComponent(progress.resumeLessonSlug)}`
            : `${appUrl}/academy/${encodeURIComponent(course.slug)}`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.warn(`Relance de progression non envoyée pour ${course.slug} : ${message}`);
    }
  }
}

/** Toutes les leçons publiées d'une formation, dans l'ordre de lecture. */
function flatten(course: CourseTreeRow): TreeLesson[] {
  return course.chapters.flatMap((chapter) => chapter.lessons);
}

/** Retrouve une leçon publiée par son identifiant d'URL, avec son chapitre. */
function locate(course: CourseTreeRow, lessonSlug: string) {
  for (const chapter of course.chapters) {
    const lesson = chapter.lessons.find((candidate) => candidate.slug === lessonSlug);
    if (lesson) return { chapter, lesson };
  }
  return null;
}

/**
 * Avancement d'un compte dans une formation.
 * La leçon à reprendre est la première non terminée, dans l'ordre du programme.
 */
function buildProgress(
  lessons: { id: string; slug: string; title: string }[],
  progressRows: ProgressRow[],
): CourseProgress {
  const byLesson = new Map(progressRows.map((entry) => [entry.lessonId, entry]));
  let completedLessons = 0;
  let resume: { slug: string; title: string } | null = null;
  let lastActivityAt: Date | null = null;

  for (const lesson of lessons) {
    const entry = byLesson.get(lesson.id);
    if (entry?.status === 'COMPLETED') completedLessons += 1;
    else if (!resume) resume = { slug: lesson.slug, title: lesson.title };
    if (entry && (lastActivityAt === null || entry.updatedAt > lastActivityAt)) lastActivityAt = entry.updatedAt;
  }

  return {
    completedLessons,
    totalLessons: lessons.length,
    percent: courseProgressPercent(completedLessons, lessons.length),
    resumeLessonSlug: resume?.slug ?? null,
    resumeLessonTitle: resume?.title ?? null,
    lastActivityAt: lastActivityAt?.toISOString() ?? null,
  };
}
