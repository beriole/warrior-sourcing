import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  AcademyCourseListResponseSchema,
  AcademyCourseQuerySchema,
  BuyCourseRequestSchema,
  BuyCourseResponseSchema,
  CourseDetailResponseSchema,
  GrantEnrollmentRequestSchema,
  GrantEnrollmentResponseSchema,
  LessonNotesRequestSchema,
  LessonNotesResponseSchema,
  LessonProgressRequestSchema,
  LessonProgressResponseSchema,
  LessonResponseSchema,
  QuizAttemptRequestSchema,
  QuizResponseSchema,
  QuizResultResponseSchema,
  ResourceDownloadResponseSchema,
  ResourceListResponseSchema,
  ResourceQuerySchema,
  type AcademyCourseListResponse,
  type AcademyCourseQuery,
  type BuyCourseRequest,
  type BuyCourseResponse,
  type CourseDetailResponse,
  type GrantEnrollmentRequest,
  type GrantEnrollmentResponse,
  type LessonNotesRequest,
  type LessonNotesResponse,
  type LessonProgressRequest,
  type LessonProgressResponse,
  type LessonResponse,
  type QuizAttemptRequest,
  type QuizResponse,
  type QuizResultResponse,
  type ResourceDownloadResponse,
  type ResourceListResponse,
  type ResourceQuery,
} from '@ws/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthGuard, StaffOnly, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { OptionalSession } from '../auth/optional-session.js';
import { ZodValidationPipe, toOpenApiSchema } from '../common/zod-validation.pipe.js';
import { AcademySession } from './academy-session.js';
import { AcademyService } from './academy.service.js';
import { CoursePurchaseService } from './course-purchase.service.js';

/** Publie les filtres d'une liste dans la documentation à partir du schéma Zod. */
function ApiZodQuery(schema: z.ZodType) {
  const described = toOpenApiSchema(schema) as { properties?: Record<string, Record<string, unknown>> };
  const properties = Object.entries(described.properties ?? {});

  return applyDecorators(
    ...properties.map(([name, property]) => ApiQuery({ name, required: false, schema: property })),
  );
}

/**
 * Academy (lot ACA, §26).
 *
 * Le catalogue et les fiches sont consultables sans compte : c'est la vitrine des formations.
 * Tout ce qui touche à une URL de lecture, à une progression, à une note ou à un quiz passe
 * par le service, qui vérifie le droit avant de répondre — l'interface ne décide de rien (§54).
 */
@ApiTags('Academy')
@Controller('academy')
export class AcademyController {
  constructor(
    private readonly academy: AcademyService,
    private readonly session: AcademySession,
    private readonly purchases: CoursePurchaseService,
    private readonly optionalSession: OptionalSession,
  ) {}

  @Get('courses')
  @ApiOperation({
    summary: 'Catalogue des formations, par niveau, thème et condition d’accès',
    description:
      'Renvoie aussi la formation à reprendre quand une session existe, et les niveaux et thèmes réellement présents en catalogue.',
  })
  @ApiZodQuery(AcademyCourseQuerySchema)
  @ApiOkResponse({ schema: toOpenApiSchema(AcademyCourseListResponseSchema) })
  async courses(
    @Query(new ZodValidationPipe(AcademyCourseQuerySchema)) query: AcademyCourseQuery,
    @Req() request: Request,
  ): Promise<AcademyCourseListResponse> {
    return this.academy.listCourses(query, await this.session.visitor(request));
  }

  @Get('courses/:slug')
  @ApiOperation({ summary: 'Fiche d’une formation : programme, durée, prix, avis, extrait' })
  @ApiParam({ name: 'slug', description: 'Libellé d’URL de la formation' })
  @ApiOkResponse({ schema: toOpenApiSchema(CourseDetailResponseSchema) })
  async course(@Param('slug') slug: string, @Req() request: Request): Promise<CourseDetailResponse> {
    return this.academy.course(slug, await this.session.visitor(request));
  }

  @Get('courses/:courseSlug/lessons/:lessonSlug')
  @ApiOperation({
    summary: 'Leçon et son URL de lecture',
    description:
      'L’URL de lecture n’est signée qu’après vérification du droit d’accès. Une leçon payante sans droit renvoie 403.',
  })
  @ApiParam({ name: 'courseSlug', description: 'Libellé d’URL de la formation' })
  @ApiParam({ name: 'lessonSlug', description: 'Libellé d’URL de la leçon' })
  @ApiOkResponse({ schema: toOpenApiSchema(LessonResponseSchema) })
  async lesson(
    @Param('courseSlug') courseSlug: string,
    @Param('lessonSlug') lessonSlug: string,
    @Req() request: Request,
  ): Promise<LessonResponse> {
    return this.academy.lesson(courseSlug, lessonSlug, await this.session.visitor(request));
  }

  @Post('courses/:courseSlug/lessons/:lessonSlug/progress')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Enregistre la position de lecture et l’achèvement d’une leçon' })
  @ApiOkResponse({ schema: toOpenApiSchema(LessonProgressResponseSchema) })
  async progress(
    @Param('courseSlug') courseSlug: string,
    @Param('lessonSlug') lessonSlug: string,
    @Body(new ZodValidationPipe(LessonProgressRequestSchema)) body: LessonProgressRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<LessonProgressResponse> {
    return this.academy.saveProgress(courseSlug, lessonSlug, body, await this.session.member(request));
  }

  @Put('courses/:courseSlug/lessons/:lessonSlug/notes')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Notes personnelles d’une leçon. Un champ vidé efface la note.' })
  @ApiOkResponse({ schema: toOpenApiSchema(LessonNotesResponseSchema) })
  async notes(
    @Param('courseSlug') courseSlug: string,
    @Param('lessonSlug') lessonSlug: string,
    @Body(new ZodValidationPipe(LessonNotesRequestSchema)) body: LessonNotesRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<LessonNotesResponse> {
    return this.academy.saveNotes(courseSlug, lessonSlug, body.notes, await this.session.member(request));
  }

  @Get('quizzes/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Questions d’un quiz. Les bonnes réponses ne sont pas envoyées.' })
  @ApiOkResponse({ schema: toOpenApiSchema(QuizResponseSchema) })
  async quiz(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<QuizResponse> {
    return this.academy.quiz(id, await this.session.member(request));
  }

  @Post('quizzes/:id/attempts')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Correction d’un quiz : score, réussite et explication par question' })
  @ApiOkResponse({ schema: toOpenApiSchema(QuizResultResponseSchema) })
  async attempt(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(QuizAttemptRequestSchema)) body: QuizAttemptRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<QuizResultResponse> {
    return this.academy.submitQuiz(id, body, await this.session.member(request));
  }

  @Get('resources')
  @ApiOperation({ summary: 'Bibliothèque : PDF, guides, checklists, modèles et fiches pratiques' })
  @ApiZodQuery(ResourceQuerySchema)
  @ApiOkResponse({ schema: toOpenApiSchema(ResourceListResponseSchema) })
  async resources(
    @Query(new ZodValidationPipe(ResourceQuerySchema)) query: ResourceQuery,
    @Req() request: Request,
  ): Promise<ResourceListResponse> {
    return this.academy.listResources(query, await this.session.visitor(request));
  }

  @Get('resources/:slug/download')
  @ApiOperation({
    summary: 'Lien de téléchargement d’une ressource',
    description: 'Le droit est vérifié avant toute signature : une ressource réservée renvoie 403.',
  })
  @ApiParam({ name: 'slug', description: 'Libellé d’URL de la ressource' })
  @ApiOkResponse({ schema: toOpenApiSchema(ResourceDownloadResponseSchema) })
  async download(@Param('slug') slug: string, @Req() request: Request): Promise<ResourceDownloadResponse> {
    return this.academy.downloadResource(slug, await this.session.visitor(request));
  }

  /**
   * Achat d'une formation à l'unité (SUB-02).
   *
   * Publique **par nécessité** : exiger un compte pour acheter demande de s'inscrire avant
   * d'avoir vu ce qu'on achète. Avec une session, l'achat s'y rattache ; sans session, le
   * nom et l'adresse créent le compte, dont les identifiants sont engendrés à la
   * confirmation du paiement.
   */
  @Post('courses/:slug/achat')
  @ApiOperation({ summary: 'Acheter une formation à l’unité, avec ou sans compte' })
  @ApiParam({ name: 'slug', description: 'Libellé d’URL de la formation' })
  @ApiBody({ schema: toOpenApiSchema(BuyCourseRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(BuyCourseResponseSchema) })
  async buy(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(BuyCourseRequestSchema)) body: BuyCourseRequest,
    @Req() request: Request,
  ): Promise<BuyCourseResponse> {
    return this.purchases.buy(slug, body, await this.optionalSession.userId(request));
  }

  @Post('enrollments')
  @UseGuards(AuthGuard)
  @StaffOnly()
  @ApiOperation({
    summary: 'Ouvre l’accès d’un compte à une formation',
    description:
      'Réservé à l’équipe, en attendant que le paiement (lot PAY) et l’abonnement (lot SUB) ouvrent le droit eux-mêmes. Idempotent.',
  })
  @ApiOkResponse({ schema: toOpenApiSchema(GrantEnrollmentResponseSchema) })
  grant(
    @Body(new ZodValidationPipe(GrantEnrollmentRequestSchema)) body: GrantEnrollmentRequest,
  ): Promise<GrantEnrollmentResponse> {
    return this.academy.grantEnrollment(body);
  }
}
