/**
 * DONNÉES DE DÉMONSTRATION — LOT SUP (fournisseurs).
 *
 * ⚠ Tous les fournisseurs créés par ce script sont FICTIFS. Leurs noms commencent par
 * « DÉMO — », leurs coordonnées pointent vers des domaines réservés aux exemples
 * (`example.invalid`) et aucun numéro n'est attribuable. Aucune entreprise réelle n'est
 * représentée ici, et aucun chiffre de ce fichier ne doit être présenté comme vérifié
 * ailleurs que dans une base de démonstration (§54 : aucune statistique inventée en production).
 *
 * Exécution (la compilation place le script dans `dist`, déjà ignoré par git) :
 *   pnpm --filter @ws/api exec tsc --outDir dist
 *   pnpm --filter @ws/api exec node dist/prisma/seed-suppliers.js
 *
 * Le script est idempotent : il supprime d'abord les fournisseurs de démonstration
 * précédents, puis les recrée.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/** Préfixe qui identifie sans ambiguïté un fournisseur de démonstration. */
const DEMO_PREFIX = 'DÉMO — ';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type DemoSupplier = {
  name: string;
  type: 'MANUFACTURER' | 'DISTRIBUTOR' | 'TRADING_COMPANY';
  city: string;
  moq: number;
  oem: boolean;
  sampleAvailable: boolean;
  leadTimeDays: number;
  publicSummary: string;
};

const SUPPLIERS: DemoSupplier[] = [
  {
    name: `${DEMO_PREFIX}Atelier d’accessoires (fictif)`,
    type: 'MANUFACTURER',
    city: 'Guangzhou',
    moq: 200,
    oem: true,
    sampleAvailable: true,
    leadTimeDays: 18,
    publicSummary: 'Fournisseur de démonstration : coques et accessoires de téléphone, personnalisation du logo.',
  },
  {
    name: `${DEMO_PREFIX}Négoce textile (fictif)`,
    type: 'TRADING_COMPANY',
    city: 'Yiwu',
    moq: 500,
    oem: false,
    sampleAvailable: true,
    leadTimeDays: 25,
    publicSummary: 'Fournisseur de démonstration : prêt-à-porter et chaussures, pas de personnalisation.',
  },
  {
    name: `${DEMO_PREFIX}Usine de petit électroménager (fictif)`,
    type: 'MANUFACTURER',
    city: 'Shenzhen',
    moq: 100,
    oem: true,
    sampleAvailable: false,
    leadTimeDays: 30,
    publicSummary: 'Fournisseur de démonstration : bouilloires et mixeurs, marque du client possible.',
  },
];

async function main() {
  // Nettoyage des données de démonstration précédentes.
  const previous = await prisma.supplier.findMany({
    where: { name: { startsWith: DEMO_PREFIX } },
    select: { id: true },
  });
  const ids = previous.map((supplier) => supplier.id);

  if (ids.length > 0) {
    const scope = { where: { supplierId: { in: ids } } };
    await prisma.supplierRequest.deleteMany(scope);
    await prisma.supplierContactAccess.deleteMany(scope);
    await prisma.supplierContact.deleteMany(scope);
    await prisma.supplierLevelChange.deleteMany(scope);
    await prisma.supplierPhoto.deleteMany(scope);
    await prisma.supplierShopLink.deleteMany(scope);
    await prisma.supplierTestOrder.deleteMany(scope);
    await prisma.supplierIncident.deleteMany(scope);
    await prisma.supplierDocument.deleteMany(scope);
    await prisma.supplierTerms.deleteMany(scope);
    await prisma.supplierOffering.deleteMany(scope);
    await prisma.supplierProfile.deleteMany(scope);
    await prisma.supplierVerification.deleteMany(scope);
    await prisma.supplier.deleteMany({ where: { id: { in: ids } } });
  }

  const [accessoires, textile, electromenager] = await Promise.all(
    SUPPLIERS.map((supplier) => prisma.supplier.create({ data: supplier, select: { id: true } })),
  );

  // ── Profils d'usine ──
  await prisma.supplierProfile.createMany({
    data: [
      {
        supplierId: accessoires.id,
        foundedYear: 2014,
        employeeCount: 60,
        factoryScale: 'SMALL',
        productionLines: 4,
        monthlyCapacity: 80_000,
        ownsFactory: true,
        exportExperienceYears: 8,
        province: 'Guangdong',
        certifications: ['CE (démonstration)'],
        mainMarkets: ['Afrique de l’Ouest', 'Afrique centrale'],
        languages: ['Chinois', 'Anglais'],
        responseTimeHours: 6,
        presentation: 'Données de démonstration. Atelier fictif utilisé pour illustrer la fiche fournisseur.',
        checkedAt: new Date('2026-08-12T00:00:00.000Z'),
      },
      {
        supplierId: textile.id,
        employeeCount: 12,
        factoryScale: 'WORKSHOP',
        ownsFactory: false,
        exportExperienceYears: 5,
        province: 'Zhejiang',
        certifications: [],
        mainMarkets: ['Afrique centrale'],
        languages: ['Chinois'],
        responseTimeHours: 24,
        presentation: 'Données de démonstration. Société de négoce fictive, sans usine en propre.',
        checkedAt: new Date('2026-07-02T00:00:00.000Z'),
      },
      {
        supplierId: electromenager.id,
        foundedYear: 2009,
        employeeCount: 320,
        factoryScale: 'MEDIUM',
        productionLines: 9,
        monthlyCapacity: 40_000,
        ownsFactory: true,
        exportExperienceYears: 14,
        province: 'Guangdong',
        certifications: ['ISO 9001 (démonstration)'],
        mainMarkets: ['Europe', 'Afrique centrale'],
        languages: ['Chinois', 'Anglais', 'Français'],
        responseTimeHours: 12,
        presentation: 'Données de démonstration. Usine fictive utilisée pour illustrer les niveaux de vérification.',
        checkedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ],
  });

  // ── Produits proposés ── (prix en fen : 1 CNY = 100 fen)
  await prisma.supplierOffering.createMany({
    data: [
      {
        supplierId: accessoires.id,
        name: 'Coque de téléphone silicone',
        category: 'ACCESSORIES',
        description: 'Exemple de produit. Personnalisation du logo possible.',
        unitPriceCnyMinor: 320,
        priceObservedAt: new Date('2026-08-12T00:00:00.000Z'),
        moq: 200,
        customizable: true,
        sampleAvailable: true,
        leadTimeDays: 18,
      },
      {
        supplierId: accessoires.id,
        name: 'Chargeur rapide 20 W',
        category: 'PHONES',
        description: 'Exemple de produit.',
        unitPriceCnyMinor: 1_150,
        priceObservedAt: new Date('2026-08-12T00:00:00.000Z'),
        moq: 300,
        customizable: false,
        sampleAvailable: true,
        leadTimeDays: 20,
      },
      {
        supplierId: textile.id,
        name: 'T-shirt coton imprimé',
        category: 'FASHION',
        description: 'Exemple de produit.',
        unitPriceCnyMinor: 1_800,
        priceObservedAt: new Date('2026-07-02T00:00:00.000Z'),
        moq: 500,
        customizable: false,
        sampleAvailable: true,
        leadTimeDays: 25,
      },
      {
        supplierId: electromenager.id,
        name: 'Bouilloire électrique 1,8 L',
        category: 'HOME',
        description: 'Exemple de produit. Marque du client possible à partir de 500 pièces.',
        unitPriceCnyMinor: 4_250,
        priceObservedAt: new Date('2026-09-01T00:00:00.000Z'),
        moq: 100,
        customizable: true,
        sampleAvailable: false,
        leadTimeDays: 30,
      },
    ],
  });

  // ── Conditions commerciales ──
  await prisma.supplierTerms.createMany({
    data: [
      {
        supplierId: accessoires.id,
        minOrderValueCnyMinor: 500_000,
        paymentTerms: ['DEPOSIT_30_70', 'ESCROW'],
        depositPercent: 30,
        sampleAvailable: true,
        sampleCostCnyMinor: 3_000,
        sampleLeadTimeDays: 5,
        customizationOptions: ['Logo imprimé', 'Couleur au choix'],
        packagingOptions: ['Sachet neutre', 'Boîte imprimée'],
        incoterms: ['EXW', 'FOB'],
        productionLeadTimeDays: 18,
        negotiable: true,
        checkedAt: new Date('2026-08-12T00:00:00.000Z'),
      },
      {
        supplierId: textile.id,
        minOrderValueCnyMinor: 900_000,
        paymentTerms: ['FULL_PREPAYMENT'],
        depositPercent: 100,
        sampleAvailable: true,
        sampleCostCnyMinor: 6_000,
        sampleLeadTimeDays: 7,
        customizationOptions: [],
        packagingOptions: ['Sachet neutre'],
        incoterms: ['EXW'],
        productionLeadTimeDays: 25,
        negotiable: false,
        checkedAt: new Date('2026-07-02T00:00:00.000Z'),
      },
      {
        supplierId: electromenager.id,
        minOrderValueCnyMinor: 2_000_000,
        paymentTerms: ['DEPOSIT_50_50'],
        depositPercent: 50,
        sampleAvailable: false,
        sampleLeadTimeDays: null,
        customizationOptions: ['Marque du client', 'Notice en français'],
        packagingOptions: ['Carton imprimé'],
        incoterms: ['FOB', 'CIF'],
        productionLeadTimeDays: 30,
        negotiable: true,
        checkedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ],
  });

  // ── Preuves de vérification et passages de niveau (§16) ──
  const identite = await prisma.supplierVerification.create({
    data: {
      supplierId: accessoires.id,
      level: 'IDENTITY_VERIFIED',
      evidenceUrl: 'https://exemple.invalid/demo/licence-entreprise.pdf',
      notes: 'Document de démonstration.',
      verifiedAt: new Date('2026-05-20T00:00:00.000Z'),
    },
  });
  const testFournisseur = await prisma.supplierVerification.create({
    data: {
      supplierId: accessoires.id,
      level: 'SUPPLIER_TESTED',
      evidenceUrl: 'https://exemple.invalid/demo/commande-test.pdf',
      notes: 'Commande test de démonstration.',
      verifiedAt: new Date('2026-08-12T00:00:00.000Z'),
    },
  });
  const identiteUsine = await prisma.supplierVerification.create({
    data: {
      supplierId: electromenager.id,
      level: 'IDENTITY_VERIFIED',
      evidenceUrl: 'https://exemple.invalid/demo/licence-usine.pdf',
      verifiedAt: new Date('2026-06-15T00:00:00.000Z'),
    },
  });
  // Le fournisseur textile n'a aucune preuve : sa fiche ne doit afficher aucun badge.

  await prisma.supplierLevelChange.createMany({
    data: [
      {
        supplierId: accessoires.id,
        fromLevel: null,
        toLevel: 'IDENTITY_VERIFIED',
        verificationId: identite.id,
        reason: 'Licence d’entreprise contrôlée (démonstration).',
        decidedAt: new Date('2026-05-20T00:00:00.000Z'),
      },
      {
        supplierId: accessoires.id,
        fromLevel: 'IDENTITY_VERIFIED',
        toLevel: 'SUPPLIER_TESTED',
        verificationId: testFournisseur.id,
        reason: 'Commande test réceptionnée (démonstration).',
        decidedAt: new Date('2026-08-12T00:00:00.000Z'),
      },
      {
        supplierId: electromenager.id,
        fromLevel: null,
        toLevel: 'IDENTITY_VERIFIED',
        verificationId: identiteUsine.id,
        reason: 'Licence d’entreprise contrôlée (démonstration).',
        decidedAt: new Date('2026-06-15T00:00:00.000Z'),
      },
    ],
  });

  // ── Documents, incidents, commandes test, photos ──
  await prisma.supplierDocument.createMany({
    data: [
      {
        supplierId: accessoires.id,
        kind: 'BUSINESS_LICENSE',
        label: 'Licence d’entreprise (démonstration)',
        fileUrl: 'https://exemple.invalid/demo/licence-entreprise.pdf',
        issuedAt: new Date('2014-03-01T00:00:00.000Z'),
        verifiedAt: new Date('2026-05-20T00:00:00.000Z'),
        isPublic: true,
      },
      {
        supplierId: electromenager.id,
        kind: 'FACTORY_AUDIT',
        label: 'Rapport de visite d’usine (démonstration)',
        fileUrl: 'https://exemple.invalid/demo/audit-usine.pdf',
        verifiedAt: new Date('2026-06-15T00:00:00.000Z'),
        isPublic: true,
      },
    ],
  });

  await prisma.supplierIncident.createMany({
    data: [
      {
        supplierId: textile.id,
        occurredAt: new Date('2026-04-18T00:00:00.000Z'),
        severity: 'MAJOR',
        status: 'OPEN',
        summary: 'Incident de démonstration : retard de production de 12 jours sans information préalable.',
      },
      {
        supplierId: accessoires.id,
        occurredAt: new Date('2026-02-09T00:00:00.000Z'),
        severity: 'MINOR',
        status: 'RESOLVED',
        summary: 'Incident de démonstration : erreur de couleur sur une partie du lot.',
        resolution: 'Lot remplacé aux frais du fournisseur.',
        resolvedAt: new Date('2026-03-02T00:00:00.000Z'),
      },
    ],
  });

  await prisma.supplierTestOrder.create({
    data: {
      supplierId: accessoires.id,
      orderedAt: new Date('2026-07-10T00:00:00.000Z'),
      receivedAt: new Date('2026-08-05T00:00:00.000Z'),
      productLabel: 'Coque de téléphone silicone',
      quantity: 200,
      amountCnyMinor: 64_000,
      outcome: 'CONFORMING',
      inspectionReportUrl: 'https://exemple.invalid/demo/commande-test.pdf',
      notes: 'Commande test de démonstration.',
    },
  });

  await prisma.supplierPhoto.createMany({
    data: [
      {
        supplierId: accessoires.id,
        kind: 'PRODUCTION_LINE',
        url: 'https://exemple.invalid/demo/photo-ligne-production.jpg',
        caption: 'Photo de démonstration.',
        takenAt: new Date('2026-08-12T00:00:00.000Z'),
        takenBy: 'Agent Chine (démonstration)',
      },
      {
        supplierId: electromenager.id,
        kind: 'FACTORY',
        url: 'https://exemple.invalid/demo/photo-usine.jpg',
        caption: 'Photo de démonstration.',
        takenAt: new Date('2026-06-15T00:00:00.000Z'),
        takenBy: 'Agent Chine (démonstration)',
      },
    ],
  });

  /*
   * Boutiques en ligne, publiques (§17 ne protège que les coordonnées directes).
   *
   * Les adresses pointent vers `exemple.invalid`, un domaine réservé qui ne résout
   * jamais : une démonstration ne doit pas envoyer qui que ce soit vers une vraie
   * boutique qu'on n'a ni contrôlée ni le droit de recommander. `checkedAt` reste nul,
   * donc la fiche affiche « ce lien n'a pas encore été vérifié » — ce qui est exact.
   */
  await prisma.supplierShopLink.createMany({
    data: [
      {
        supplierId: accessoires.id,
        platform: 'C1688',
        url: 'https://exemple.invalid/demo/1688/atelier-accessoires',
        label: 'Boutique de démonstration',
        position: 0,
      },
      {
        supplierId: accessoires.id,
        platform: 'ALIBABA',
        url: 'https://exemple.invalid/demo/alibaba/atelier-accessoires',
        label: null,
        position: 1,
      },
      {
        supplierId: electromenager.id,
        platform: 'MADE_IN_CHINA',
        url: 'https://exemple.invalid/demo/mic/petit-electromenager',
        label: null,
        position: 0,
      },
    ],
  });

  // ── Coordonnées protégées : fictives, jamais renvoyées sans droit vérifié (§17) ──
  await prisma.supplierContact.createMany({
    data: [
      {
        supplierId: accessoires.id,
        contactName: 'Contact de démonstration',
        phone: '+86 000 0000 0001',
        whatsapp: '+86 000 0000 0001',
        wechat: 'demo-accessoires',
        email: 'contact@exemple.invalid',
        website: 'https://exemple.invalid/demo-accessoires',
        addressLine: 'Adresse de démonstration, Guangzhou',
      },
      {
        supplierId: textile.id,
        contactName: 'Contact de démonstration',
        phone: '+86 000 0000 0002',
        email: 'contact@exemple.invalid',
        addressLine: 'Adresse de démonstration, Yiwu',
      },
      {
        supplierId: electromenager.id,
        contactName: 'Contact de démonstration',
        phone: '+86 000 0000 0003',
        wechat: 'demo-electromenager',
        email: 'contact@exemple.invalid',
        addressLine: 'Adresse de démonstration, Shenzhen',
      },
    ],
  });

  console.log(`Données de démonstration créées : ${SUPPLIERS.length} fournisseurs fictifs (préfixe « ${DEMO_PREFIX}»).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
