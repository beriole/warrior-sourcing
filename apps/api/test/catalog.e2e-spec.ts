import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/bootstrap.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { CatalogModule } from '../src/catalog/catalog.module.js';
import { validateEnv } from '../src/config/env.js';
import { MailModule } from '../src/mail/mail.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Catalogue d'opportunités (lot CAT) : un onglet, un filtre, une fiche, une simulation.
 *
 * Les produits du test portent tous la catégorie `OTHER` et un identifiant d'URL préfixé :
 * les assertions restent vraies quel que soit le contenu déjà présent en base.
 * Nécessite la base de développement (pnpm db:create && pnpm db:migrate).
 */
const PREFIX = 'e2e-cat-';

/** Coûts rendus attendus, recalculés à la main depuis les hypothèses publiées. */
const LEGER_UNIT_COST = 1_502;
const LEGER_MOQ_TOTAL = 15_020;

describe('Catalogue (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // On monte le module du lot avec ses dépendances réelles (base, session, configuration)
    // plutôt que le module racine : un lot voisin en cours d'écriture ne fait pas
    // échouer les tests du catalogue. Le branchement au module racine est déjà fait dans app.module.ts.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        MailModule.register(false),
        AuthModule,
        CatalogModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });

    // Produit léger, bon marché, demandé, peu concurrencé et peu risqué.
    const leger = await prisma.product.create({
      data: {
        slug: `${PREFIX}leger`,
        name: 'Produit de test léger',
        description: 'Produit créé par les tests automatisés.',
        category: 'OTHER',
        status: 'PUBLISHED',
        purchasePriceMinor: 1_000,
        purchaseCurrency: 'XAF',
        purchasePriceXaf: 1_000,
        exchangeRate: 1,
        exchangeRateAt: new Date('2026-09-01T00:00:00.000Z'),
        exchangeRateSource: 'Test automatisé',
        moq: 10,
        weightGrams: 100,
        volumeCm3: 200,
        badges: ['LOW_MOQ', 'LIGHT_WEIGHT'],
        watchPoints: ['Point de vigilance de test.'],
        supplierIds: ['fournisseur-de-test'],
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
        images: { create: [{ url: 'data:image/svg+xml;utf8,<svg/>', alt: 'Image de test', position: 0 }] },
        marketData: {
          create: {
            localPriceMinXaf: 4_000,
            localPriceMaxXaf: 5_000,
            localPriceObservedAt: new Date('2026-09-10T00:00:00.000Z'),
            localPriceSource: 'Relevé de test',
            localPriceProvenance: 'VERIFIED',
            demand: 'HIGH',
            competition: 'LOW',
            risk: 'LOW',
            transportEase: 'EASY',
            capitalRequiredXaf: 50_000,
            assessedAt: new Date('2026-09-10T00:00:00.000Z'),
            assessmentSource: 'Appréciation de test',
          },
        },
      },
    });

    // Produit lourd, cher, peu demandé, très concurrencé et risqué.
    await prisma.product.create({
      data: {
        slug: `${PREFIX}lourd`,
        name: 'Produit de test lourd',
        description: 'Produit créé par les tests automatisés.',
        category: 'OTHER',
        status: 'PUBLISHED',
        purchasePriceMinor: 20_000,
        purchaseCurrency: 'XAF',
        purchasePriceXaf: 20_000,
        exchangeRate: 1,
        exchangeRateAt: new Date('2026-09-01T00:00:00.000Z'),
        exchangeRateSource: 'Test automatisé',
        moq: 50,
        weightGrams: 5_000,
        volumeCm3: 40_000,
        badges: ['FRAGILE'],
        watchPoints: [],
        supplierIds: [],
        publishedAt: new Date('2026-09-02T00:00:00.000Z'),
        marketData: {
          create: {
            localPriceMinXaf: 40_000,
            localPriceMaxXaf: 50_000,
            localPriceObservedAt: new Date('2026-09-05T00:00:00.000Z'),
            localPriceSource: 'Relevé de test',
            demand: 'LOW',
            competition: 'HIGH',
            risk: 'HIGH',
            transportEase: 'DIFFICULT',
            assessedAt: new Date('2026-09-05T00:00:00.000Z'),
            assessmentSource: 'Appréciation de test',
          },
        },
      },
    });

    // Produit sans aucune donnée de marché : l'API doit renvoyer l'absence, pas un chiffre.
    await prisma.product.create({
      data: {
        slug: `${PREFIX}sans-donnees`,
        name: 'Produit de test sans donnée de marché',
        description: 'Produit créé par les tests automatisés.',
        category: 'OTHER',
        status: 'PUBLISHED',
        purchasePriceMinor: 5_000,
        purchaseCurrency: 'XAF',
        purchasePriceXaf: 5_000,
        exchangeRate: 1,
        exchangeRateAt: new Date('2026-09-01T00:00:00.000Z'),
        exchangeRateSource: 'Test automatisé',
        moq: 25,
        weightGrams: 300,
        volumeCm3: null,
        badges: [],
        watchPoints: [],
        supplierIds: [],
        publishedAt: new Date('2026-09-19T00:00:00.000Z'),
      },
    });

    // Brouillon : ne doit jamais apparaître ni être consultable.
    await prisma.product.create({
      data: {
        slug: `${PREFIX}brouillon`,
        name: 'Produit de test non publié',
        description: 'Produit créé par les tests automatisés.',
        category: 'OTHER',
        status: 'DRAFT',
        purchasePriceMinor: 1_000,
        purchaseCurrency: 'XAF',
        purchasePriceXaf: 1_000,
        exchangeRate: 1,
        exchangeRateAt: new Date('2026-09-01T00:00:00.000Z'),
        exchangeRateSource: 'Test automatisé',
        moq: 10,
        weightGrams: 100,
        volumeCm3: null,
        badges: [],
        watchPoints: [],
        supplierIds: [],
        publishedAt: new Date('2026-09-20T00:00:00.000Z'),
      },
    });

    expect(leger.id).toBeDefined();
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await app.close();
  });

  /** Raccourci : la liste restreinte aux produits du test. */
  const list = (query: Record<string, string | number>) =>
    request(app.getHttpServer())
      .get('/v1/catalog/products')
      .query({ category: 'OTHER', perPage: 24, ...query })
      .expect(200);

  const slugs = (body: { items: { slug: string }[] }) => body.items.map((item) => item.slug);

  describe('Onglets', () => {
    it('« Pour vous » sans session : liste non personnalisée et explication claire', async () => {
      const response = await list({ tab: 'FOR_YOU' });

      expect(response.body.tab).toBe('FOR_YOU');
      expect(response.body.tabLabel).toBe('Pour vous');
      expect(response.body.personalized).toBe(false);
      expect(response.body.personalizationNote).toContain('profil');
      // Repli annoncé : du moins cher au plus cher à la commande minimum.
      expect(slugs(response.body)).toEqual([`${PREFIX}leger`, `${PREFIX}sans-donnees`, `${PREFIX}lourd`]);
    });

    it('« Tendances » classe par demande relevée', async () => {
      const response = await list({ tab: 'TRENDING' });

      expect(slugs(response.body)[0]).toBe(`${PREFIX}leger`);
      expect(slugs(response.body).at(-1)).toBe(`${PREFIX}sans-donnees`);
    });

    it('« Nouveautés » classe par date de publication', async () => {
      const response = await list({ tab: 'NEW' });

      expect(slugs(response.body)).toEqual([`${PREFIX}sans-donnees`, `${PREFIX}lourd`, `${PREFIX}leger`]);
    });

    it('« Faible budget » classe par investissement minimum', async () => {
      const response = await list({ tab: 'LOW_BUDGET' });

      expect(slugs(response.body)).toEqual([`${PREFIX}leger`, `${PREFIX}sans-donnees`, `${PREFIX}lourd`]);
      expect(response.body.items[0].minimumOrder.totalXaf).toBe(LEGER_MOQ_TOTAL);
    });

    it('« Forte marge » place en tête la meilleure marge estimée', async () => {
      const response = await list({ tab: 'HIGH_MARGIN' });

      expect(slugs(response.body)[0]).toBe(`${PREFIX}leger`);
      // Sans prix local relevé, pas de marge : le produit passe derrière, sans chiffre inventé.
      expect(slugs(response.body).at(-1)).toBe(`${PREFIX}sans-donnees`);
      expect(response.body.items[0].potentialMargin.provenance).toBe('ESTIMATE');
    });

    it('« Faible concurrence » classe par concurrence relevée', async () => {
      const response = await list({ tab: 'LOW_COMPETITION' });

      expect(slugs(response.body)).toEqual([`${PREFIX}leger`, `${PREFIX}lourd`, `${PREFIX}sans-donnees`]);
    });

    it('refuse un onglet inconnu avec un message lisible', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/catalog/products')
        .query({ tab: 'MEILLEURES_AFFAIRES' })
        .expect(400);

      expect(response.body.message).toBe('Certaines informations sont invalides.');
      expect(response.body.issues[0].path).toBe('tab');
    });
  });

  describe('Filtres', () => {
    it('filtre par catégorie', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/catalog/products')
        .query({ category: 'OTHER', perPage: 24 })
        .expect(200);

      expect(response.body.items.every((item: { category: string }) => item.category === 'OTHER')).toBe(true);
    });

    it('filtre par budget disponible', async () => {
      const response = await list({ budgetMaxXaf: 20_000 });

      expect(slugs(response.body)).toEqual([`${PREFIX}leger`]);
    });

    it('filtre par quantité minimum acceptée', async () => {
      const response = await list({ moqMax: 10 });

      expect(slugs(response.body)).toEqual([`${PREFIX}leger`]);
    });

    it('filtre par marge estimée minimum', async () => {
      const response = await list({ marginMinPercent: 100 });

      expect(slugs(response.body)).toEqual([`${PREFIX}leger`]);
    });

    it('filtre par risque maximum', async () => {
      const response = await list({ riskMax: 'LOW' });

      expect(slugs(response.body)).toEqual([`${PREFIX}leger`]);
    });

    it('filtre par poids maximum', async () => {
      const response = await list({ weightMaxGrams: 200 });

      expect(slugs(response.body)).toEqual([`${PREFIX}leger`]);
    });

    it('filtre par facilité de transport', async () => {
      const response = await list({ transportEase: 'DIFFICULT' });

      expect(slugs(response.body)).toEqual([`${PREFIX}lourd`]);
    });

    it('pagine sans changer l’ordre', async () => {
      const première = await list({ tab: 'LOW_BUDGET', perPage: 1, page: 1 });
      const deuxième = await list({ tab: 'LOW_BUDGET', perPage: 1, page: 2 });
      const répétition = await list({ tab: 'LOW_BUDGET', perPage: 1, page: 1 });

      expect(première.body.total).toBe(3);
      expect(première.body.totalPages).toBe(3);
      expect(slugs(première.body)).toEqual([`${PREFIX}leger`]);
      expect(slugs(deuxième.body)).toEqual([`${PREFIX}sans-donnees`]);
      // Tri stable : deux appels identiques renvoient la même page.
      expect(slugs(répétition.body)).toEqual(slugs(première.body));
    });
  });

  describe('Fiche produit', () => {
    it('renvoie la fiche avec ses coûts estimés et ses hypothèses', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${PREFIX}leger`)
        .expect(200);

      const { product } = response.body;
      expect(product.name).toBe('Produit de test léger');
      expect(product.minimumOrder.unitXaf).toBe(LEGER_UNIT_COST);
      expect(product.minimumOrder.provenance).toBe('ESTIMATE');
      expect(product.costAssumptions.length).toBeGreaterThan(0);
      expect(product.localPrice.observedAt).toBe('2026-09-10T00:00:00.000Z');
      expect(product.localPrice.source).toBe('Relevé de test');
      expect(product.potentialMargin.unitMarginXaf).toBe(4_000 - LEGER_UNIT_COST);
      expect(product.supplierIds).toEqual(['fournisseur-de-test']);
      expect(product.watchPoints).toHaveLength(1);
      expect(product.estimateWarning).toContain('estimation');
    });

    it('affiche l’absence de donnée de marché au lieu de l’inventer', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${PREFIX}sans-donnees`)
        .expect(200);

      expect(response.body.product.localPrice).toBeNull();
      expect(response.body.product.potentialMargin).toBeNull();
      expect(response.body.product.market).toBeNull();
    });

    it('ne sert ni un produit inconnu ni un brouillon', async () => {
      await request(app.getHttpServer()).get('/v1/catalog/products/produit-inexistant').expect(404);
      await request(app.getHttpServer()).get(`/v1/catalog/products/${PREFIX}brouillon`).expect(404);
    });
  });

  describe('Simulateur d’investissement', () => {
    it('transforme un budget en quantité, marge, ROI et seuil de rentabilité', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/catalog/products/${PREFIX}leger/simulate`)
        .send({ budgetXaf: 100_000 })
        .expect(200);

      expect(response.body.provenance).toBe('ESTIMATE');
      expect(response.body.warning).toContain('estimation');
      expect(response.body.quantity).toBe(66);
      expect(response.body.belowMinimumOrder).toBe(false);
      expect(response.body.unitLandedCostXaf).toBe(LEGER_UNIT_COST);
      expect(response.body.totalInvestmentXaf).toBe(99_132);
      expect(response.body.sale.unitSellingPriceXaf).toBe(4_000);
      expect(response.body.sale.potentialRevenueXaf).toBe(264_000);
      expect(response.body.sale.totalMarginXaf).toBe(264_000 - 99_132);
      expect(response.body.sale.breakEvenUnits).toBe(25);
      expect(response.body.sale.basedOnPriceObservedAt).toBe('2026-09-10T00:00:00.000Z');
    });

    it('signale un budget inférieur à la commande minimum', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/catalog/products/${PREFIX}leger/simulate`)
        .send({ budgetXaf: 5_000 })
        .expect(200);

      expect(response.body.belowMinimumOrder).toBe(true);
      expect(response.body.quantity).toBe(10);
      expect(response.body.totalInvestmentXaf).toBe(LEGER_MOQ_TOTAL);
      expect(response.body.remainingBudgetXaf).toBe(0);
    });

    it('n’invente pas de chiffre d’affaires sans prix local relevé', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/catalog/products/${PREFIX}sans-donnees/simulate`)
        .send({ budgetXaf: 500_000 })
        .expect(200);

      expect(response.body.sale).toBeNull();
      expect(response.body.saleUnavailableReason).toContain('prix local');
    });

    it('refuse un budget invalide avec un message lisible', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/catalog/products/${PREFIX}leger/simulate`)
        .send({ budgetXaf: -1 })
        .expect(400);

      expect(response.body.message).toBe('Certaines informations sont invalides.');
      expect(response.body.issues[0].path).toBe('budgetXaf');
    });
  });
});
