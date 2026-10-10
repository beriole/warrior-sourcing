import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEREST_CATEGORY_LABELS,
  SUPPLIER_DOCUMENT_KIND_LABELS,
  SUPPLIER_FACTORY_SCALE_LABELS,
  SUPPLIER_INCIDENT_SEVERITY_LABELS,
  SUPPLIER_INCIDENT_STATUS_LABELS,
  SUPPLIER_PAYMENT_TERM_LABELS,
  SUPPLIER_PHOTO_KIND_LABELS,
  SUPPLIER_REQUEST_KIND_LABELS,
  SUPPLIER_SHOP_PLATFORM_LABELS,
  SUPPLIER_TEST_ORDER_OUTCOME_LABELS,
  isStaff,
  type CreateSupplierRequestBody,
  type RecordSupplierVerificationBody,
  type RecordSupplierVerificationResponse,
  type SupplierContactResponse,
  type SupplierDetailResponse,
  type SupplierListQuery,
  type SupplierListResponse,
  type SupplierRequestResponse,
  type SupplierType,
  type UserRole,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { canPromoteTo, currentVerification, levelsAtLeast, promotionRefusalMessage, toProofs } from './verification.js';

/** Libellés des types de fournisseur. Aucun terme technique exposé à l'utilisateur (§45). */
const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  MANUFACTURER: 'Usine',
  DISTRIBUTOR: 'Distributeur',
  TRADING_COMPANY: 'Société de négoce',
};

/**
 * Rôles autorisés à voir les coordonnées d'un fournisseur (§17).
 * Un compte gratuit (`CLIENT`) n'en fait pas partie : le refus vient du serveur, pas de l'écran.
 */
export const SUPPLIER_CONTACT_ROLES: readonly UserRole[] = [
  'PREMIUM_MEMBER',
  'SOURCING_AGENT',
  'CHINA_AGENT',
  'LOGISTICS_AGENT',
  'SUPPORT',
  'CONTENT_MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
];

export function canSeeContact(role: UserRole | null): boolean {
  if (role === null) return false;
  return role === 'PREMIUM_MEMBER' || isStaff(role);
}

const CONTACT_LOCKED_REASON =
  'Les coordonnées de ce fournisseur sont réservées aux membres. Tout le reste de la fiche, y compris les incidents, reste visible.';
const CONTACT_UNLOCKED_REASON = 'Votre compte donne accès aux coordonnées de ce fournisseur.';

/** Champs publics du fournisseur. `contactDetails` n'est jamais sélectionné ici (§17). */
const PUBLIC_SUPPLIER_SELECT = {
  id: true,
  name: true,
  type: true,
  city: true,
  moq: true,
  oem: true,
  sampleAvailable: true,
  leadTimeDays: true,
  publicSummary: true,
  logoUrl: true,
} as const;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recherche et filtres (SUP-03).
   * Le nom et les produits alimentent la recherche libre ; les autres filtres portent sur
   * les caractéristiques du fournisseur ou sur ses niveaux prouvés.
   */
  async list(query: SupplierListQuery): Promise<SupplierListResponse> {
    const conditions: Record<string, unknown>[] = [];

    if (query.city) conditions.push({ city: { equals: query.city, mode: 'insensitive' } });
    if (query.type) conditions.push({ type: query.type });
    if (query.moqMax !== undefined) conditions.push({ moq: { lte: query.moqMax } });
    if (query.customization === true) conditions.push({ oem: true });
    if (query.sample === true) conditions.push({ sampleAvailable: true });

    // Filtre par catégorie : passe par les produits proposés, faute de relation Prisma.
    if (query.category) {
      const ids = await this.supplierIdsByOffering({ category: query.category });
      conditions.push({ id: { in: ids } });
    }

    // Recherche libre : nom du fournisseur ou nom d'un produit proposé.
    if (query.q) {
      const ids = await this.supplierIdsByOffering({ name: { contains: query.q, mode: 'insensitive' } });
      conditions.push({ OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { id: { in: ids } }] });
    }

    // Niveau de vérification : seules les preuves enregistrées comptent (§16).
    if (query.minLevel) {
      const proven = await this.prisma.supplierVerification.findMany({
        where: { level: { in: levelsAtLeast(query.minLevel) }, NOT: { evidenceUrl: null } },
        select: { supplierId: true },
      });
      conditions.push({ id: { in: [...new Set(proven.map((row) => row.supplierId))] } });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [total, suppliers, cities] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        select: PUBLIC_SUPPLIER_SELECT,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supplier.groupBy({ by: ['city'], orderBy: { city: 'asc' } }),
    ]);

    const ids = suppliers.map((supplier) => supplier.id);
    const [verifications, offerings, incidents] = await Promise.all([
      this.prisma.supplierVerification.findMany({
        where: { supplierId: { in: ids } },
        select: { id: true, supplierId: true, level: true, evidenceUrl: true, notes: true, verifiedAt: true },
      }),
      this.prisma.supplierOffering.findMany({
        where: { supplierId: { in: ids } },
        select: { supplierId: true, name: true, category: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplierIncident.groupBy({
        by: ['supplierId'],
        where: { supplierId: { in: ids }, status: 'OPEN' },
        _count: { _all: true },
      }),
    ]);

    return {
      items: suppliers.map((supplier) => {
        const own = offerings.filter((offering) => offering.supplierId === supplier.id);
        return {
          id: supplier.id,
          name: supplier.name,
          type: supplier.type,
          typeLabel: SUPPLIER_TYPE_LABELS[supplier.type],
          city: supplier.city,
          moq: supplier.moq,
          customization: supplier.oem,
          sampleAvailable: supplier.sampleAvailable,
          leadTimeDays: supplier.leadTimeDays,
          publicSummary: supplier.publicSummary,
          logoUrl: supplier.logoUrl,
          categories: [...new Set(own.map((offering) => offering.category))],
          topOfferings: own.slice(0, 3).map((offering) => offering.name),
          verification: currentVerification(verifications.filter((row) => row.supplierId === supplier.id)),
          openIncidents: incidents.find((row) => row.supplierId === supplier.id)?._count._all ?? 0,
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
      availableCities: cities.map((row) => row.city),
    };
  }

  /**
   * Aperçu public de la fiche (SUP-05).
   * Aucune coordonnée n'est renvoyée ici, quel que soit le compte : elles ont leur propre route.
   */
  async detail(id: string, role: UserRole | null): Promise<SupplierDetailResponse> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id }, select: PUBLIC_SUPPLIER_SELECT });
    if (!supplier) throw new NotFoundException("Ce fournisseur n'existe pas ou n'est plus référencé.");

    const [
      profile,
      offerings,
      terms,
      documents,
      incidents,
      testOrders,
      photos,
      verifications,
      levelHistory,
      shopLinks,
    ] = await Promise.all([
        this.prisma.supplierProfile.findUnique({ where: { supplierId: id } }),
        this.prisma.supplierOffering.findMany({ where: { supplierId: id }, orderBy: { name: 'asc' } }),
        this.prisma.supplierTerms.findUnique({ where: { supplierId: id } }),
        // Un document ne s'affiche que s'il est public ET contrôlé par notre équipe.
        this.prisma.supplierDocument.findMany({
          where: { supplierId: id, isPublic: true, NOT: { verifiedAt: null } },
          orderBy: { createdAt: 'desc' },
        }),
        // Les incidents sont toujours visibles : on ne masque jamais un risque (§17).
        this.prisma.supplierIncident.findMany({ where: { supplierId: id }, orderBy: { occurredAt: 'desc' } }),
        this.prisma.supplierTestOrder.findMany({ where: { supplierId: id }, orderBy: { orderedAt: 'desc' } }),
        this.prisma.supplierPhoto.findMany({ where: { supplierId: id }, orderBy: { takenAt: 'desc' } }),
        this.prisma.supplierVerification.findMany({
          where: { supplierId: id },
          select: { id: true, level: true, evidenceUrl: true, notes: true, verifiedAt: true },
        }),
        this.prisma.supplierLevelChange.findMany({ where: { supplierId: id }, orderBy: { decidedAt: 'desc' } }),
        // Les boutiques sont publiques : une vitrine 1688 se trouve déjà en une recherche.
        this.prisma.supplierShopLink.findMany({
          where: { supplierId: id },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        }),
      ]);

    const granted = canSeeContact(role);

    return {
      id: supplier.id,
      name: supplier.name,
      type: supplier.type,
      typeLabel: SUPPLIER_TYPE_LABELS[supplier.type],
      city: supplier.city,
      moq: supplier.moq,
      customization: supplier.oem,
      sampleAvailable: supplier.sampleAvailable,
      leadTimeDays: supplier.leadTimeDays,
      publicSummary: supplier.publicSummary,
      logoUrl: supplier.logoUrl,
      shopLinks: shopLinks.map((lien) => ({
        id: lien.id,
        platform: lien.platform,
        platformLabel: SUPPLIER_SHOP_PLATFORM_LABELS[lien.platform],
        url: lien.url,
        label: lien.label,
        checkedAt: lien.checkedAt?.toISOString() ?? null,
      })),
      profile: profile
        ? {
            foundedYear: profile.foundedYear,
            employeeCount: profile.employeeCount,
            factoryScale: profile.factoryScale,
            factoryScaleLabel: profile.factoryScale ? SUPPLIER_FACTORY_SCALE_LABELS[profile.factoryScale] : null,
            productionLines: profile.productionLines,
            monthlyCapacity: profile.monthlyCapacity,
            ownsFactory: profile.ownsFactory,
            exportExperienceYears: profile.exportExperienceYears,
            province: profile.province,
            certifications: profile.certifications,
            mainMarkets: profile.mainMarkets,
            languages: profile.languages,
            responseTimeHours: profile.responseTimeHours,
            presentation: profile.presentation,
            checkedAt: profile.checkedAt?.toISOString() ?? null,
          }
        : null,
      offerings: offerings.map((offering) => ({
        id: offering.id,
        name: offering.name,
        category: offering.category,
        categoryLabel: INTEREST_CATEGORY_LABELS[offering.category],
        description: offering.description,
        // Un prix ne sort jamais sans sa date de relevé (§2).
        unitPriceCnyMinor: offering.priceObservedAt ? offering.unitPriceCnyMinor : null,
        priceObservedAt: offering.priceObservedAt?.toISOString() ?? null,
        moq: offering.moq,
        customizable: offering.customizable,
        sampleAvailable: offering.sampleAvailable,
        leadTimeDays: offering.leadTimeDays,
      })),
      terms: terms
        ? {
            minOrderValueCnyMinor: terms.minOrderValueCnyMinor,
            paymentTerms: terms.paymentTerms,
            paymentTermLabels: terms.paymentTerms.map((term) => SUPPLIER_PAYMENT_TERM_LABELS[term]),
            depositPercent: terms.depositPercent,
            sampleAvailable: terms.sampleAvailable,
            sampleCostCnyMinor: terms.sampleCostCnyMinor,
            sampleLeadTimeDays: terms.sampleLeadTimeDays,
            customizationOptions: terms.customizationOptions,
            packagingOptions: terms.packagingOptions,
            incoterms: terms.incoterms,
            productionLeadTimeDays: terms.productionLeadTimeDays,
            negotiable: terms.negotiable,
            checkedAt: terms.checkedAt?.toISOString() ?? null,
          }
        : null,
      documents: documents.map((document) => ({
        id: document.id,
        kind: document.kind,
        kindLabel: SUPPLIER_DOCUMENT_KIND_LABELS[document.kind],
        label: document.label,
        fileUrl: document.fileUrl,
        issuedAt: document.issuedAt?.toISOString() ?? null,
        expiresAt: document.expiresAt?.toISOString() ?? null,
        verifiedAt: (document.verifiedAt as Date).toISOString(),
      })),
      incidents: incidents.map((incident) => ({
        id: incident.id,
        occurredAt: incident.occurredAt.toISOString(),
        severity: incident.severity,
        severityLabel: SUPPLIER_INCIDENT_SEVERITY_LABELS[incident.severity],
        status: incident.status,
        statusLabel: SUPPLIER_INCIDENT_STATUS_LABELS[incident.status],
        summary: incident.summary,
        resolution: incident.resolution,
        resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      })),
      testOrders: testOrders.map((order) => ({
        id: order.id,
        orderedAt: order.orderedAt.toISOString(),
        receivedAt: order.receivedAt?.toISOString() ?? null,
        productLabel: order.productLabel,
        quantity: order.quantity,
        amountCnyMinor: order.amountCnyMinor,
        outcome: order.outcome,
        outcomeLabel: SUPPLIER_TEST_ORDER_OUTCOME_LABELS[order.outcome],
        inspectionReportUrl: order.inspectionReportUrl,
        notes: order.notes,
      })),
      photos: photos.map((photo) => ({
        id: photo.id,
        kind: photo.kind,
        kindLabel: SUPPLIER_PHOTO_KIND_LABELS[photo.kind],
        url: photo.url,
        caption: photo.caption,
        takenAt: photo.takenAt.toISOString(),
        takenBy: photo.takenBy,
      })),
      verification: currentVerification(verifications),
      proofs: toProofs(verifications),
      levelHistory: levelHistory.map((change) => ({
        id: change.id,
        fromLevel: change.fromLevel,
        toLevel: change.toLevel,
        reason: change.reason,
        decidedAt: change.decidedAt.toISOString(),
      })),
      contactAccess: { granted, reason: granted ? CONTACT_UNLOCKED_REASON : CONTACT_LOCKED_REASON },
    };
  }

  /**
   * Coordonnées réservées (SUP-04, §17).
   * Le rôle est déjà contrôlé par le garde ; on le revérifie ici pour qu'aucun appel interne
   * ne puisse contourner la règle. Chaque consultation est journalisée.
   */
  async contact(id: string, userId: string, role: UserRole): Promise<SupplierContactResponse> {
    if (!canSeeContact(role)) {
      throw new ForbiddenException(CONTACT_LOCKED_REASON);
    }

    const contact = await this.prisma.supplierContact.findUnique({ where: { supplierId: id } });
    if (!contact) {
      throw new NotFoundException("Les coordonnées de ce fournisseur ne sont pas encore renseignées.");
    }

    const access = await this.prisma.supplierContactAccess.create({ data: { supplierId: id, userId } });

    return {
      supplierId: id,
      contactName: contact.contactName,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      wechat: contact.wechat,
      email: contact.email,
      website: contact.website,
      storeUrl: contact.storeUrl,
      addressLine: contact.addressLine,
      accessedAt: access.accessedAt.toISOString(),
    };
  }

  /**
   * Enregistrement d'une preuve et passage de niveau (SUP-02, §16).
   * Sans preuve, rien n'est écrit : aucun badge ne peut donc apparaître sans justification.
   */
  async recordVerification(
    id: string,
    body: RecordSupplierVerificationBody,
    decidedById: string,
  ): Promise<RecordSupplierVerificationResponse> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!supplier) throw new NotFoundException("Ce fournisseur n'existe pas ou n'est plus référencé.");

    const existing = await this.prisma.supplierVerification.findMany({
      where: { supplierId: id },
      select: { id: true, level: true, evidenceUrl: true, notes: true, verifiedAt: true },
    });
    const before = currentVerification(existing);

    if (!canPromoteTo(before?.level ?? null, body.level)) {
      throw new BadRequestException(promotionRefusalMessage(before?.level ?? null, body.level));
    }

    const verification = await this.prisma.supplierVerification.create({
      data: {
        supplierId: id,
        level: body.level,
        evidenceUrl: body.evidenceUrl,
        notes: body.notes ?? null,
        verifiedAt: new Date(body.verifiedAt),
        verifiedById: decidedById,
      },
      select: { id: true, level: true, evidenceUrl: true, notes: true, verifiedAt: true },
    });

    await this.prisma.supplierLevelChange.create({
      data: {
        supplierId: id,
        fromLevel: before?.level ?? null,
        toLevel: body.level,
        verificationId: verification.id,
        reason: body.reason,
        decidedById,
      },
    });

    const records = [...existing, verification];
    const history = await this.prisma.supplierLevelChange.findMany({
      where: { supplierId: id },
      orderBy: { decidedAt: 'desc' },
    });

    return {
      verification: currentVerification(records),
      proofs: toProofs(records),
      history: history.map((change) => ({
        id: change.id,
        fromLevel: change.fromLevel,
        toLevel: change.toLevel,
        reason: change.reason,
        decidedAt: change.decidedAt.toISOString(),
      })),
    };
  }

  /** « Demander un devis » et « Demander un sourcing » depuis la fiche (SUP-05). */
  async createRequest(
    id: string,
    body: CreateSupplierRequestBody,
    userId: string,
  ): Promise<SupplierRequestResponse> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id }, select: { name: true } });
    if (!supplier) throw new NotFoundException("Ce fournisseur n'existe pas ou n'est plus référencé.");

    const request = await this.prisma.supplierRequest.create({
      data: {
        reference: buildRequestReference(body.kind),
        supplierId: id,
        userId,
        kind: body.kind,
        productLabel: body.productLabel,
        quantity: body.quantity ?? null,
        budgetXafMinor: body.budgetXafMinor ?? null,
        city: body.city ?? null,
        details: body.details ?? null,
      },
    });

    return {
      reference: request.reference,
      kind: request.kind,
      kindLabel: SUPPLIER_REQUEST_KIND_LABELS[request.kind],
      status: request.status,
      supplierName: supplier.name,
      createdAt: request.createdAt.toISOString(),
      nextStep:
        body.kind === 'QUOTE'
          ? 'Notre équipe contacte ce fournisseur et vous transmet son prix, son MOQ et son délai.'
          : 'Notre équipe recherche et compare plusieurs fournisseurs pour ce produit, puis vous présente les offres.',
    };
  }

  /** Identifiants des fournisseurs dont au moins un produit correspond au filtre. */
  private async supplierIdsByOffering(where: Record<string, unknown>): Promise<string[]> {
    const rows = await this.prisma.supplierOffering.findMany({ where, select: { supplierId: true } });
    return [...new Set(rows.map((row) => row.supplierId))];
  }
}

/** Référence lisible : DEV pour un devis, SRC pour un sourcing. */
function buildRequestReference(kind: CreateSupplierRequestBody['kind']): string {
  const prefix = kind === 'QUOTE' ? 'DEV' : 'SRC';
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${new Date().getFullYear()}-${random}`;
}
