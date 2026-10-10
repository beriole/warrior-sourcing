import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_PHOTO_KIND_LABELS,
  SUPPLIER_SHOP_PLATFORM_LABELS,
  SUPPLIER_VERIFICATION_LABELS,
  SUPPLIER_VERIFICATION_LEVELS,
  type AdminSupplierDetailResponse,
  type AdminSupplierLevelChange,
  type AdminSupplierListResponse,
  type AdminSupplierResponse,
  type AdminSupplierSearchQuery,
  type AdminSupplierVerification,
  type ChangeSupplierLevelRequest,
  type ChangeSupplierLevelResponse,
  type SupplierType,
  type SupplierVerificationLevel,
  type CreateSupplierRequest,
  type SupplierPhotoInput,
  type SupplierShopLinkInput,
  type UpdateSupplierRequest,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

/** Rang d'un niveau dans l'échelle de confiance : sert à dire si on monte ou si on descend. */
function rang(niveau: SupplierVerificationLevel): number {
  return SUPPLIER_VERIFICATION_LEVELS.indexOf(niveau);
}

type LigneVerification = {
  id: string;
  level: SupplierVerificationLevel;
  evidenceUrl: string | null;
  notes: string | null;
  verifiedAt: Date;
  verifiedById: string | null;
};

type LigneFournisseur = {
  id: string;
  name: string;
  type: SupplierType;
  city: string;
  moq: number | null;
  oem: boolean;
  sampleAvailable: boolean;
  leadTimeDays: number | null;
  publicSummary: string | null;
  logoUrl: string | null;
  updatedAt: Date;
  verifications: LigneVerification[];
};

/**
 * Fournisseurs et niveaux de vérification (ADM-04, §16).
 *
 * Le cahier des charges interdit le badge « vérifié » vague : chaque niveau dit ce qui a
 * été contrôlé. Ce service en tire la conséquence pratique — **aucun niveau ne s'obtient
 * sans preuve consultable**. La preuve est enregistrée d'abord, le changement de niveau
 * la référence ensuite ; il n'existe donc pas de chemin, même administratif, qui produise
 * un badge sans document derrière.
 *
 * Une rétrogradation suit exactement la même exigence. Retirer un badge engage autant que
 * l'accorder : le fournisseur a le droit de savoir sur quel constat on s'appuie.
 */
@Injectable()
export class AdminSuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Le niveau atteint est le plus haut jamais prouvé, pas le dernier saisi. */
  private niveauActuel(verifications: LigneVerification[]): LigneVerification | null {
    if (verifications.length === 0) return null;
    return verifications.reduce((meilleur, candidat) =>
      rang(candidat.level) > rang(meilleur.level) ? candidat : meilleur,
    );
  }

  private format(row: LigneFournisseur): AdminSupplierResponse {
    const actuel = this.niveauActuel(row.verifications);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      typeLabel: SUPPLIER_TYPE_LABELS[row.type],
      city: row.city,
      moq: row.moq,
      oem: row.oem,
      sampleAvailable: row.sampleAvailable,
      leadTimeDays: row.leadTimeDays,
      publicSummary: row.publicSummary,
      logoUrl: row.logoUrl,
      currentLevel: actuel?.level ?? null,
      currentLevelLabel: actuel ? SUPPLIER_VERIFICATION_LABELS[actuel.level].label : null,
      currentLevelSince: actuel?.verifiedAt.toISOString() ?? null,
      verificationCount: row.verifications.length,
      unverified: row.verifications.length === 0,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private formatVerification(
    row: LigneVerification,
    nomsParId: Map<string, string>,
  ): AdminSupplierVerification {
    return {
      id: row.id,
      level: row.level,
      levelLabel: SUPPLIER_VERIFICATION_LABELS[row.level].label,
      levelMeaning: SUPPLIER_VERIFICATION_LABELS[row.level].meaning,
      evidenceUrl: row.evidenceUrl,
      notes: row.notes,
      verifiedAt: row.verifiedAt.toISOString(),
      verifiedByName: row.verifiedById ? (nomsParId.get(row.verifiedById) ?? null) : null,
    };
  }

  async list(query: AdminSupplierSearchQuery): Promise<AdminSupplierListResponse> {
    const where = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' as const } } : {}),
      ...(query.recherche
        ? {
            OR: [
              { name: { contains: query.recherche, mode: 'insensitive' as const } },
              { city: { contains: query.recherche, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.level === 'aucun'
        ? { verifications: { none: {} } }
        : query.level
          ? { verifications: { some: { level: query.level } } }
          : {}),
    };

    const [rows, total, toutes] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        include: { verifications: true },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.supplier.count({ where }),
      // La répartition porte sur tout le fichier, pas sur la page : c'est elle qui dit
      // combien de fiches attendent encore une preuve.
      this.prisma.supplier.findMany({ select: { city: true, verifications: { select: { level: true } } } }),
    ]);

    const compteurs = new Map<SupplierVerificationLevel | null, number>();
    for (const fournisseur of toutes) {
      const niveaux = fournisseur.verifications.map((v) => v.level as SupplierVerificationLevel);
      const atteint =
        niveaux.length === 0
          ? null
          : niveaux.reduce((haut, candidat) => (rang(candidat) > rang(haut) ? candidat : haut));
      compteurs.set(atteint, (compteurs.get(atteint) ?? 0) + 1);
    }

    return {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      items: rows.map((row) => this.format(row as unknown as LigneFournisseur)),
      byLevel: [...compteurs.entries()].map(([level, count]) => ({ level, count })),
      cities: [...new Set(toutes.map((f) => f.city))].sort((a, b) => a.localeCompare(b, 'fr')),
    };
  }

  /** Noms des membres de l'équipe cités dans un historique, en une seule requête. */
  private async noms(ids: (string | null)[]): Promise<Map<string, string>> {
    const uniques = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (uniques.length === 0) return new Map();
    const comptes = await this.prisma.user.findMany({
      where: { id: { in: uniques } },
      select: { id: true, name: true },
    });
    return new Map(comptes.map((compte) => [compte.id, compte.name]));
  }

  async detail(id: string): Promise<AdminSupplierDetailResponse> {
    const row = await this.prisma.supplier.findUnique({
      where: { id },
      include: { verifications: { orderBy: { verifiedAt: 'desc' } } },
    });
    if (!row) throw new NotFoundException('Ce fournisseur n’existe pas.');

    const [changements, photos, boutiques] = await Promise.all([
      this.prisma.supplierLevelChange.findMany({
        where: { supplierId: id },
        orderBy: { decidedAt: 'desc' },
      }),
      this.prisma.supplierPhoto.findMany({ where: { supplierId: id }, orderBy: { takenAt: 'desc' } }),
      this.prisma.supplierShopLink.findMany({
        where: { supplierId: id },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const nomsParId = await this.noms([
      ...row.verifications.map((v) => v.verifiedById),
      ...changements.map((c) => c.decidedById),
    ]);

    return {
      supplier: this.format(row as unknown as LigneFournisseur),
      verifications: row.verifications.map((v) =>
        this.formatVerification(v as LigneVerification, nomsParId),
      ),
      changes: changements.map((c) => this.formatChangement(c, nomsParId)),
      photos: photos.map((photo) => ({
        id: photo.id,
        kind: photo.kind,
        kindLabel: SUPPLIER_PHOTO_KIND_LABELS[photo.kind],
        url: photo.url,
        caption: photo.caption,
        takenAt: photo.takenAt.toISOString(),
        takenBy: photo.takenBy,
      })),
      shopLinks: boutiques.map((boutique) => ({
        id: boutique.id,
        platform: boutique.platform,
        platformLabel: SUPPLIER_SHOP_PLATFORM_LABELS[boutique.platform],
        url: boutique.url,
        label: boutique.label,
        checkedAt: boutique.checkedAt?.toISOString() ?? null,
        position: boutique.position,
      })),
    };
  }

  private formatChangement(
    row: {
      id: string;
      fromLevel: string | null;
      toLevel: string;
      reason: string;
      decidedById: string | null;
      decidedAt: Date;
    },
    nomsParId: Map<string, string>,
  ): AdminSupplierLevelChange {
    const depuis = row.fromLevel as SupplierVerificationLevel | null;
    const vers = row.toLevel as SupplierVerificationLevel;
    return {
      id: row.id,
      fromLevel: depuis,
      fromLevelLabel: depuis ? SUPPLIER_VERIFICATION_LABELS[depuis].label : null,
      toLevel: vers,
      toLevelLabel: SUPPLIER_VERIFICATION_LABELS[vers].label,
      reason: row.reason,
      decidedByName: row.decidedById ? (nomsParId.get(row.decidedById) ?? null) : null,
      decidedAt: row.decidedAt.toISOString(),
      demotion: depuis !== null && rang(vers) < rang(depuis),
    };
  }

  async update(
    id: string,
    input: UpdateSupplierRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminSupplierDetailResponse> {
    const existant = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Ce fournisseur n’existe pas.');

    await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.moq !== undefined ? { moq: input.moq } : {}),
        ...(input.oem !== undefined ? { oem: input.oem } : {}),
        ...(input.sampleAvailable !== undefined ? { sampleAvailable: input.sampleAvailable } : {}),
        ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
        ...(input.publicSummary !== undefined ? { publicSummary: input.publicSummary } : {}),
        // Chaîne vide : on retire l'image plutôt que d'enregistrer une URL vide, qui
        // produirait une balise image cassée sur chaque carte.
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'supplier.update',
      entity: 'Supplier',
      entityId: id,
      metadata: { champs: Object.keys(input) },
      ipAddress: ip,
    });

    return this.detail(id);
  }

  /**
   * Changement de niveau. La preuve et le changement sont écrits dans la même transaction :
   * il ne doit pas exister d'instant où un niveau est enregistré sans la ligne de preuve
   * qui le justifie, même si l'écriture échoue à mi-chemin.
   */
  async changeLevel(
    id: string,
    input: ChangeSupplierLevelRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<ChangeSupplierLevelResponse> {
    const fournisseur = await this.prisma.supplier.findUnique({
      where: { id },
      include: { verifications: true },
    });
    if (!fournisseur) throw new NotFoundException('Ce fournisseur n’existe pas.');

    const avant = this.niveauActuel(fournisseur.verifications as LigneVerification[]);

    const { verification, changement } = await this.prisma.$transaction(async (tx) => {
      const verification = await tx.supplierVerification.create({
        data: {
          supplierId: id,
          level: input.level,
          evidenceUrl: input.evidenceUrl,
          notes: input.notes,
          verifiedAt: new Date(input.verifiedAt),
          verifiedById: acteur.id,
        },
      });

      const changement = await tx.supplierLevelChange.create({
        data: {
          supplierId: id,
          fromLevel: avant?.level ?? null,
          toLevel: input.level,
          verificationId: verification.id,
          reason: input.reason,
          decidedById: acteur.id,
        },
      });

      return { verification, changement };
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'supplier.level',
      entity: 'Supplier',
      entityId: id,
      metadata: {
        depuis: avant?.level ?? null,
        vers: input.level,
        preuve: input.evidenceUrl,
        motif: input.reason,
      },
      ipAddress: ip,
    });

    const apres = await this.prisma.supplier.findUniqueOrThrow({
      where: { id },
      include: { verifications: true },
    });
    const nomsParId = await this.noms([acteur.id]);

    return {
      supplier: this.format(apres as unknown as LigneFournisseur),
      verification: this.formatVerification(verification as LigneVerification, nomsParId),
      change: this.formatChangement(changement, nomsParId),
    };
  }

  // ───────── Création et contenus (ADM-04) ─────────

  /**
   * Crée un fournisseur.
   *
   * Il naît **sans niveau de vérification** : le niveau s'obtient par la route dédiée, qui
   * exige une preuve consultable (§16). Pouvoir créer un fournisseur déjà badgé viderait le
   * badge de son sens, puisqu'il suffirait de le déclarer.
   */
  async create(
    input: CreateSupplierRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminSupplierDetailResponse> {
    const cree = await this.prisma.supplier.create({
      data: {
        name: input.name,
        type: input.type,
        city: input.city,
        moq: input.moq,
        oem: input.oem,
        sampleAvailable: input.sampleAvailable,
        leadTimeDays: input.leadTimeDays,
        publicSummary: input.publicSummary,
        logoUrl: input.logoUrl || null,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'supplier.create',
      entity: 'Supplier',
      entityId: cree.id,
      metadata: { nom: input.name, ville: input.city },
      ipAddress: ip,
    });

    return this.detail(cree.id);
  }

  /** Photos de la fiche. Date et auteur sont exigés par le contrat : sans eux, pas de preuve. */
  async addPhoto(
    id: string,
    input: SupplierPhotoInput,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminSupplierDetailResponse> {
    await this.existant(id);

    await this.prisma.supplierPhoto.create({
      data: {
        supplierId: id,
        kind: input.kind,
        url: input.url,
        caption: input.caption,
        takenAt: new Date(input.takenAt),
        takenBy: input.takenBy,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'supplier.photo.add',
      entity: 'Supplier',
      entityId: id,
      metadata: { nature: input.kind },
      ipAddress: ip,
    });

    return this.detail(id);
  }

  async removePhoto(
    id: string,
    photoId: string,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminSupplierDetailResponse> {
    await this.existant(id);
    await this.prisma.supplierPhoto.deleteMany({ where: { id: photoId, supplierId: id } });

    await this.audit.record({
      actorId: acteur.id,
      action: 'supplier.photo.remove',
      entity: 'Supplier',
      entityId: id,
      metadata: { photoId },
      ipAddress: ip,
    });

    return this.detail(id);
  }

  /**
   * Boutique en ligne. `upsert` sur le couple fournisseur + URL : ressaisir la même adresse
   * met à jour le libellé et la date de contrôle au lieu de créer un doublon, parce que
   * c'est ce que quelqu'un qui recolle un lien veut dire.
   */
  async addShopLink(
    id: string,
    input: SupplierShopLinkInput,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminSupplierDetailResponse> {
    await this.existant(id);

    await this.prisma.supplierShopLink.upsert({
      where: { supplierId_url: { supplierId: id, url: input.url } },
      create: {
        supplierId: id,
        platform: input.platform,
        url: input.url,
        label: input.label,
        checkedAt: input.checkedAt ? new Date(input.checkedAt) : null,
        position: input.position,
      },
      update: {
        platform: input.platform,
        label: input.label,
        checkedAt: input.checkedAt ? new Date(input.checkedAt) : null,
        position: input.position,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'supplier.shop.add',
      entity: 'Supplier',
      entityId: id,
      metadata: { plateforme: input.platform, url: input.url },
      ipAddress: ip,
    });

    return this.detail(id);
  }

  async removeShopLink(
    id: string,
    linkId: string,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminSupplierDetailResponse> {
    await this.existant(id);
    await this.prisma.supplierShopLink.deleteMany({ where: { id: linkId, supplierId: id } });

    await this.audit.record({
      actorId: acteur.id,
      action: 'supplier.shop.remove',
      entity: 'Supplier',
      entityId: id,
      metadata: { linkId },
      ipAddress: ip,
    });

    return this.detail(id);
  }

  /** Garde-fou commun : on ne modifie pas le contenu d'un fournisseur qui n'existe pas. */
  private async existant(id: string): Promise<void> {
    const trouve = await this.prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!trouve) throw new NotFoundException('Ce fournisseur n\u2019existe pas.');
  }
}
