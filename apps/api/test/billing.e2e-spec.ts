import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import request from 'supertest';
import { AcademyModule } from '../src/academy/academy.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { AUTH_BASE_PATH, type Auth } from '../src/auth/auth.config.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import { OtpSender } from '../src/auth/otp-sender.js';
import { BillingModule } from '../src/billing/billing.module.js';
import { configureApp } from '../src/bootstrap.js';
import { validateEnv } from '../src/config/env.js';
import { MailModule } from '../src/mail/mail.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { FakePaymentProvider } from '../src/payments/fake.provider.js';
import { PAYMENT_PROVIDER } from '../src/payments/payment-provider.js';
import { PaymentsModule } from '../src/payments/payments.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/**
 * Prix, promotions et abonnements (§43).
 *
 * Ce qui est éprouvé ici n'est pas le calcul — il a ses tests unitaires dans
 * `@ws/contracts` — mais ce que le serveur **choisit** d'appliquer : la portée, le code,
 * les quotas, et le fait qu'un abonnement n'ouvre aucun droit avant d'être payé.
 */
const PREFIX = 'e2e-bill-';

describe('Prix, promotions et abonnements (e2e)', () => {
  const stamp = Date.now();
  const email = `bill-${stamp}@exemple-warrior.cm`;
  const adminEmail = `bill-admin-${stamp}@exemple-warrior.cm`;
  /** Adresse qui n'a aucun compte : c'est la souscription qui doit le créer. */
  const emailPublic = `bill-public-${stamp}@exemple-warrior.cm`;
  /** Adresse du parcours d'achat d'une formation à l'unité, sans compte non plus. */
  const emailAchat = `bill-achat-${stamp}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();
  const provider = new FakePaymentProvider();
  /**
   * Le type des paramètres est déclaré : sans lui, `mock.calls` est un tuple vide pour
   * TypeScript et les tests ne peuvent pas lire ce qui a réellement été envoyé.
   */
  type EnvoiEmail = { to: string; template: string; data: Record<string, unknown> };
  const mail = {
    send: vi.fn(async (_envoi: EnvoiEmail) => ({ id: 'x', subject: 'x', transport: 'test' })),
  };

  let app: INestApplication;
  let prisma: PrismaService;
  let client: ReturnType<typeof request.agent>;
  let admin: ReturnType<typeof request.agent>;
  let coursId = '';
  let planId = '';
  let userId = '';
  /**
   * Prix de référence de la formation de test **avant** toute promotion créée ici.
   *
   * Il n'est pas écrit en dur : une promotion générale créée par ailleurs dans la base
   * — une vraie offre de rentrée, par exemple — s'applique légitimement à cette
   * formation aussi. Un test qui exigerait « 25 000 » casserait au premier geste
   * commercial réel, et ce serait le test qui aurait tort.
   */
  let prixDeReference = 0;

  async function connecter(agent: ReturnType<typeof request.agent>, adresse: string) {
    await agent.post('/v1/auth/email-otp/send-verification-otp').send({ email: adresse, type: 'sign-in' }).expect(200);
    await agent.post('/v1/auth/sign-in/email-otp').send({ email: adresse, otp: otp.lastCode }).expect(200);
  }

  async function nettoyer() {
    const comptes = await prisma.user.findMany({
      where: { email: { in: [email, adminEmail, emailPublic, emailAchat] } },
      select: { id: true },
    });
    const ids = comptes.map((compte) => compte.id);
    await prisma.coursePurchase.deleteMany({ where: { userId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.promotionRedemption.deleteMany({ where: { userId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.promotion.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.subscriptionPlan.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.lesson.deleteMany({ where: { course: { slug: { startsWith: PREFIX } } } });
    await prisma.chapter.deleteMany({ where: { course: { slug: { startsWith: PREFIX } } } });
    await prisma.course.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.instructor.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.account.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        MailModule.register(false),
        AuthModule,
        PaymentsModule,
        BillingModule,
        AcademyModule,
      ],
    })
      .overrideProvider(OtpSender)
      .useValue(otp)
      .overrideProvider(PAYMENT_PROVIDER)
      .useValue(provider)
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

    const formateur = await prisma.instructor.create({
      data: { name: `${PREFIX}formateur`, headline: 'Formateur créé par les tests automatisés.' },
    });
    const cours = await prisma.course.create({
      data: {
        slug: `${PREFIX}negociation`,
        title: 'Négocier avec un fournisseur',
        summary: 'Formation créée par les tests automatisés.',
        description: 'Formation créée par les tests automatisés des promotions.',
        level: 'INTERMEDIATE',
        theme: 'NEGOTIATION',
        access: 'PAID',
        priceXaf: 25_000,
        outcomes: ['Savoir négocier'],
        instructorId: formateur.id,
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    coursId = cours.id;

    client = request.agent(app.getHttpServer());
    admin = request.agent(app.getHttpServer());
    await connecter(client, email);
    await connecter(admin, adminEmail);
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
    userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  });

  afterAll(async () => {
    await nettoyer();
    await app.close();
  });

  const OFFRE = {
    slug: `${PREFIX}pro`,
    name: 'Pro',
    tagline: 'Pour qui importe régulièrement.',
    priceXaf: 10_000,
    period: 'MONTHLY' as const,
    rights: ['SUPPLIER_CONTACTS', 'ACADEMY_INCLUDED'],
    serviceDiscountPercent: 10,
    highlights: ['Coordonnées des fournisseurs vérifiés'],
    position: 1,
    active: true,
  };

  describe('Offres d’abonnement', () => {
    it('réserve la gestion des offres à l’administration', async () => {
      await client.get('/v1/admin/offres').expect(403);
      await client.post('/v1/admin/offres').send(OFFRE).expect(403);
    });

    it('refuse une offre payante qui n’ouvre aucun droit', async () => {
      await admin
        .post('/v1/admin/offres')
        .send({ ...OFFRE, slug: `${PREFIX}vide`, rights: [], serviceDiscountPercent: 0 })
        .expect(400);
    });

    it('crée une offre et la sert publiquement', async () => {
      const creation = await admin.post('/v1/admin/offres').send(OFFRE).expect(201);
      const creee = creation.body.plans.find((plan: { slug: string }) => plan.slug === OFFRE.slug);
      expect(creee).toBeDefined();
      planId = creee.id;

      // Les offres se comparent sans compte : c'est la vitrine de l'abonnement.
      const publiques = await request(app.getHttpServer()).get('/v1/offres').expect(200);
      const vue = publiques.body.plans.find((plan: { slug: string }) => plan.slug === OFFRE.slug);
      expect(vue.priceXaf).toBe(10_000);
      expect(vue.priced.finalXaf).toBe(10_000);
      expect(vue.rightLabels).toContain('Coordonnées des fournisseurs');
      expect(publiques.body.mine).toBeNull();
    });

    it('modifie le prix d’une offre sans toucher au code', async () => {
      const modif = await admin.put(`/v1/admin/offres/${planId}`).send({ ...OFFRE, priceXaf: 12_000 }).expect(200);
      const modifiee = modif.body.plans.find((plan: { slug: string }) => plan.slug === OFFRE.slug);
      expect(modifiee.priceXaf).toBe(12_000);

      await admin.put(`/v1/admin/offres/${planId}`).send(OFFRE).expect(200);
    });
  });

  describe('Promotions sur les formations', () => {
    it('réserve la gestion des promotions à l’administration', async () => {
      await client.get('/v1/admin/promotions').expect(403);
    });

    it('relève le prix de référence avant d’ajouter quoi que ce soit', async () => {
      const fiche = await request(app.getHttpServer())
        .get(`/v1/academy/courses/${PREFIX}negociation`)
        .expect(200);
      prixDeReference = fiche.body.course.priced.finalXaf;
      expect(fiche.body.course.priced.originalXaf).toBe(25_000);
    });

    it('applique une promotion automatique sur une formation précise', async () => {
      await admin
        .post('/v1/admin/promotions')
        .send({
          name: `${PREFIX}rentree`,
          kind: 'PERCENTAGE',
          percentage: 40,
          target: 'COURSE',
          targetId: coursId,
          trigger: 'AUTOMATIC',
          startsAt: '2026-01-01T00:00:00.000Z',
        })
        .expect(201);

      const fiche = await request(app.getHttpServer())
        .get(`/v1/academy/courses/${PREFIX}negociation`)
        .expect(200);

      // 40 % de 25 000 = 10 000 de remise. C'est la meilleure offre pour le client,
      // donc elle l'emporte sur toute promotion générale qui existerait par ailleurs.
      expect(fiche.body.course.priced.originalXaf).toBe(25_000);
      expect(fiche.body.course.priced.finalXaf).toBe(15_000);
      expect(fiche.body.course.priced.discountPercent).toBe(40);
      expect(fiche.body.course.priced.promotionName).toBe(`${PREFIX}rentree`);
    });

    it('porte le prix remisé jusqu’au catalogue, sans requête par formation', async () => {
      const liste = await request(app.getHttpServer()).get('/v1/academy/courses?perPage=48').expect(200);
      const cours = liste.body.items.find((item: { id: string }) => item.id === coursId);
      // Même prix que sur la fiche : les deux écrans passent par le même calcul.
      expect(cours.priced.finalXaf).toBe(15_000);
      expect(cours.priced.promotionName).toBe(`${PREFIX}rentree`);
    });

    it('n’applique pas une promotion qui n’a pas commencé', async () => {
      const promotions = await admin.get('/v1/admin/promotions').expect(200);
      const promo = promotions.body.items.find((item: { name: string }) => item.name === `${PREFIX}rentree`);

      await admin
        .put(`/v1/admin/promotions/${promo.id}`)
        .send({
          name: `${PREFIX}rentree`,
          kind: 'PERCENTAGE',
          percentage: 40,
          target: 'COURSE',
          targetId: coursId,
          trigger: 'AUTOMATIC',
          startsAt: '2099-01-01T00:00:00.000Z',
        })
        .expect(200);

      const fiche = await request(app.getHttpServer())
        .get(`/v1/academy/courses/${PREFIX}negociation`)
        .expect(200);
      // On retombe sur le prix de référence : notre promotion ne compte plus.
      expect(fiche.body.course.priced.finalXaf).toBe(prixDeReference);
      expect(fiche.body.course.priced.promotionName).not.toBe(`${PREFIX}rentree`);

      const apres = await admin.get('/v1/admin/promotions').expect(200);
      const vue = apres.body.items.find((item: { name: string }) => item.name === `${PREFIX}rentree`);
      expect(vue.live).toBe(false);
      expect(vue.inactiveReason).toBe('Pas encore commencée.');

      // On la remet en vigueur pour la suite.
      await admin
        .put(`/v1/admin/promotions/${promo.id}`)
        .send({
          name: `${PREFIX}rentree`,
          kind: 'PERCENTAGE',
          percentage: 40,
          target: 'COURSE',
          targetId: coursId,
          trigger: 'AUTOMATIC',
          startsAt: '2026-01-01T00:00:00.000Z',
          active: false,
        })
        .expect(200);
    });

    it('refuse une promotion sur code sans code, et un code déjà pris', async () => {
      await admin
        .post('/v1/admin/promotions')
        .send({
          name: `${PREFIX}sans-code`,
          kind: 'PERCENTAGE',
          percentage: 10,
          target: 'ALL_COURSES',
          trigger: 'CODE',
          startsAt: '2026-01-01T00:00:00.000Z',
        })
        .expect(400);

      await admin
        .post('/v1/admin/promotions')
        .send({
          name: `${PREFIX}code-1`,
          kind: 'AMOUNT',
          amountXaf: 3_000,
          target: 'ALL_COURSES',
          trigger: 'CODE',
          code: 'DOUALA10',
          startsAt: '2026-01-01T00:00:00.000Z',
        })
        .expect(201);

      await admin
        .post('/v1/admin/promotions')
        .send({
          name: `${PREFIX}code-2`,
          kind: 'AMOUNT',
          amountXaf: 1_000,
          target: 'ALL_COURSES',
          trigger: 'CODE',
          code: 'DOUALA10',
          startsAt: '2026-01-01T00:00:00.000Z',
        })
        .expect(400);
    });

    it('n’applique pas une promotion sur code tant que le code n’est pas saisi', async () => {
      // La promotion « DOUALA10 » existe et est en vigueur, mais elle attend son code.
      const fiche = await request(app.getHttpServer())
        .get(`/v1/academy/courses/${PREFIX}negociation`)
        .expect(200);
      expect(fiche.body.course.priced.finalXaf).toBe(prixDeReference);
      expect(fiche.body.course.priced.promotionName).not.toBe(`${PREFIX}code-1`);
    });

    it('refuse une fin de validité antérieure au début', async () => {
      await admin
        .post('/v1/admin/promotions')
        .send({
          name: `${PREFIX}fenetre-absurde`,
          kind: 'PERCENTAGE',
          percentage: 10,
          target: 'ALL_COURSES',
          startsAt: '2026-06-01T00:00:00.000Z',
          endsAt: '2026-05-01T00:00:00.000Z',
        })
        .expect(400);
    });

    it('refuse une promotion qui vise une formation inexistante', async () => {
      await admin
        .post('/v1/admin/promotions')
        .send({
          name: `${PREFIX}cible-fantome`,
          kind: 'PERCENTAGE',
          percentage: 10,
          target: 'COURSE',
          targetId: 'formation-inconnue',
          startsAt: '2026-01-01T00:00:00.000Z',
        })
        .expect(404);
    });
  });

  describe('Souscription', () => {
    it('exige une session pour souscrire', async () => {
      await request(app.getHttpServer())
        .post('/v1/mon-abonnement')
        .send({ planSlug: OFFRE.slug, paymentMethod: 'MTN_MOMO' })
        .expect(401);
    });

    it('n’ouvre aucun droit tant que le paiement n’est pas confirmé', async () => {
      const souscription = await client
        .post('/v1/mon-abonnement')
        .send({ planSlug: OFFRE.slug, paymentMethod: 'MTN_MOMO', payerPhone: '670112233' })
        .expect(201);

      expect(souscription.body.subscription.status).toBe('PENDING_PAYMENT');
      expect(souscription.body.paymentReference).toBeTruthy();

      const mien = await client.get('/v1/mon-abonnement').expect(200);
      // Le droit n'est pas ouvert : c'est la confirmation du paiement qui l'ouvre.
      expect(mien.body.rights).toEqual([]);
      expect(mien.body.planSlug).toBe('gratuit');
    });

    it('ouvre les droits à la confirmation du paiement', async () => {
      const paiement = await prisma.payment.findFirstOrThrow({
        where: { userId, subscriptionId: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
      provider.setStatus(paiement.providerRef!, 'SUCCESSFUL');
      await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('x-wh-secret', provider.webhookSecret)
        .send(provider.webhookBody(paiement.providerRef!))
        .expect(200);

      const mien = await client.get('/v1/mon-abonnement').expect(200);
      expect(mien.body.subscription.status).toBe('ACTIVE');
      expect(mien.body.rights).toContain('SUPPLIER_CONTACTS');
      expect(mien.body.serviceDiscountPercent).toBe(10);
      expect(mien.body.planSlug).toBe(OFFRE.slug);
    });

    it('refuse de souscrire deux fois la même offre pour la période en cours', async () => {
      await client
        .post('/v1/mon-abonnement')
        .send({ planSlug: OFFRE.slug, paymentMethod: 'MTN_MOMO', payerPhone: '670112233' })
        .expect(409);
    });

    it('laisse les droits courir jusqu’au terme après résiliation', async () => {
      const resilie = await client.patch('/v1/mon-abonnement/resiliation').expect(200);
      expect(resilie.body.subscription.status).toBe('CANCELLED');
      // Les droits se ferment : la période payée reste affichée, mais plus rien n'est ouvert.
      expect(resilie.body.rights).toEqual([]);
    });
  });

  /**
   * Souscription sans compte, et identifiants engendrés (§43).
   *
   * Ce qui est éprouvé ici est exactement ce qui se joue avec un accès : **quand** le mot
   * de passe est fabriqué, **combien de fois**, et s'il fonctionne vraiment. Un test qui
   * vérifierait seulement qu'un courriel est parti laisserait passer le pire des cas —
   * un mot de passe annoncé au client et refusé à la connexion.
   */
  describe('Souscription sans compte', () => {
    /** Mot de passe lu dans le courriel d'activation : la seule copie qui existe. */
    let motDePasse = '';

    function emailsActivation() {
      return mail.send.mock.calls
        .map(([envoi]) => envoi)
        .filter((envoi) => envoi.template === 'subscription-activated' && envoi.to === emailPublic);
    }

    it('refuse un numéro qui n’est pas un mobile camerounais', async () => {
      await request(app.getHttpServer())
        .post('/v1/offres/souscription')
        .send({
          planSlug: OFFRE.slug,
          fullName: 'Client Sans Compte',
          email: emailPublic,
          payerPhone: '123456789',
          paymentMethod: 'MTN_MOMO',
        })
        .expect(400);

      // Rien n'a été créé : un numéro refusé ne doit pas laisser de compte derrière lui.
      expect(await prisma.user.findUnique({ where: { email: emailPublic } })).toBeNull();
    });

    it('crée le compte et attend le paiement, sans envoyer d’identifiants', async () => {
      mail.send.mockClear();

      const souscription = await request(app.getHttpServer())
        .post('/v1/offres/souscription')
        .send({
          planSlug: OFFRE.slug,
          fullName: 'Client Sans Compte',
          email: emailPublic,
          payerPhone: '670445566',
          paymentMethod: 'MTN_MOMO',
        })
        .expect(201);

      expect(souscription.body.accountCreated).toBe(true);
      expect(souscription.body.email).toBe(emailPublic);
      expect(souscription.body.paymentReference).toBeTruthy();
      expect(souscription.body.subscription.status).toBe('PENDING_PAYMENT');

      const compte = await prisma.user.findUniqueOrThrow({ where: { email: emailPublic } });
      expect(compte.name).toBe('Client Sans Compte');
      expect(compte.role).toBe('CLIENT');

      // Le point essentiel : un panier non payé ne fait partir aucun mot de passe.
      expect(emailsActivation()).toHaveLength(0);
      const abonnement = await prisma.subscription.findFirstOrThrow({
        where: { userId: compte.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(abonnement.provisionCredentials).toBe(true);
      expect(abonnement.credentialsSentAt).toBeNull();
    });

    it('expose l’état du paiement sans session, et sans rien révéler du client', async () => {
      const compte = await prisma.user.findUniqueOrThrow({ where: { email: emailPublic } });
      const paiement = await prisma.payment.findFirstOrThrow({
        where: { userId: compte.id },
        orderBy: { createdAt: 'desc' },
      });

      const etat = await request(app.getHttpServer())
        .get(`/v1/payments/${paiement.reference}/etat`)
        .expect(200);

      expect(etat.body.settled).toBe(false);
      expect(etat.body.instruction).toContain('670');
      // Ni montant, ni numéro complet, ni identité : une référence devinée n'apprend rien.
      expect(etat.body).not.toHaveProperty('amountXaf');
      expect(etat.body).not.toHaveProperty('payerPhone');
    });

    it('engendre les identifiants à la confirmation du paiement', async () => {
      const compte = await prisma.user.findUniqueOrThrow({ where: { email: emailPublic } });
      const paiement = await prisma.payment.findFirstOrThrow({
        where: { userId: compte.id },
        orderBy: { createdAt: 'desc' },
      });

      provider.setStatus(paiement.providerRef!, 'SUCCESSFUL');
      await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('x-wh-secret', provider.webhookSecret)
        .send(provider.webhookBody(paiement.providerRef!))
        .expect(200);

      const envois = emailsActivation();
      expect(envois).toHaveLength(1);
      motDePasse = envois[0]!.data.password as string;
      expect(motDePasse).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
      expect(envois[0]!.data.planName).toBe(OFFRE.name);

      const abonnement = await prisma.subscription.findFirstOrThrow({
        where: { userId: compte.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(abonnement.status).toBe('ACTIVE');
      expect(abonnement.credentialsSentAt).not.toBeNull();
    });

    it('rend un mot de passe qui fonctionne réellement', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/v1/auth/sign-in/email')
        .send({ email: emailPublic, password: motDePasse })
        .expect(200);

      // La session ouverte voit bien les droits payés, sans aucune autre manipulation.
      const mien = await agent.get('/v1/mon-abonnement').expect(200);
      expect(mien.body.planSlug).toBe(OFFRE.slug);
      expect(mien.body.rights).toContain('SUPPLIER_CONTACTS');
    });

    it('n’engendre pas un second mot de passe si le webhook est rejoué', async () => {
      const compte = await prisma.user.findUniqueOrThrow({ where: { email: emailPublic } });
      const paiement = await prisma.payment.findFirstOrThrow({
        where: { userId: compte.id },
        orderBy: { createdAt: 'desc' },
      });

      await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('x-wh-secret', provider.webhookSecret)
        .send(provider.webhookBody(paiement.providerRef!))
        .expect(200);

      // Un second mot de passe invaliderait le premier, déjà parti par courriel.
      expect(emailsActivation()).toHaveLength(1);
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/v1/auth/sign-in/email')
        .send({ email: emailPublic, password: motDePasse })
        .expect(200);
    });

    it('ne réinitialise rien quand l’adresse appartient déjà à un compte', async () => {
      mail.send.mockClear();

      // Ce compte existe depuis le début du fichier et s'est connecté par code courriel.
      const souscription = await request(app.getHttpServer())
        .post('/v1/offres/souscription')
        .send({
          planSlug: OFFRE.slug,
          fullName: 'Quelqu’un d’autre',
          email,
          payerPhone: '670778899',
          paymentMethod: 'ORANGE_MONEY',
        })
        .expect(201);

      expect(souscription.body.accountCreated).toBe(false);

      const abonnement = await prisma.subscription.findFirstOrThrow({
        where: { userId, paymentReference: souscription.body.paymentReference },
      });
      expect(abonnement.provisionCredentials).toBe(false);

      // Le nom du compte n'est pas écrasé par celui saisi au formulaire : payer pour
      // l'adresse de quelqu'un ne donne pas le droit de le renommer.
      const compte = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(compte.name).not.toBe('Quelqu’un d’autre');

      const paiement = await prisma.payment.findFirstOrThrow({
        where: { reference: souscription.body.paymentReference },
      });
      provider.setStatus(paiement.providerRef!, 'SUCCESSFUL');
      await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('x-wh-secret', provider.webhookSecret)
        .send(provider.webhookBody(paiement.providerRef!))
        .expect(200);

      const envois = mail.send.mock.calls
        .map(([envoi]) => envoi)
        .filter((envoi) => envoi.template === 'subscription-activated' && envoi.to === email);
      expect(envois).toHaveLength(1);
      // Courriel de confirmation, sans mot de passe : il n'y en avait aucun à fabriquer.
      expect(envois[0]!.data.password).toBe('');
    });
  });

  /**
   * Achat d'une formation à l'unité (SUB-02).
   *
   * Ce qui compte ici n'est pas que l'achat « réponde », mais que le bon montant soit figé,
   * que l'accès ne s'ouvre **pas** avant la confirmation, et qu'il s'ouvre vraiment après.
   * Un prix affiché sans accès au bout est exactement le défaut que ce lot répare.
   */
  describe('Achat d’une formation à l’unité', () => {
    const NUMERO = '670223344';

    function emailsAcces(destinataire: string) {
      return mail.send.mock.calls
        .map(([envoi]) => envoi)
        .filter((envoi) => envoi.template === 'course-access-granted' && envoi.to === destinataire);
    }

    it('refuse d’acheter une formation qui n’est pas payante', async () => {
      const gratuite = await prisma.course.create({
        data: {
          slug: `${PREFIX}offerte`,
          title: 'Formation offerte',
          summary: 'Formation créée par les tests automatisés.',
          description: 'Formation créée par les tests automatisés.',
          level: 'BEGINNER',
          theme: 'BASICS',
          access: 'FREE',
          priceXaf: 0,
          outcomes: ['Rien'],
          instructorId: (await prisma.instructor.findFirstOrThrow({ where: { name: { startsWith: PREFIX } } })).id,
          publishedAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      });

      await request(app.getHttpServer())
        .post(`/v1/academy/courses/${gratuite.slug}/achat`)
        .send({ fullName: 'Quelqu’un', email: emailAchat, payerPhone: NUMERO, paymentMethod: 'MTN_MOMO' })
        .expect(400);

      await prisma.course.delete({ where: { id: gratuite.id } });
    });

    it('exige une identité quand il n’y a pas de session', async () => {
      await request(app.getHttpServer())
        .post(`/v1/academy/courses/${PREFIX}negociation/achat`)
        .send({ payerPhone: NUMERO, paymentMethod: 'MTN_MOMO' })
        .expect(400);
    });

    it('fige le montant remisé et n’ouvre rien avant le paiement', async () => {
      mail.send.mockClear();

      const achat = await request(app.getHttpServer())
        .post(`/v1/academy/courses/${PREFIX}negociation/achat`)
        .send({
          fullName: 'Acheteur Sans Compte',
          email: emailAchat,
          payerPhone: NUMERO,
          paymentMethod: 'MTN_MOMO',
        })
        .expect(201);

      expect(achat.body.accountCreated).toBe(true);
      expect(achat.body.purchase.status).toBe('PENDING_PAYMENT');
      expect(achat.body.paymentReference).toBeTruthy();
      // Le montant vient du serveur : c'est le prix de référence relevé plus haut.
      expect(achat.body.purchase.paidXaf).toBe(prixDeReference);

      const compte = await prisma.user.findUniqueOrThrow({ where: { email: emailAchat } });
      // Rien n'est ouvert, et aucun identifiant n'est parti : le paiement n'est pas confirmé.
      expect(
        await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: compte.id, courseId: coursId } },
        }),
      ).toBeNull();
      expect(emailsAcces(emailAchat)).toHaveLength(0);
    });

    it('ouvre l’accès et envoie les identifiants à la confirmation', async () => {
      const compte = await prisma.user.findUniqueOrThrow({ where: { email: emailAchat } });
      const paiement = await prisma.payment.findFirstOrThrow({
        where: { userId: compte.id, coursePurchaseId: { not: null } },
        orderBy: { createdAt: 'desc' },
      });

      provider.setStatus(paiement.providerRef!, 'SUCCESSFUL');
      await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('x-wh-secret', provider.webhookSecret)
        .send(provider.webhookBody(paiement.providerRef!))
        .expect(200);

      const inscription = await prisma.enrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: compte.id, courseId: coursId } },
      });
      // L'origine distingue un achat d'un accès offert : la comptabilité en dépend.
      expect(inscription.source).toBe('PURCHASE');

      const envois = emailsAcces(emailAchat);
      expect(envois).toHaveLength(1);
      expect(envois[0]!.data.password).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    });

    it('refuse un second achat de la même formation', async () => {
      await request(app.getHttpServer())
        .post(`/v1/academy/courses/${PREFIX}negociation/achat`)
        .send({
          fullName: 'Acheteur Sans Compte',
          email: emailAchat,
          payerPhone: NUMERO,
          paymentMethod: 'MTN_MOMO',
        })
        .expect(409);
    });
  });

  describe('Suppression d’une promotion', () => {
    it('refuse d’effacer une promotion qui a servi, et accepte sinon', async () => {
      const promotions = await admin.get('/v1/admin/promotions').expect(200);
      const jamaisServie = promotions.body.items.find(
        (item: { name: string }) => item.name === `${PREFIX}code-1`,
      );
      await admin.delete(`/v1/admin/promotions/${jamaisServie.id}`).expect(200);

      // Une promotion déjà utilisée est une trace comptable : on la désactive.
      const utilisee = await prisma.promotion.create({
        data: {
          name: `${PREFIX}deja-servie`,
          kind: 'PERCENTAGE',
          percentage: 10,
          target: 'ALL_COURSES',
          startsAt: new Date('2026-01-01T00:00:00.000Z'),
          redemptions: { create: { userId, discountXaf: 2_500 } },
        },
      });
      const refus = await admin.delete(`/v1/admin/promotions/${utilisee.id}`).expect(400);
      expect(refus.body.message).toContain('désactivez-la');
    });
  });
});
