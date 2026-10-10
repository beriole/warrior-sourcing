import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSE_ACCESS_LABELS,
  COURSE_LEVEL_LABELS,
  COURSE_THEME_LABELS,
  RESOURCE_TYPE_LABELS,
  type AdminChapter,
  type AdminCourseDetailResponse,
  type AdminCourseListResponse,
  type AdminCourseResponse,
  type AdminCourseSearchQuery,
  type AdminInstructorListResponse,
  type AdminLesson,
  type AdminResource,
  type AdminResourceListResponse,
  type AdminResourceSearchQuery,
  type CourseAccess,
  type CourseLevel,
  type CourseTheme,
  type CreateChapterRequest,
  type CreateCourseRequest,
  type CreateInstructorRequest,
  type CreateLessonRequest,
  type ResourceType,
  type UpdateChapterRequest,
  type UpdateCourseRequest,
  type LessonDocumentInput,
  type UpdateLessonRequest,
  type UpdatePublicationRequest,
  type UpdateResourceRequest,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

/** Identifiant d'URL dérivé d'un titre. */
function slugifier(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

type LigneLecon = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  position: number;
  durationMinutes: number;
  videoPublicId: string | null;
  preview: boolean;
  publishedAt: Date | null;
  _count: { documents: number };
  documents: { id: string; title: string; fileFormat: string; url: string }[];
};

type LigneChapitre = {
  id: string;
  title: string;
  summary: string | null;
  position: number;
  lessons: LigneLecon[];
};

type LigneFormation = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  level: CourseLevel;
  theme: CourseTheme;
  access: CourseAccess;
  priceXaf: number;
  outcomes: string[];
  prerequisites: string[];
  instructorId: string;
  instructor: { name: string };
  publishedAt: Date | null;
  updatedAt: Date;
  chapters: LigneChapitre[];
  _count: { enrollments: number; reviews: number };
};

/**
 * Formations et bibliothèque vues depuis le back-office (ADM-05, §26).
 *
 * Une formation publiée est lue par quelqu'un qui va y consacrer du temps, parfois de
 * l'argent. La publication exige donc du contenu réel : au moins une leçon publiée, un
 * formateur, une description. Le serveur énumère ce qui manque plutôt que de refuser
 * sèchement — et c'est lui, pas l'écran, qui détient la règle.
 *
 * Le contenu ne disparaît jamais : retirer une formation la rend invisible au catalogue,
 * mais les inscriptions, la progression et les avis restent. Un compte qui a suivi une
 * formation retirée garde son historique.
 */
@Injectable()
export class AdminAcademyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── Formateurs ─────────────────────────

  async listInstructors(): Promise<AdminInstructorListResponse> {
    const rows = await this.prisma.instructor.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { courses: true } } },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        headline: row.headline,
        bio: row.bio,
        photoUrl: row.photoUrl,
        courseCount: row._count.courses,
      })),
    };
  }

  async createInstructor(
    input: CreateInstructorRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminInstructorListResponse> {
    const row = await this.prisma.instructor.create({
      data: {
        name: input.name,
        headline: input.headline,
        bio: input.bio,
        photoUrl: input.photoUrl,
      },
    });
    await this.audit.record({
      actorId: acteur.id,
      action: 'instructor.create',
      entity: 'Instructor',
      entityId: row.id,
      metadata: { name: input.name },
      ipAddress: ip,
    });
    return this.listInstructors();
  }

  // ───────────────────────── Formations ─────────────────────────

  /** Durée annoncée : somme des seules leçons publiées, comme sur le catalogue public. */
  private duree(chapitres: LigneChapitre[]): number {
    return chapitres
      .flatMap((chapitre) => chapitre.lessons)
      .filter((lecon) => lecon.publishedAt !== null)
      .reduce((total, lecon) => total + lecon.durationMinutes, 0);
  }

  private manquePourPublier(row: LigneFormation): string[] {
    const lecons = row.chapters.flatMap((chapitre) => chapitre.lessons);
    const publiees = lecons.filter((lecon) => lecon.publishedAt !== null);
    const manques: string[] = [];

    if (row.description.trim().length < 20) manques.push('Une description d’au moins 20 caractères');
    if (row.outcomes.length === 0) manques.push('Au moins un objectif « ce que vous saurez faire »');
    if (row.chapters.length === 0) manques.push('Au moins un chapitre');
    if (publiees.length === 0) manques.push('Au moins une leçon publiée');
    if (publiees.some((lecon) => lecon.durationMinutes <= 0)) {
      manques.push('Une durée renseignée sur chaque leçon publiée');
    }
    if (row.access === 'PAID' && row.priceXaf <= 0) manques.push('Un prix, puisque la formation est payante');
    if (row.access === 'PAID' && !lecons.some((lecon) => lecon.preview)) {
      // Payer sans rien avoir pu voir, c'est acheter à l'aveugle (§26).
      manques.push('Au moins un extrait offert, pour une formation payante');
    }
    return manques;
  }

  private formatLecon(row: LigneLecon): AdminLesson {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      position: row.position,
      durationMinutes: row.durationMinutes,
      hasVideo: row.videoPublicId !== null,
      preview: row.preview,
      published: row.publishedAt !== null,
      documentCount: row._count.documents,
      documents: row.documents.map((document) => ({
        id: document.id,
        title: document.title,
        fileFormat: document.fileFormat,
        url: document.url,
      })),
    };
  }

  private formatChapitre(row: LigneChapitre): AdminChapter {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      position: row.position,
      lessons: row.lessons.map((lecon) => this.formatLecon(lecon)),
    };
  }

  private format(row: LigneFormation): AdminCourseResponse {
    const lecons = row.chapters.flatMap((chapitre) => chapitre.lessons);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      description: row.description,
      level: row.level,
      levelLabel: COURSE_LEVEL_LABELS[row.level].label,
      theme: row.theme,
      themeLabel: COURSE_THEME_LABELS[row.theme],
      access: row.access,
      accessLabel: COURSE_ACCESS_LABELS[row.access],
      priceXaf: row.priceXaf,
      outcomes: row.outcomes,
      prerequisites: row.prerequisites,
      instructorId: row.instructorId,
      instructorName: row.instructor.name,
      chapterCount: row.chapters.length,
      lessonCount: lecons.length,
      publishedLessonCount: lecons.filter((lecon) => lecon.publishedAt !== null).length,
      durationMinutes: this.duree(row.chapters),
      enrollmentCount: row._count.enrollments,
      reviewCount: row._count.reviews,
      published: row.publishedAt !== null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      missingForPublication: this.manquePourPublier(row),
    };
  }

  private static readonly INCLUSION = {
    instructor: { select: { name: true } },
    _count: { select: { enrollments: true, reviews: true } },
    chapters: {
      orderBy: { position: 'asc' as const },
      include: {
        lessons: {
          orderBy: { position: 'asc' as const },
          include: {
            _count: { select: { documents: true } },
            documents: { orderBy: { position: 'asc' as const } },
          },
        },
      },
    },
  } as const;

  async listCourses(query: AdminCourseSearchQuery): Promise<AdminCourseListResponse> {
    const where = {
      ...(query.level ? { level: query.level } : {}),
      ...(query.theme ? { theme: query.theme } : {}),
      ...(query.publiee === 'oui' ? { publishedAt: { not: null } } : {}),
      ...(query.publiee === 'non' ? { publishedAt: null } : {}),
      ...(query.recherche
        ? {
            OR: [
              { title: { contains: query.recherche, mode: 'insensitive' as const } },
              { summary: { contains: query.recherche, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total, publiees, brouillons] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: AdminAcademyService.INCLUSION,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.course.count({ where }),
      this.prisma.course.count({ where: { publishedAt: { not: null } } }),
      this.prisma.course.count({ where: { publishedAt: null } }),
    ]);

    return {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      items: rows.map((row) => this.format(row as unknown as LigneFormation)),
      publishedCount: publiees,
      draftCount: brouillons,
    };
  }

  private formatRessource(row: {
    id: string;
    slug: string;
    title: string;
    description: string;
    type: ResourceType;
    theme: CourseTheme;
    fileFormat: string;
    sizeBytes: number | null;
    pageCount: number | null;
    filePublicId: string | null;
    fileUrl: string | null;
    free: boolean;
    courseId: string | null;
    course: { title: string } | null;
    publishedAt: Date | null;
  }): AdminResource {
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
      hasFile: row.filePublicId !== null || row.fileUrl !== null,
      free: row.free,
      courseId: row.courseId,
      courseTitle: row.course?.title ?? null,
      published: row.publishedAt !== null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }

  async courseDetail(id: string): Promise<AdminCourseDetailResponse> {
    const row = await this.prisma.course.findUnique({
      where: { id },
      include: AdminAcademyService.INCLUSION,
    });
    if (!row) throw new NotFoundException('Cette formation n’existe pas.');

    const ressources = await this.prisma.libraryResource.findMany({
      where: { courseId: id },
      include: { course: { select: { title: true } } },
      orderBy: { title: 'asc' },
    });

    return {
      course: this.format(row as unknown as LigneFormation),
      chapters: (row.chapters as unknown as LigneChapitre[]).map((chapitre) =>
        this.formatChapitre(chapitre),
      ),
      resources: ressources.map((ressource) => this.formatRessource(ressource)),
    };
  }

  private async slugLibre(titre: string, saufId?: string): Promise<string> {
    const base = slugifier(titre) || 'formation';
    for (let suffixe = 0; suffixe < 50; suffixe += 1) {
      const candidat = suffixe === 0 ? base : `${base}-${suffixe + 1}`;
      const existant = await this.prisma.course.findUnique({ where: { slug: candidat } });
      if (!existant || existant.id === saufId) return candidat;
    }
    throw new BadRequestException('Trop de formations portent déjà ce titre : précisez-le.');
  }

  async createCourse(
    input: CreateCourseRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const formateur = await this.prisma.instructor.findUnique({ where: { id: input.instructorId } });
    if (!formateur) throw new NotFoundException('Ce formateur n’existe pas.');

    const row = await this.prisma.course.create({
      data: {
        slug: await this.slugLibre(input.title),
        title: input.title,
        summary: input.summary,
        description: input.description,
        level: input.level,
        theme: input.theme,
        access: input.access,
        priceXaf: input.priceXaf,
        outcomes: input.outcomes,
        prerequisites: input.prerequisites,
        instructorId: input.instructorId,
        coverUrl: input.coverUrl,
        trailerUrl: input.trailerUrl,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'course.create',
      entity: 'Course',
      entityId: row.id,
      metadata: { title: input.title },
      ipAddress: ip,
    });

    return this.courseDetail(row.id);
  }

  async updateCourse(
    id: string,
    input: UpdateCourseRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const existant = await this.prisma.course.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Cette formation n’existe pas.');

    // L'accord prix / mode d'accès se vérifie sur l'état résultant, pas sur l'envoi :
    // changer seulement `access` doit suffire à révéler l'incohérence.
    const access = input.access ?? (existant.access as CourseAccess);
    const priceXaf = input.priceXaf ?? existant.priceXaf;
    if (access === 'PAID' && priceXaf <= 0) {
      throw new BadRequestException('Une formation payante doit porter son prix.');
    }
    if (access !== 'PAID' && priceXaf !== 0) {
      throw new BadRequestException(
        'Une formation gratuite ou incluse dans l’abonnement ne porte pas de prix : remettez le prix à zéro.',
      );
    }

    if (input.instructorId) {
      const formateur = await this.prisma.instructor.findUnique({ where: { id: input.instructorId } });
      if (!formateur) throw new NotFoundException('Ce formateur n’existe pas.');
    }

    await this.prisma.course.update({
      where: { id },
      data: {
        ...(input.title ? { title: input.title, slug: await this.slugLibre(input.title, id) } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.level !== undefined ? { level: input.level } : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.access !== undefined ? { access: input.access } : {}),
        ...(input.priceXaf !== undefined ? { priceXaf: input.priceXaf } : {}),
        ...(input.outcomes !== undefined ? { outcomes: input.outcomes } : {}),
        ...(input.prerequisites !== undefined ? { prerequisites: input.prerequisites } : {}),
        ...(input.instructorId !== undefined ? { instructorId: input.instructorId } : {}),
        ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
        ...(input.trailerUrl !== undefined ? { trailerUrl: input.trailerUrl } : {}),
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'course.update',
      entity: 'Course',
      entityId: id,
      metadata: { champs: Object.keys(input) },
      ipAddress: ip,
    });

    return this.courseDetail(id);
  }

  async publishCourse(
    id: string,
    input: UpdatePublicationRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const row = await this.prisma.course.findUnique({
      where: { id },
      include: AdminAcademyService.INCLUSION,
    });
    if (!row) throw new NotFoundException('Cette formation n’existe pas.');

    if (input.published) {
      const manques = this.manquePourPublier(row as unknown as LigneFormation);
      if (manques.length > 0) {
        throw new BadRequestException(
          `Cette formation ne peut pas être publiée. Il manque : ${manques.join(' ; ')}.`,
        );
      }
    }

    await this.prisma.course.update({
      where: { id },
      // Ici, contrairement aux produits, `publishedAt` **est** l'état de publication :
      // le catalogue public ne sert que les formations dont la date est posée. Retirer
      // une formation efface donc sa date, et la republier la redate. L'historique de la
      // décision, lui, est au journal d'audit, qui est fait pour ça.
      data: { publishedAt: input.published ? new Date() : null },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: input.published ? 'course.published' : 'course.unpublished',
      entity: 'Course',
      entityId: id,
      metadata: { motif: input.reason },
      ipAddress: ip,
    });

    return this.courseDetail(id);
  }

  // ───────────────────────── Chapitres et leçons ─────────────────────────

  async createChapter(
    courseId: string,
    input: CreateChapterRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const formation = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!formation) throw new NotFoundException('Cette formation n’existe pas.');

    const dernier = await this.prisma.chapter.findFirst({
      where: { courseId },
      orderBy: { position: 'desc' },
    });

    await this.prisma.chapter.create({
      data: {
        courseId,
        title: input.title,
        summary: input.summary,
        position: (dernier?.position ?? 0) + 1,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'chapter.create',
      entity: 'Course',
      entityId: courseId,
      metadata: { titre: input.title },
      ipAddress: ip,
    });

    return this.courseDetail(courseId);
  }

  /**
   * Déplacement d'un chapitre. `@@unique([courseId, position])` interdit deux chapitres à
   * la même place : on écarte d'abord le chapitre déplacé sur une position libre, on
   * décale ses voisins, puis on le repose. Sans cette précaution, l'ordre serait
   * intenable dès le premier déplacement.
   */
  private async deplacerChapitre(courseId: string, id: string, vers: number): Promise<void> {
    const chapitres = await this.prisma.chapter.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
    });
    const deplace = chapitres.find((chapitre) => chapitre.id === id);
    if (!deplace) throw new NotFoundException('Ce chapitre n’existe pas.');

    const restants = chapitres.filter((chapitre) => chapitre.id !== id);
    const cible = Math.min(Math.max(vers, 1), chapitres.length);
    restants.splice(cible - 1, 0, deplace);

    await this.prisma.$transaction(async (tx) => {
      // Positions temporaires négatives : aucune ne peut entrer en conflit.
      for (const [index, chapitre] of restants.entries()) {
        await tx.chapter.update({ where: { id: chapitre.id }, data: { position: -(index + 1) } });
      }
      for (const [index, chapitre] of restants.entries()) {
        await tx.chapter.update({ where: { id: chapitre.id }, data: { position: index + 1 } });
      }
    });
  }

  async updateChapter(
    courseId: string,
    id: string,
    input: UpdateChapterRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const chapitre = await this.prisma.chapter.findUnique({ where: { id } });
    if (!chapitre || chapitre.courseId !== courseId) {
      throw new NotFoundException('Ce chapitre n’existe pas dans cette formation.');
    }

    if (input.title !== undefined || input.summary !== undefined) {
      await this.prisma.chapter.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
        },
      });
    }
    if (input.position !== undefined) await this.deplacerChapitre(courseId, id, input.position);

    await this.audit.record({
      actorId: acteur.id,
      action: 'chapter.update',
      entity: 'Course',
      entityId: courseId,
      metadata: { chapitre: id, champs: Object.keys(input) },
      ipAddress: ip,
    });

    return this.courseDetail(courseId);
  }

  async deleteChapter(
    courseId: string,
    id: string,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const chapitre = await this.prisma.chapter.findUnique({
      where: { id },
      include: { _count: { select: { lessons: true } } },
    });
    if (!chapitre || chapitre.courseId !== courseId) {
      throw new NotFoundException('Ce chapitre n’existe pas dans cette formation.');
    }
    if (chapitre._count.lessons > 0) {
      // Supprimer en cascade effacerait la progression des comptes inscrits.
      throw new BadRequestException(
        'Ce chapitre contient encore des leçons : supprimez-les d’abord, ou déplacez-les.',
      );
    }

    await this.prisma.chapter.delete({ where: { id } });
    await this.audit.record({
      actorId: acteur.id,
      action: 'chapter.delete',
      entity: 'Course',
      entityId: courseId,
      metadata: { chapitre: chapitre.title },
      ipAddress: ip,
    });

    return this.courseDetail(courseId);
  }

  /** Identifiant de leçon unique dans sa formation, comme l'exige le schéma. */
  private async slugLeconLibre(courseId: string, titre: string, saufId?: string): Promise<string> {
    const base = slugifier(titre) || 'lecon';
    for (let suffixe = 0; suffixe < 50; suffixe += 1) {
      const candidat = suffixe === 0 ? base : `${base}-${suffixe + 1}`;
      const existant = await this.prisma.lesson.findUnique({
        where: { courseId_slug: { courseId, slug: candidat } },
      });
      if (!existant || existant.id === saufId) return candidat;
    }
    throw new BadRequestException('Trop de leçons portent déjà ce titre : précisez-le.');
  }

  async createLesson(
    courseId: string,
    chapterId: string,
    input: CreateLessonRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const chapitre = await this.prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapitre || chapitre.courseId !== courseId) {
      throw new NotFoundException('Ce chapitre n’existe pas dans cette formation.');
    }

    const derniere = await this.prisma.lesson.findFirst({
      where: { chapterId },
      orderBy: { position: 'desc' },
    });

    await this.prisma.lesson.create({
      data: {
        courseId,
        chapterId,
        slug: await this.slugLeconLibre(courseId, input.title),
        title: input.title,
        summary: input.summary,
        durationMinutes: input.durationMinutes,
        preview: input.preview,
        position: (derniere?.position ?? 0) + 1,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'lesson.create',
      entity: 'Course',
      entityId: courseId,
      metadata: { titre: input.title },
      ipAddress: ip,
    });

    return this.courseDetail(courseId);
  }

  async updateLesson(
    courseId: string,
    id: string,
    input: UpdateLessonRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const lecon = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lecon || lecon.courseId !== courseId) {
      throw new NotFoundException('Cette leçon n’existe pas dans cette formation.');
    }

    const publicId = input.videoPublicId ?? lecon.videoPublicId;
    const format = input.videoFormat ?? lecon.videoFormat;
    if ((publicId === null) !== (format === null)) {
      // Sans l'extension, l'URL de lecture ne peut pas être signée : la leçon paraîtrait
      // pourvue d'une vidéo tout en restant illisible.
      throw new BadRequestException(
        'Une vidéo doit porter son identifiant et son extension : renseignez les deux, ou effacez les deux.',
      );
    }

    if (input.published === true && (publicId === null || lecon.durationMinutes <= 0)) {
      const manques = [
        publicId === null ? 'sa vidéo' : null,
        (input.durationMinutes ?? lecon.durationMinutes) <= 0 ? 'sa durée' : null,
      ].filter(Boolean);
      if (manques.length > 0) {
        throw new BadRequestException(`Cette leçon ne peut pas être publiée sans ${manques.join(' ni ')}.`);
      }
    }

    await this.prisma.lesson.update({
      where: { id },
      data: {
        ...(input.title ? { title: input.title, slug: await this.slugLeconLibre(courseId, input.title, id) } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.preview !== undefined ? { preview: input.preview } : {}),
        ...(input.videoPublicId !== undefined ? { videoPublicId: input.videoPublicId } : {}),
        ...(input.videoFormat !== undefined ? { videoFormat: input.videoFormat } : {}),
        ...(input.published !== undefined
          ? { publishedAt: input.published ? (lecon.publishedAt ?? new Date()) : null }
          : {}),
      },
    });

    if (input.position !== undefined) {
      await this.deplacerLecon(lecon.chapterId, id, input.position);
    }

    await this.audit.record({
      actorId: acteur.id,
      action: 'lesson.update',
      entity: 'Course',
      entityId: courseId,
      metadata: { lecon: id, champs: Object.keys(input) },
      ipAddress: ip,
    });

    return this.courseDetail(courseId);
  }

  /** Même précaution d'ordre que pour les chapitres, sur l'index `[chapterId, position]`. */
  private async deplacerLecon(chapterId: string, id: string, vers: number): Promise<void> {
    const lecons = await this.prisma.lesson.findMany({
      where: { chapterId },
      orderBy: { position: 'asc' },
    });
    const deplacee = lecons.find((lecon) => lecon.id === id);
    if (!deplacee) return;

    const restantes = lecons.filter((lecon) => lecon.id !== id);
    const cible = Math.min(Math.max(vers, 1), lecons.length);
    restantes.splice(cible - 1, 0, deplacee);

    await this.prisma.$transaction(
      restantes.map((lecon, index) =>
        this.prisma.lesson.update({ where: { id: lecon.id }, data: { position: index + 1 } }),
      ),
    );
  }

  async deleteLesson(
    courseId: string,
    id: string,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const lecon = await this.prisma.lesson.findUnique({
      where: { id },
      include: { _count: { select: { progress: true } } },
    });
    if (!lecon || lecon.courseId !== courseId) {
      throw new NotFoundException('Cette leçon n’existe pas dans cette formation.');
    }
    if (lecon._count.progress > 0) {
      // Des comptes l'ont déjà travaillée : la retirer du programme est un acte de
      // publication, pas une suppression. On ne détruit pas leur avancement.
      throw new BadRequestException(
        'Des comptes ont déjà suivi cette leçon : dépubliez-la plutôt que de la supprimer.',
      );
    }

    await this.prisma.lesson.delete({ where: { id } });
    await this.audit.record({
      actorId: acteur.id,
      action: 'lesson.delete',
      entity: 'Course',
      entityId: courseId,
      metadata: { lecon: lecon.title },
      ipAddress: ip,
    });

    return this.courseDetail(courseId);
  }

  // ───────────────────────── Bibliothèque ─────────────────────────

  async listResources(query: AdminResourceSearchQuery): Promise<AdminResourceListResponse> {
    const where = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.theme ? { theme: query.theme } : {}),
      ...(query.publiee === 'oui' ? { publishedAt: { not: null } } : {}),
      ...(query.publiee === 'non' ? { publishedAt: null } : {}),
      ...(query.recherche
        ? {
            OR: [
              { title: { contains: query.recherche, mode: 'insensitive' as const } },
              { description: { contains: query.recherche, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total, publiees, brouillons] = await Promise.all([
      this.prisma.libraryResource.findMany({
        where,
        include: { course: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.libraryResource.count({ where }),
      this.prisma.libraryResource.count({ where: { publishedAt: { not: null } } }),
      this.prisma.libraryResource.count({ where: { publishedAt: null } }),
    ]);

    return {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      items: rows.map((row) => this.formatRessource(row)),
      publishedCount: publiees,
      draftCount: brouillons,
    };
  }

  async updateResource(
    id: string,
    input: UpdateResourceRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminResource> {
    const existant = await this.prisma.libraryResource.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Cette ressource n’existe pas.');

    if (input.courseId) {
      const formation = await this.prisma.course.findUnique({ where: { id: input.courseId } });
      if (!formation) throw new NotFoundException('Cette formation n’existe pas.');
    }

    const row = await this.prisma.libraryResource.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.free !== undefined ? { free: input.free } : {}),
        ...(input.courseId !== undefined ? { courseId: input.courseId } : {}),
        ...(input.pageCount !== undefined ? { pageCount: input.pageCount } : {}),
      },
      include: { course: { select: { title: true } } },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'resource.update',
      entity: 'LibraryResource',
      entityId: id,
      metadata: { champs: Object.keys(input) },
      ipAddress: ip,
    });

    return this.formatRessource(row);
  }

  async publishResource(
    id: string,
    input: UpdatePublicationRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminResource> {
    const existant = await this.prisma.libraryResource.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Cette ressource n’existe pas.');

    if (input.published && existant.filePublicId === null && existant.fileUrl === null) {
      throw new BadRequestException(
        'Cette ressource n’a pas encore de fichier : elle serait annoncée téléchargeable sans l’être.',
      );
    }

    const row = await this.prisma.libraryResource.update({
      where: { id },
      data: { publishedAt: input.published ? (existant.publishedAt ?? new Date()) : null },
      include: { course: { select: { title: true } } },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: input.published ? 'resource.published' : 'resource.unpublished',
      entity: 'LibraryResource',
      entityId: id,
      metadata: { motif: input.reason },
      ipAddress: ip,
    });

    return this.formatRessource(row);
  }

  // ───────────────────────── Documents d'une leçon (ADM-05) ─────────────────────────

  /**
   * Attache un document à une leçon.
   *
   * Le document suit le droit d'accès de **sa leçon**, pas le sien : il n'a donc pas de
   * réglage de visibilité propre. Un PDF réservé attaché à une leçon offerte en extrait
   * serait téléchargeable par tout le monde, et personne ne s'en apercevrait.
   */
  async addLessonDocument(
    courseId: string,
    lessonId: string,
    input: LessonDocumentInput,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    const lecon = await this.prisma.lesson.findFirst({
      where: { id: lessonId, courseId },
      select: { id: true, _count: { select: { documents: true } } },
    });
    if (!lecon) throw new NotFoundException('Cette leçon n’existe pas dans cette formation.');

    await this.prisma.lessonDocument.create({
      data: {
        lessonId,
        title: input.title,
        url: input.url,
        fileFormat: input.fileFormat,
        sizeBytes: input.sizeBytes,
        position: lecon._count.documents,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'course.lesson.document.add',
      entity: 'Lesson',
      entityId: lessonId,
      metadata: { titre: input.title, format: input.fileFormat },
      ipAddress: ip,
    });

    return this.courseDetail(courseId);
  }

  async removeLessonDocument(
    courseId: string,
    lessonId: string,
    documentId: string,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminCourseDetailResponse> {
    await this.prisma.lessonDocument.deleteMany({
      where: { id: documentId, lesson: { id: lessonId, courseId } },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'course.lesson.document.remove',
      entity: 'Lesson',
      entityId: lessonId,
      metadata: { documentId },
      ipAddress: ip,
    });

    return this.courseDetail(courseId);
  }
}
