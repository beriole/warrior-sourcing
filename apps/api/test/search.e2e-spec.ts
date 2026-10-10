import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module.js';
import { AUTH_BASE_PATH, type Auth } from '../src/auth/auth.config.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import { OtpSender } from '../src/auth/otp-sender.js';
import { configureApp } from '../src/bootstrap.js';
import { validateEnv } from '../src/config/env.js';
import { MailModule } from '../src/mail/mail.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PlatformModule } from '../src/platform/platform.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/**
 * Recherche globale et favoris (PLAT-08, PLAT-09).
 *
 * Ce qui est éprouvé ici : la tolérance aux fautes et aux accents, le fait qu'un contenu
 * non publié ne remonte jamais, et l'idempotence des deux routes de favoris.
 */
const PREFIX = 'e2e-plat-';

describe('Recherche globale et favoris (e2e)', () => {
  const stamp = Date.now();
  const email = `plat-${stamp}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();
  const mail = { send: vi.fn(async () => ({ id: 'x', subject: 'x', transport: 'test' })) };

  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let produitId = '';
  let produitRetireId = '';

  async function nettoyer() {
    const comptes = await prisma.user.findMany({ where: { email }, select: { id: true } });
    const ids = comptes.map((compte) => compte.id);
    await prisma.favorite.deleteMany({ where: { userId: { in: ids } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.serviceOffering.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        MailModule.register(false),
        AuthModule,
        PlatformModule,
      ],
    })
      .overrideProvider(OtpSender)
      .useValue(otp)
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(AUTH_BASE_PATH, toNodeHandler(app.get<Auth>(AUTH)));
    app.use(express.json());
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await nettoyer();

    const base = {
      description: 'Produit créé par les tests automatisés de la recherche globale.',
      category: 'ELECTRONICS' as const,
      purchasePriceMinor: 1_000,
      purchaseCurrency: 'XAF' as const,
      purchasePriceXaf: 1_000,
      exchangeRate: 1,
      exchangeRateAt: new Date('2026-09-01T00:00:00.000Z'),
      exchangeRateSource: 'Test automatisé',
      moq: 10,
      weightGrams: 100,
      badges: [],
      watchPoints: [],
      supplierIds: [],
    };

    const publie = await prisma.product.create({
      data: {
        ...base,
        slug: `${PREFIX}telephone`,
        name: 'Coque de téléphone renforcée',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    produitId = publie.id;

    const retire = await prisma.product.create({
      data: {
        ...base,
        slug: `${PREFIX}brouillon`,
        name: 'Coque de téléphone jamais publiée',
        status: 'DRAFT',
      },
    });
    produitRetireId = retire.id;

    await prisma.serviceOffering.create({
      data: {
        slug: `${PREFIX}prestation`,
        name: 'Réparation de téléphone',
        summary: 'Prestation créée par les tests automatisés de la recherche.',
        description: 'Prestation créée par les tests automatisés de la recherche globale.',
        category: 'COACHING',
        pricingMode: 'FIXED',
        priceXaf: 5_000,
        leadTimeDays: 2,
        deliverables: ['Rien'],
        conditions: ['Rien'],
        requirements: ['Rien'],
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/email-otp/send-verification-otp').send({ email, type: 'sign-in' }).expect(200);
    await agent.post('/v1/auth/sign-in/email-otp').send({ email, otp: otp.lastCode }).expect(200);
  });

  afterAll(async () => {
    await nettoyer();
    await app.close();
  });

  describe('Recherche globale (PLAT-08)', () => {
    it('trouve « téléphone » à partir de « telefone », sans accent et avec une faute', async () => {
      const reponse = await request(app.getHttpServer()).get('/v1/recherche?q=telefone').expect(200);
      const titres = reponse.body.items.map((item: { title: string }) => item.title);
      expect(titres).toContain('Coque de téléphone renforcée');
    });

    it('cherche dans plusieurs familles à la fois et les compte', async () => {
      const reponse = await request(app.getHttpServer()).get('/v1/recherche?q=telephone').expect(200);
      const familles = reponse.body.items.map((item: { type: string }) => item.type);
      expect(familles).toContain('PRODUCT');
      expect(familles).toContain('SERVICE');
      expect(reponse.body.counts.length).toBeGreaterThanOrEqual(2);
    });

    it('ne remonte jamais un contenu non publié', async () => {
      const reponse = await request(app.getHttpServer()).get('/v1/recherche?q=telephone&limit=50').expect(200);
      const ids = reponse.body.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(produitId);
      expect(ids).not.toContain(produitRetireId);
    });

    it('donne un chemin d’ouverture utilisable pour chaque résultat', async () => {
      const reponse = await request(app.getHttpServer()).get('/v1/recherche?q=telephone').expect(200);
      const produit = reponse.body.items.find((item: { type: string }) => item.type === 'PRODUCT');
      expect(produit.href).toBe(`/opportunites/${PREFIX}telephone`);
    });

    it('ne renvoie rien plutôt que du bruit sur un mot sans rapport', async () => {
      const reponse = await request(app.getHttpServer()).get('/v1/recherche?q=zzzzqqqwww').expect(200);
      expect(reponse.body.items).toEqual([]);
      expect(reponse.body.counts).toEqual([]);
    });

    it('restreint la recherche à une famille quand on le demande', async () => {
      const reponse = await request(app.getHttpServer())
        .get('/v1/recherche?q=telephone&type=SERVICE')
        .expect(200);
      expect(reponse.body.items.every((item: { type: string }) => item.type === 'SERVICE')).toBe(true);
    });

    it('refuse une recherche trop courte avec un message lisible', async () => {
      const refus = await request(app.getHttpServer()).get('/v1/recherche?q=a').expect(400);
      expect(typeof refus.body.message).toBe('string');
    });
  });

  describe('Favoris (PLAT-09)', () => {
    it('exige une session', async () => {
      await request(app.getHttpServer()).get('/v1/favoris').expect(401);
      await request(app.getHttpServer())
        .post('/v1/favoris')
        .send({ targetType: 'PRODUCT', targetId: produitId })
        .expect(401);
    });

    it('refuse de mettre en favori une fiche qui n’existe pas', async () => {
      await agent.post('/v1/favoris').send({ targetType: 'PRODUCT', targetId: 'inexistant' }).expect(404);
    });

    it('ajoute, puis reste silencieux sur un second ajout identique', async () => {
      const premier = await agent
        .post('/v1/favoris')
        .send({ targetType: 'PRODUCT', targetId: produitId })
        .expect(201);
      expect(premier.body.favorite).toBe(true);
      expect(premier.body.changed).toBe(true);
      expect(premier.body.total).toBe(1);

      const second = await agent
        .post('/v1/favoris')
        .send({ targetType: 'PRODUCT', targetId: produitId })
        .expect(201);
      expect(second.body.favorite).toBe(true);
      // Rien n'a été écrit : le bouton tapoté deux fois ne crée pas de doublon.
      expect(second.body.changed).toBe(false);
      expect(second.body.total).toBe(1);
    });

    it('sert le favori avec son titre et son chemin d’ouverture', async () => {
      const liste = await agent.get('/v1/favoris').expect(200);
      expect(liste.body.total).toBe(1);
      expect(liste.body.items[0].title).toBe('Coque de téléphone renforcée');
      expect(liste.body.items[0].href).toBe(`/opportunites/${PREFIX}telephone`);
      expect(liste.body.counts).toEqual([{ type: 'PRODUCT', label: 'Produits', count: 1 }]);
    });

    it('omet un favori dont la fiche a disparu, sans faire échouer la page', async () => {
      // On insère directement un favori orphelin : c'est l'état qu'on veut éprouver.
      const compte = await prisma.user.findUniqueOrThrow({ where: { email } });
      await prisma.favorite.create({
        data: { userId: compte.id, targetType: 'COURSE', targetId: 'formation-supprimee' },
      });

      const liste = await agent.get('/v1/favoris').expect(200);
      expect(liste.body.items.every((item: { targetId: string }) => item.targetId !== 'formation-supprimee')).toBe(
        true,
      );

      // La ligne orpheline a été nettoyée au passage.
      const restant = await prisma.favorite.count({
        where: { userId: compte.id, targetId: 'formation-supprimee' },
      });
      expect(restant).toBe(0);
    });

    it('retire, puis reste silencieux sur un second retrait', async () => {
      const premier = await agent.delete(`/v1/favoris/PRODUCT/${produitId}`).expect(200);
      expect(premier.body.favorite).toBe(false);
      expect(premier.body.changed).toBe(true);
      expect(premier.body.total).toBe(0);

      const second = await agent.delete(`/v1/favoris/PRODUCT/${produitId}`).expect(200);
      expect(second.body.favorite).toBe(false);
      expect(second.body.changed).toBe(false);
    });

    it('refuse une famille de favori inconnue', async () => {
      await agent.post('/v1/favoris').send({ targetType: 'LICORNE', targetId: produitId }).expect(400);
    });
  });
});
