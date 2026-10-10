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
import { OrdersModule } from '../src/orders/orders.module.js';
import { FakePaymentProvider } from '../src/payments/fake.provider.js';
import { PAYMENT_PROVIDER } from '../src/payments/payment-provider.js';
import { PaymentsModule } from '../src/payments/payments.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Intercepte le code au lieu de l'envoyer : le test lit ce que l'utilisateur recevrait. */
class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/**
 * Commandes, checkout, reçu et précommandes (ORD-01 à ORD-05).
 *
 * L'agrégateur est remplacé par son implémentation en mémoire : aucun appel réseau.
 * Les emails sont capturés. Nécessite la base de développement (pnpm db:create && pnpm db:migrate).
 */
const PREFIX = 'e2e-ord-';
const PRODUCT_SLUG = `${PREFIX}leger`;
const CAMPAIGN_SLUG = `${PREFIX}campagne`;
const CLOSED_CAMPAIGN_SLUG = `${PREFIX}campagne-close`;

/** Coût rendu de 10 pièces à 1 000 FCFA et 100 g, recalculé à la main depuis les hypothèses publiées. */
const EXPECTED_TOTAL_FOR_10 = 15_020;

describe('Commandes et précommandes (e2e)', () => {
  const stamp = Date.now();
  const email = `ord-${stamp}@exemple-warrior.cm`;
  const otherEmail = `ord-autre-${stamp}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();
  const provider = new FakePaymentProvider();
  const mail = { send: vi.fn(async () => ({ id: 'x', subject: 'x', transport: 'test' })) };

  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let other: ReturnType<typeof request.agent>;
  let orderReference = '';
  let providerRef = '';

  async function signIn(client: ReturnType<typeof request.agent>, address: string) {
    await client.post('/v1/auth/email-otp/send-verification-otp').send({ email: address, type: 'sign-in' }).expect(200);
    await client.post('/v1/auth/sign-in/email-otp').send({ email: address, otp: otp.lastCode }).expect(200);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        MailModule.register(false),
        AuthModule,
        PaymentsModule,
        OrdersModule,
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
    await cleanup();

    await prisma.product.create({
      data: {
        slug: PRODUCT_SLUG,
        name: 'Produit de test commande',
        description: 'Produit créé par les tests automatisés des commandes.',
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
        badges: [],
        watchPoints: [],
        supplierIds: [],
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
        images: { create: [{ url: 'data:image/svg+xml;utf8,<svg/>', alt: 'Image de test', position: 0 }] },
      },
    });

    agent = request.agent(app.getHttpServer());
    other = request.agent(app.getHttpServer());
    await signIn(agent, email);
    await signIn(other, otherEmail);
  });

  async function cleanup() {
    const users = await prisma.user.findMany({ where: { email: { in: [email, otherEmail] } }, select: { id: true } });
    const userIds = users.map((user) => user.id);
    await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.preorderCampaign.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('exige une session sur toutes les routes', async () => {
    const anonymous = request(app.getHttpServer());
    await anonymous.post('/v1/orders/quote').send({ productSlug: PRODUCT_SLUG, quantity: 10 }).expect(401);
    await anonymous.get('/v1/orders').expect(401);
    await anonymous.post('/v1/orders').send({}).expect(401);
    await anonymous.get('/v1/preorders').expect(401);
  });

  it('donne un résumé complet des frais avant paiement, avec ses hypothèses', async () => {
    const quote = await agent.post('/v1/orders/quote').send({ productSlug: PRODUCT_SLUG, quantity: 10 }).expect(200);

    expect(quote.body.product.slug).toBe(PRODUCT_SLUG);
    expect(quote.body.belowMinimumOrder).toBe(false);
    expect(quote.body.fees.subtotalXaf).toBe(10_000);
    expect(quote.body.fees.totalXaf).toBe(EXPECTED_TOTAL_FOR_10);
    expect(quote.body.fees.provenance).toBe('ESTIMATE');
    expect(quote.body.fees.assumptions.length).toBeGreaterThan(0);
    expect(quote.body.fees.exclusions.length).toBeGreaterThan(0);

    const low = await agent.post('/v1/orders/quote').send({ productSlug: PRODUCT_SLUG, quantity: 3 }).expect(200);
    expect(low.body.belowMinimumOrder).toBe(true);

    const invalid = await agent.post('/v1/orders/quote').send({ productSlug: PRODUCT_SLUG, quantity: 0 }).expect(400);
    expect(invalid.body.code).toBe('invalid_request');
    expect(invalid.body.issues[0].path).toBe('quantity');
  });

  it('refuse une commande sous le minimum, un produit inconnu ou un numéro invalide', async () => {
    const base = { city: 'Douala', deliveryMode: 'WAREHOUSE_PICKUP', phone: '+237 670 11 22 33', paymentMethod: 'MTN_MOMO' };

    const below = await agent.post('/v1/orders').send({ ...base, productSlug: PRODUCT_SLUG, quantity: 5 }).expect(400);
    expect(below.body.code).toBe('below_minimum_order');

    await agent.post('/v1/orders').send({ ...base, productSlug: `${PREFIX}inconnu`, quantity: 10 }).expect(404);

    const badPhone = await agent
      .post('/v1/orders')
      .send({ ...base, productSlug: PRODUCT_SLUG, quantity: 10, phone: '12345' })
      .expect(400);
    expect(badPhone.body.issues[0].path).toBe('phone');

    expect(await prisma.order.count({ where: { user: { email } } })).toBe(0);
  });

  it('crée la commande avec un total calculé côté serveur et lance le paiement', async () => {
    const created = await agent
      .post('/v1/orders')
      .send({
        productSlug: PRODUCT_SLUG,
        quantity: 10,
        city: 'Douala',
        deliveryMode: 'WAREHOUSE_PICKUP',
        phone: '+237 670 11 22 33',
        paymentMethod: 'MTN_MOMO',
        // Un montant envoyé par le client est ignoré : il n'existe pas dans le contrat.
        totalXaf: 1,
      })
      .expect(201);

    const { order, payment } = created.body;
    orderReference = order.reference;
    providerRef = '';

    expect(order.reference).toMatch(/^WS-\d{8}-[A-Z0-9]{4}$/);
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.totalXaf).toBe(EXPECTED_TOTAL_FOR_10);
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]).toMatchObject({ label: 'Produit de test commande', quantity: 10, unitPriceXaf: 1_000, lineTotalXaf: 10_000 });
    expect(order.phone).toBe('670112233');
    expect(order.receiptUrl).toBeNull();

    expect(payment.status).toBe('INITIATED');
    expect(payment.amountXaf).toBe(EXPECTED_TOTAL_FOR_10);
    expect(payment.payerPhone).toBe('670112233');
    expect(payment.instruction).toContain('670 11 22 33');

    const stored = await prisma.payment.findFirst({ where: { reference: payment.reference } });
    expect(stored?.providerRef).toBeTruthy();
    providerRef = stored?.providerRef ?? '';
  });

  it('montre la commande à son auteur seulement', async () => {
    const list = await agent.get('/v1/orders').expect(200);
    expect(list.body.orders.map((order: { reference: string }) => order.reference)).toContain(orderReference);

    const detail = await agent.get(`/v1/orders/${orderReference}`).expect(200);
    expect(detail.body.order.payment.status).toBe('INITIATED');
    expect(detail.body.order.nextStep).toContain('Validez');

    const otherList = await other.get('/v1/orders').expect(200);
    expect(otherList.body.orders).toEqual([]);
    await other.get(`/v1/orders/${orderReference}`).expect(404);
    await other.get(`/v1/orders/${orderReference}/receipt.pdf`).expect(404);
    await agent.get('/v1/orders/all').expect(403);
  });

  it('ne délivre pas de reçu avant le paiement, puis un PDF après confirmation', async () => {
    const early = await agent.get(`/v1/orders/${orderReference}/receipt.pdf`).expect(404);
    expect(early.body.code).toBe('receipt_unavailable');

    // Le client valide sur son téléphone : l'agrégateur passe la transaction à SUCCESSFUL,
    // puis nous prévient par webhook. C'est ce chemin qui fait foi ; la relecture périodique
    // n'est qu'un filet de sécurité, volontairement espacée pour respecter la limite de
    // six appels par minute et par transaction.
    provider.setStatus(providerRef, 'SUCCESSFUL');
    await request(app.getHttpServer())
      .post('/v1/payments/webhook')
      .set('x-wh-secret', provider.webhookSecret)
      .send({ transId: providerRef, status: 'SUCCESSFUL' })
      .expect(200);

    const detail = await agent.get(`/v1/orders/${orderReference}`).expect(200);
    expect(detail.body.order.status).toBe('PAID');
    expect(detail.body.order.payment.status).toBe('SUCCEEDED');
    expect(detail.body.order.receiptUrl).toBe(`/v1/orders/${orderReference}/receipt.pdf`);
    expect(detail.body.order.nextStep).toContain('fournisseur');

    const receipt = await agent.get(`/v1/orders/${orderReference}/receipt.pdf`).expect(200);
    expect(receipt.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(receipt.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    expect((receipt.body as Buffer).length).toBeGreaterThan(1_000);
  });

  describe('précommandes', () => {
    const campaign = {
      slug: CAMPAIGN_SLUG,
      title: 'Campagne de test',
      description: 'Campagne créée par les tests automatisés, pour vérifier la progression réelle.',
      status: 'OPEN',
      unitPriceXaf: 2_500,
      minimumQuantity: 40,
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      included: ['Transport jusqu’à Douala', 'Dédouanement'],
      excluded: ['Livraison à domicile'],
      leadTime: 'Environ 45 jours après la clôture de la campagne',
      conditions: 'Participation ferme une fois payée.',
      faq: [{ question: 'Et si le minimum n’est pas atteint ?', answer: 'Vous êtes remboursé intégralement.' }],
    };

    it('réserve la création aux administrateurs', async () => {
      const refused = await agent.post('/v1/preorders').send(campaign).expect(403);
      expect(refused.body.code).toBe('forbidden');
    });

    it('crée une campagne et la montre avec une progression à zéro', async () => {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });

      const created = await agent.post('/v1/preorders').send(campaign).expect(201);
      expect(created.body.campaign.progress).toMatchObject({ committedQuantity: 0, participantCount: 0, percent: 0, reached: false, provenance: 'VERIFIED' });
      expect(created.body.campaign.acceptsParticipation).toBe(true);
      expect(created.body.campaign.faq).toHaveLength(1);

      await agent.post('/v1/preorders').send({ ...campaign, minimumQuantity: 0 }).expect(400);
      await agent.post('/v1/preorders').send(campaign).expect(409);

      await agent.post('/v1/preorders').send({ ...campaign, slug: CLOSED_CAMPAIGN_SLUG, status: 'CLOSED' }).expect(201);

      const list = await other.get('/v1/preorders').expect(200);
      const slugs = list.body.campaigns.map((entry: { slug: string }) => entry.slug);
      expect(slugs).toContain(CAMPAIGN_SLUG);
      expect(slugs).toContain(CLOSED_CAMPAIGN_SLUG);
    });

    it('compte une participation dans la progression seulement une fois payée', async () => {
      const participation = {
        quantity: 10,
        city: 'Yaoundé',
        deliveryMode: 'HOME_DELIVERY',
        phone: '699001122',
        paymentMethod: 'ORANGE_MONEY',
      };

      const closed = await other.post(`/v1/preorders/${CLOSED_CAMPAIGN_SLUG}/participate`).send(participation).expect(409);
      expect(closed.body.code).toBe('campaign_closed');

      const joined = await other.post(`/v1/preorders/${CAMPAIGN_SLUG}/participate`).send(participation).expect(200);
      expect(joined.body.order.kind).toBe('PREORDER');
      expect(joined.body.order.totalXaf).toBe(25_000);
      expect(joined.body.order.fees.provenance).toBe('VERIFIED');
      expect(joined.body.order.campaign.slug).toBe(CAMPAIGN_SLUG);

      const before = await other.get(`/v1/preorders/${CAMPAIGN_SLUG}`).expect(200);
      expect(before.body.campaign.progress.committedQuantity).toBe(0);

      const stored = await prisma.payment.findFirst({ where: { reference: joined.body.payment.reference } });
      provider.setStatus(stored?.providerRef ?? '', 'SUCCESSFUL');
      await other.get(`/v1/payments/${joined.body.payment.reference}`).expect(200);

      const after = await other.get(`/v1/preorders/${CAMPAIGN_SLUG}`).expect(200);
      expect(after.body.campaign.progress).toMatchObject({ committedQuantity: 10, participantCount: 1, percent: 25, reached: false });

      const history = await other.get('/v1/orders').expect(200);
      expect(history.body.orders[0]).toMatchObject({ kind: 'PREORDER', status: 'PAID', headline: 'Campagne de test' });
    });
  });
});
