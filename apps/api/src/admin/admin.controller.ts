import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminCourseDetailResponseSchema,
  AdminIntegrationsResponseSchema,
  AdminPaymentListResponseSchema,
  AdminPaymentSearchQuerySchema,
  AdminCourseListResponseSchema,
  AdminCourseSearchQuerySchema,
  AdminDashboardResponseSchema,
  AdminInstructorListResponseSchema,
  AdminOrderDetailResponseSchema,
  AdminProductDetailResponseSchema,
  AdminProductListResponseSchema,
  AdminProductSearchQuerySchema,
  AdminSupplierDetailResponseSchema,
  AdminSupplierListResponseSchema,
  AdminResourceSchema,
  AdminResourceListResponseSchema,
  AdminResourceSearchQuerySchema,
  AdminSupplierSearchQuerySchema,
  ChangeSupplierLevelRequestSchema,
  ChangeSupplierLevelResponseSchema,
  CreateChapterRequestSchema,
  CreateCourseRequestSchema,
  CreateInstructorRequestSchema,
  CreateLessonRequestSchema,
  CreateProductRequestSchema,
  UpdateChapterRequestSchema,
  UpdateCourseRequestSchema,
  LessonDocumentInputSchema,
  UpdateLessonRequestSchema,
  UpdatePublicationRequestSchema,
  UpdateResourceRequestSchema,
  UpdateProductMarketRequestSchema,
  UpdateProductRequestSchema,
  UpdateProductStatusRequestSchema,
  CreateSupplierRequestSchema,
  SupplierPhotoInputSchema,
  SupplierShopLinkInputSchema,
  UpdateSupplierRequestSchema,
  AdminOrderListResponseSchema,
  AdminOrderSearchQuerySchema,
  AdminStatsQuerySchema,
  AdminStatsResponseSchema,
  AdminUserListResponseSchema,
  AdminUserSearchQuerySchema,
  AdvanceDisputeRequestSchema,
  AuditListResponseSchema,
  CreateDisputeRequestSchema,
  DisputeDetailResponseSchema,
  DisputeListResponseSchema,
  DisputeSearchQuerySchema,
  UpdateOrderStatusRequestSchema,
  UpdateUserRoleRequestSchema,
  UpdateUserRoleResponseSchema,
  type AdminCourseDetailResponse,
  type AdminIntegrationsResponse,
  type AdminPaymentListResponse,
  type AdminPaymentSearchQuery,
  type AdminCourseListResponse,
  type AdminCourseSearchQuery,
  type AdminDashboardResponse,
  type AdminInstructorListResponse,
  type AdminOrderDetailResponse,
  type AdminProductDetailResponse,
  type AdminProductListResponse,
  type AdminProductSearchQuery,
  type AdminSupplierDetailResponse,
  type AdminSupplierListResponse,
  type AdminResource,
  type AdminResourceListResponse,
  type AdminResourceSearchQuery,
  type AdminSupplierSearchQuery,
  type ChangeSupplierLevelRequest,
  type ChangeSupplierLevelResponse,
  type CreateChapterRequest,
  type CreateCourseRequest,
  type CreateInstructorRequest,
  type CreateLessonRequest,
  type CreateProductRequest,
  type UpdateChapterRequest,
  type UpdateCourseRequest,
  type LessonDocumentInput,
  type UpdateLessonRequest,
  type UpdatePublicationRequest,
  type UpdateResourceRequest,
  type UpdateProductMarketRequest,
  type UpdateProductRequest,
  type UpdateProductStatusRequest,
  type CreateSupplierRequest,
  type SupplierPhotoInput,
  type SupplierShopLinkInput,
  type UpdateSupplierRequest,
  type AdminOrderListResponse,
  type AdminOrderSearchQuery,
  type AdminStatsQuery,
  type AdminStatsResponse,
  type AdminUserListResponse,
  type AdminUserSearchQuery,
  type AdvanceDisputeRequest,
  type AuditListResponse,
  type CreateDisputeRequest,
  type DisputeDetailResponse,
  type DisputeListResponse,
  type DisputeSearchQuery,
  type UpdateOrderStatusRequest,
  type UpdateUserRoleRequest,
  type UpdateUserRoleResponse,
} from '@ws/contracts';
import { AuthGuard, Roles, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminDisputesService } from './admin-disputes.service.js';
import { AdminAcademyService } from './admin-academy.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminPaymentsService } from './admin-payments.service.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminSuppliersService } from './admin-suppliers.service.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { AuditService } from './audit.service.js';

/**
 * Back-office (lot ADM, §37, §39, §40).
 *
 * Tout ce contrôleur est réservé à l'administration : `AuthGuard` vérifie la session,
 * `@Roles` vérifie le rôle. L'interface masque, le serveur refuse. Le changement de rôle
 * est en plus restreint au SUPER_ADMIN, au niveau de sa seule route.
 */
@ApiTags('Back-office')
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(
    private readonly stats: AdminStatsService,
    private readonly audit: AuditService,
    private readonly users: AdminUsersService,
    private readonly orders: AdminOrdersService,
    private readonly disputes: AdminDisputesService,
    private readonly products: AdminProductsService,
    private readonly suppliers: AdminSuppliersService,
    private readonly academy: AdminAcademyService,
    private readonly payments: AdminPaymentsService,
  ) {}

  /** Adresse de l'appelant, conservée dans le journal d'audit. */
  private ip(request: AuthenticatedRequest): string | null {
    return request.ip ?? null;
  }

  // ───────────────────────── Indicateurs et tableau de bord ─────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Indicateurs réels de la période (agrégations SQL, aucun chiffre estimé)' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminStatsResponseSchema) })
  getStats(
    @Query(new ZodValidationPipe(AdminStatsQuerySchema)) query: AdminStatsQuery,
  ): Promise<AdminStatsResponse> {
    return this.stats.stats(query.periode);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Dernières actions sensibles journalisées' })
  @ApiOkResponse({ schema: toOpenApiSchema(AuditListResponseSchema) })
  getAudit(): Promise<AuditListResponse> {
    return this.audit.recent(30);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Tableau de bord : indicateurs de la période et journal d’audit' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminDashboardResponseSchema) })
  async getDashboard(
    @Query(new ZodValidationPipe(AdminStatsQuerySchema)) query: AdminStatsQuery,
  ): Promise<AdminDashboardResponse> {
    const [stats, audit] = await Promise.all([this.stats.stats(query.periode), this.audit.recent(15)]);
    return { stats, audit };
  }

  // ───────────────────────── Utilisateurs et rôles (ADM-07) ─────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'Liste des comptes, avec recherche et filtre par rôle' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminUserListResponseSchema) })
  listUsers(
    @Query(new ZodValidationPipe(AdminUserSearchQuerySchema)) query: AdminUserSearchQuery,
  ): Promise<AdminUserListResponse> {
    return this.users.list(query);
  }

  /** Réservé au SUPER_ADMIN : un ADMIN ne promeut personne, pas même lui-même. */
  @Patch('users/:id/role')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Changer le rôle d’un compte (SUPER_ADMIN uniquement, journalisé)' })
  @ApiBody({ schema: toOpenApiSchema(UpdateUserRoleRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(UpdateUserRoleResponseSchema) })
  changeRole(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateUserRoleRequestSchema)) input: UpdateUserRoleRequest,
  ): Promise<UpdateUserRoleResponse> {
    return this.users.changeRole(
      id,
      input,
      { id: request.user.id, role: request.user.role },
      this.ip(request),
    );
  }

  // ───────────────────────── Commandes (ADM-06) ─────────────────────────

  @Get('orders')
  @ApiOperation({ summary: 'Commandes, filtrables par état et par genre' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminOrderListResponseSchema) })
  listOrders(
    @Query(new ZodValidationPipe(AdminOrderSearchQuerySchema)) query: AdminOrderSearchQuery,
  ): Promise<AdminOrderListResponse> {
    return this.orders.list(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Détail d’une commande : montants, lignes, paiements, états possibles' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminOrderDetailResponseSchema) })
  orderDetail(@Param('id') id: string): Promise<AdminOrderDetailResponse> {
    return this.orders.detail(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Changer l’état d’une commande (transitions encadrées, journalisées)' })
  @ApiBody({ schema: toOpenApiSchema(UpdateOrderStatusRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminOrderDetailResponseSchema) })
  changeOrderStatus(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateOrderStatusRequestSchema)) input: UpdateOrderStatusRequest,
  ): Promise<AdminOrderDetailResponse> {
    return this.orders.changeStatus(id, input, request.user.id, this.ip(request));
  }

  // ───────────────────────── Litiges (ADM-08, §39) ─────────────────────────

  @Get('disputes')
  @ApiOperation({ summary: 'Litiges et répartition par étape du workflow' })
  @ApiOkResponse({ schema: toOpenApiSchema(DisputeListResponseSchema) })
  listDisputes(
    @Query(new ZodValidationPipe(DisputeSearchQuerySchema)) query: DisputeSearchQuery,
  ): Promise<DisputeListResponse> {
    return this.disputes.list(query);
  }

  @Get('disputes/:id')
  @ApiOperation({ summary: 'Dossier de litige et journal complet de ses étapes' })
  @ApiOkResponse({ schema: toOpenApiSchema(DisputeDetailResponseSchema) })
  disputeDetail(@Param('id') id: string): Promise<DisputeDetailResponse> {
    return this.disputes.detail(id);
  }

  @Post('disputes')
  @ApiOperation({ summary: 'Ouvrir un litige sur une commande' })
  @ApiBody({ schema: toOpenApiSchema(CreateDisputeRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(DisputeDetailResponseSchema) })
  openDispute(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateDisputeRequestSchema)) input: CreateDisputeRequest,
  ): Promise<DisputeDetailResponse> {
    return this.disputes.create(input, request.user.id, this.ip(request));
  }

  @Post('disputes/:id/etapes')
  @ApiOperation({ summary: 'Franchir l’étape suivante du litige (aucun raccourci possible)' })
  @ApiBody({ schema: toOpenApiSchema(AdvanceDisputeRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(DisputeDetailResponseSchema) })
  advanceDispute(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(AdvanceDisputeRequestSchema)) input: AdvanceDisputeRequest,
  ): Promise<DisputeDetailResponse> {
    return this.disputes.advance(id, input, request.user.id, this.ip(request));
  }

  // ───────────────────────── Produits (ADM-03) ─────────────────────────

  @Get('products')
  @ApiOperation({ summary: 'Fiches produits, filtrables par état et par catégorie' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminProductListResponseSchema) })
  listProducts(
    @Query(new ZodValidationPipe(AdminProductSearchQuerySchema)) query: AdminProductSearchQuery,
  ): Promise<AdminProductListResponse> {
    return this.products.list(query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Fiche produit complète, avec son relevé de marché' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminProductDetailResponseSchema) })
  productDetail(@Param('id') id: string): Promise<AdminProductDetailResponse> {
    return this.products.detail(id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Créer une fiche produit (créée en brouillon)' })
  @ApiBody({ schema: toOpenApiSchema(CreateProductRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminProductDetailResponseSchema) })
  createProduct(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateProductRequestSchema)) input: CreateProductRequest,
  ): Promise<AdminProductDetailResponse> {
    return this.products.create(input, { id: request.user.id }, this.ip(request));
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Modifier une fiche produit' })
  @ApiBody({ schema: toOpenApiSchema(UpdateProductRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminProductDetailResponseSchema) })
  updateProduct(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateProductRequestSchema)) input: UpdateProductRequest,
  ): Promise<AdminProductDetailResponse> {
    return this.products.update(id, input, { id: request.user.id }, this.ip(request));
  }

  /** Publier ou retirer. Le serveur refuse de publier une fiche incomplète. */
  @Patch('products/:id/status')
  @ApiOperation({ summary: 'Publier ou retirer une fiche produit (journalisé)' })
  @ApiBody({ schema: toOpenApiSchema(UpdateProductStatusRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminProductDetailResponseSchema) })
  changeProductStatus(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateProductStatusRequestSchema)) input: UpdateProductStatusRequest,
  ): Promise<AdminProductDetailResponse> {
    return this.products.changeStatus(id, input, { id: request.user.id }, this.ip(request));
  }

  @Put('products/:id/market')
  @ApiOperation({ summary: 'Enregistrer le relevé de marché (prix local daté et sourcé)' })
  @ApiBody({ schema: toOpenApiSchema(UpdateProductMarketRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminProductDetailResponseSchema) })
  updateProductMarket(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateProductMarketRequestSchema)) input: UpdateProductMarketRequest,
  ): Promise<AdminProductDetailResponse> {
    return this.products.updateMarket(id, input, { id: request.user.id }, this.ip(request));
  }

  // ───────────────────────── Fournisseurs (ADM-04) ─────────────────────────

  @Get('suppliers')
  @ApiOperation({ summary: 'Fournisseurs, filtrables par niveau de vérification' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminSupplierListResponseSchema) })
  listSuppliers(
    @Query(new ZodValidationPipe(AdminSupplierSearchQuerySchema)) query: AdminSupplierSearchQuery,
  ): Promise<AdminSupplierListResponse> {
    return this.suppliers.list(query);
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Fiche fournisseur, ses preuves et son historique de niveau' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminSupplierDetailResponseSchema) })
  supplierDetail(@Param('id') id: string): Promise<AdminSupplierDetailResponse> {
    return this.suppliers.detail(id);
  }

  @Patch('suppliers/:id')
  @ApiOperation({ summary: 'Modifier les informations publiques d’un fournisseur' })
  @ApiBody({ schema: toOpenApiSchema(UpdateSupplierRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminSupplierDetailResponseSchema) })
  updateSupplier(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateSupplierRequestSchema)) input: UpdateSupplierRequest,
  ): Promise<AdminSupplierDetailResponse> {
    return this.suppliers.update(id, input, { id: request.user.id }, this.ip(request));
  }

  /**
   * Création d'un fournisseur.
   *
   * Il n'existait aucune route de création : on pouvait modifier un fournisseur, pas en
   * ajouter un. Un référentiel qu'on ne peut pas alimenter n'est pas un référentiel.
   */
  @Post('suppliers')
  @ApiOperation({ summary: 'Créer un fournisseur. Il naît sans niveau de vérification.' })
  @ApiBody({ schema: toOpenApiSchema(CreateSupplierRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminSupplierDetailResponseSchema) })
  createSupplier(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateSupplierRequestSchema)) input: CreateSupplierRequest,
  ): Promise<AdminSupplierDetailResponse> {
    return this.suppliers.create(input, { id: request.user.id }, this.ip(request));
  }

  @Post('suppliers/:id/photos')
  @ApiOperation({ summary: 'Ajouter une photo : usine, ligne, entrepôt, échantillon, emballage, équipe' })
  @ApiBody({ schema: toOpenApiSchema(SupplierPhotoInputSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminSupplierDetailResponseSchema) })
  addSupplierPhoto(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(SupplierPhotoInputSchema)) input: SupplierPhotoInput,
  ): Promise<AdminSupplierDetailResponse> {
    return this.suppliers.addPhoto(id, input, { id: request.user.id }, this.ip(request));
  }

  @Delete('suppliers/:id/photos/:photoId')
  @ApiOperation({ summary: 'Retirer une photo de la fiche' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminSupplierDetailResponseSchema) })
  removeSupplierPhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminSupplierDetailResponse> {
    return this.suppliers.removePhoto(id, photoId, { id: request.user.id }, this.ip(request));
  }

  @Post('suppliers/:id/boutiques')
  @ApiOperation({ summary: 'Ajouter ou mettre à jour une boutique en ligne (1688, Alibaba, site…)' })
  @ApiBody({ schema: toOpenApiSchema(SupplierShopLinkInputSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminSupplierDetailResponseSchema) })
  addSupplierShopLink(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(SupplierShopLinkInputSchema)) input: SupplierShopLinkInput,
  ): Promise<AdminSupplierDetailResponse> {
    return this.suppliers.addShopLink(id, input, { id: request.user.id }, this.ip(request));
  }

  @Delete('suppliers/:id/boutiques/:linkId')
  @ApiOperation({ summary: 'Retirer une boutique de la fiche' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminSupplierDetailResponseSchema) })
  removeSupplierShopLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminSupplierDetailResponse> {
    return this.suppliers.removeShopLink(id, linkId, { id: request.user.id }, this.ip(request));
  }

  /** Promotion ou rétrogradation : la preuve consultable est exigée par le contrat (§16). */
  @Post('suppliers/:id/verifications')
  @ApiOperation({ summary: 'Changer le niveau de vérification (preuve obligatoire, journalisé)' })
  @ApiBody({ schema: toOpenApiSchema(ChangeSupplierLevelRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ChangeSupplierLevelResponseSchema) })
  changeSupplierLevel(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(ChangeSupplierLevelRequestSchema)) input: ChangeSupplierLevelRequest,
  ): Promise<ChangeSupplierLevelResponse> {
    return this.suppliers.changeLevel(id, input, { id: request.user.id }, this.ip(request));
  }

  // ───────────────────────── Formations et bibliothèque (ADM-05) ─────────────────────────

  @Get('instructors')
  @ApiOperation({ summary: 'Formateurs, avec le nombre de formations animées' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminInstructorListResponseSchema) })
  listInstructors(): Promise<AdminInstructorListResponse> {
    return this.academy.listInstructors();
  }

  @Post('instructors')
  @ApiOperation({ summary: 'Ajouter un formateur' })
  @ApiBody({ schema: toOpenApiSchema(CreateInstructorRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminInstructorListResponseSchema) })
  createInstructor(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateInstructorRequestSchema)) input: CreateInstructorRequest,
  ): Promise<AdminInstructorListResponse> {
    return this.academy.createInstructor(input, { id: request.user.id }, this.ip(request));
  }

  @Get('courses')
  @ApiOperation({ summary: 'Formations, filtrables par niveau, thème et état de publication' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseListResponseSchema) })
  listCourses(
    @Query(new ZodValidationPipe(AdminCourseSearchQuerySchema)) query: AdminCourseSearchQuery,
  ): Promise<AdminCourseListResponse> {
    return this.academy.listCourses(query);
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Formation complète : programme, leçons et ressources attachées' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  courseDetail(@Param('id') id: string): Promise<AdminCourseDetailResponse> {
    return this.academy.courseDetail(id);
  }

  @Post('courses')
  @ApiOperation({ summary: 'Créer une formation (créée non publiée)' })
  @ApiBody({ schema: toOpenApiSchema(CreateCourseRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  createCourse(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateCourseRequestSchema)) input: CreateCourseRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.createCourse(input, { id: request.user.id }, this.ip(request));
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'Modifier une formation' })
  @ApiBody({ schema: toOpenApiSchema(UpdateCourseRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  updateCourse(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateCourseRequestSchema)) input: UpdateCourseRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.updateCourse(id, input, { id: request.user.id }, this.ip(request));
  }

  /** Publier exige un programme réel : le serveur énumère ce qui manque. */
  @Patch('courses/:id/publication')
  @ApiOperation({ summary: 'Publier ou retirer une formation (journalisé)' })
  @ApiBody({ schema: toOpenApiSchema(UpdatePublicationRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  publishCourse(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdatePublicationRequestSchema)) input: UpdatePublicationRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.publishCourse(id, input, { id: request.user.id }, this.ip(request));
  }

  @Post('courses/:id/chapters')
  @ApiOperation({ summary: 'Ajouter un chapitre au programme' })
  @ApiBody({ schema: toOpenApiSchema(CreateChapterRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  createChapter(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateChapterRequestSchema)) input: CreateChapterRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.createChapter(id, input, { id: request.user.id }, this.ip(request));
  }

  @Patch('courses/:id/chapters/:chapterId')
  @ApiOperation({ summary: 'Renommer ou déplacer un chapitre' })
  @ApiBody({ schema: toOpenApiSchema(UpdateChapterRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  updateChapter(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateChapterRequestSchema)) input: UpdateChapterRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.updateChapter(id, chapterId, input, { id: request.user.id }, this.ip(request));
  }

  @Delete('courses/:id/chapters/:chapterId')
  @ApiOperation({ summary: 'Supprimer un chapitre vide' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  deleteChapter(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.deleteChapter(id, chapterId, { id: request.user.id }, this.ip(request));
  }

  @Post('courses/:id/chapters/:chapterId/lessons')
  @ApiOperation({ summary: 'Ajouter une leçon à un chapitre' })
  @ApiBody({ schema: toOpenApiSchema(CreateLessonRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  createLesson(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateLessonRequestSchema)) input: CreateLessonRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.createLesson(id, chapterId, input, { id: request.user.id }, this.ip(request));
  }

  @Patch('courses/:id/lessons/:lessonId')
  @ApiOperation({ summary: 'Modifier, déplacer, publier ou retirer une leçon' })
  @ApiBody({ schema: toOpenApiSchema(UpdateLessonRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  updateLesson(
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateLessonRequestSchema)) input: UpdateLessonRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.updateLesson(id, lessonId, input, { id: request.user.id }, this.ip(request));
  }

  @Delete('courses/:id/lessons/:lessonId')
  @ApiOperation({ summary: 'Supprimer une leçon que personne n’a encore suivie' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  deleteLesson(
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.deleteLesson(id, lessonId, { id: request.user.id }, this.ip(request));
  }

  @Post('courses/:id/lessons/:lessonId/documents')
  @ApiOperation({
    summary: 'Attacher un document à une leçon (PDF, modèle, checklist)',
    description:
      'Le document suit le droit d’accès de sa leçon : il n’a pas de visibilité propre, pour qu’un fichier réservé ne puisse pas se retrouver ouvert à tous.',
  })
  @ApiBody({ schema: toOpenApiSchema(LessonDocumentInputSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  addLessonDocument(
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(LessonDocumentInputSchema)) input: LessonDocumentInput,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.addLessonDocument(id, lessonId, input, { id: request.user.id }, this.ip(request));
  }

  @Delete('courses/:id/lessons/:lessonId/documents/:documentId')
  @ApiOperation({ summary: 'Retirer un document d’une leçon' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminCourseDetailResponseSchema) })
  removeLessonDocument(
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('documentId') documentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminCourseDetailResponse> {
    return this.academy.removeLessonDocument(
      id,
      lessonId,
      documentId,
      { id: request.user.id },
      this.ip(request),
    );
  }

  @Get('resources')
  @ApiOperation({ summary: 'Ressources de la bibliothèque, filtrables' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminResourceListResponseSchema) })
  listResources(
    @Query(new ZodValidationPipe(AdminResourceSearchQuerySchema)) query: AdminResourceSearchQuery,
  ): Promise<AdminResourceListResponse> {
    return this.academy.listResources(query);
  }

  @Patch('resources/:id')
  @ApiOperation({ summary: 'Modifier une ressource de la bibliothèque' })
  @ApiBody({ schema: toOpenApiSchema(UpdateResourceRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminResourceSchema) })
  updateResource(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateResourceRequestSchema)) input: UpdateResourceRequest,
  ): Promise<AdminResource> {
    return this.academy.updateResource(id, input, { id: request.user.id }, this.ip(request));
  }

  @Patch('resources/:id/publication')
  @ApiOperation({ summary: 'Publier ou retirer une ressource (fichier obligatoire pour publier)' })
  @ApiBody({ schema: toOpenApiSchema(UpdatePublicationRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminResourceSchema) })
  publishResource(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdatePublicationRequestSchema)) input: UpdatePublicationRequest,
  ): Promise<AdminResource> {
    return this.academy.publishResource(id, input, { id: request.user.id }, this.ip(request));
  }

  // ───────────────────────── Paiements et exploitation ─────────────────────────

  @Get('payments')
  @ApiOperation({ summary: 'Paiements, en lecture seule (leur état vient de l’agrégateur)' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminPaymentListResponseSchema) })
  listPayments(
    @Query(new ZodValidationPipe(AdminPaymentSearchQuerySchema)) query: AdminPaymentSearchQuery,
  ): Promise<AdminPaymentListResponse> {
    return this.payments.list(query);
  }

  @Get('integrations')
  @ApiOperation({ summary: 'État des intégrations : ce qui est configuré, et ce que l’absence entraîne' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminIntegrationsResponseSchema) })
  integrations(): AdminIntegrationsResponse {
    return this.payments.integrations();
  }
}
