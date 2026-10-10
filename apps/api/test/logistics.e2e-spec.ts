import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AUTH_BASE_PATH, type Auth } from '../src/auth/auth.config.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import { OtpSender } from '../src/auth/otp-sender.js';
import { configureApp } from '../src/bootstrap.js';
import { MailService, type SendEmailInput } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Intercepte le code au lieu de l'envoyer : le test lit ce que l'utilisateur recevrait. */
class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/** Compte les emails au lieu de les envoyer : le test vérifie « exactement un envoi par changement ». */
class CountingMail {
  public sent: SendEmailInput[] = [];

  async send(input: SendEmailInput) {
    this.sent.push(input);
    return { id: `test-${this.sent.length}`, subject: 'test', transport: 'test' };
  }
}

/**
 * Événements logistiques (LOG-01), notification unique (LOG-03), vue opérationnelle (LOG-04)
 * et inspection (LOG-05). Nécessite la base de développement (pnpm db:create && pnpm db:migrate).
 */
describe('Logistique et suivi (e2e)', () => {
  const stamp = Date.now();
  const clientEmail = `log-client-${stamp}@exemple-warrior.cm`;
  const agentEmail = `log-agent-${stamp}@exemple-warrior.cm`;
  const otherEmail = `log-autre-${stamp}@exemple-warrior.cm`;
  const reference = `TEST-LOG-${stamp}`;
  const otherReference = `TEST-LOG-AUTRE-${stamp}`;

  const otp = new CapturingOtpSender();
  const mail = new CountingMail();

  let app: INestApplication;
  let prisma: PrismaService;
  let client: ReturnType<typeof request.agent>;
  let agent: ReturnType<typeof request.agent>;
  let orderId = '';
  let otherOrderId = '';

  async function signIn(email: string) {
    const session = request.agent(app.getHttpServer());
    await session
      .post('/v1/auth/email-otp/send-verification-otp')
      .send({ email, type: 'sign-in' })
      .expect(200);
    await session.post('/v1/auth/sign-in/email-otp').send({ email, otp: otp.lastCode }).expect(200);
    return session;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
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

    client = await signIn(clientEmail);
    agent = await signIn(agentEmail);
    const other = await signIn(otherEmail);
    void other;

    await prisma.user.update({ where: { email: agentEmail }, data: { role: 'LOGISTICS_AGENT' } });

    // Les commandes de test sont créées directement en base : le lot ORD n'est pas concerné ici.
    const [clientUser, otherUser] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: clientEmail } }),
      prisma.user.findUniqueOrThrow({ where: { email: otherEmail } }),
    ]);
    const order = await prisma.order.create({
      data: { reference, userId: clientUser.id, totalXaf: 250_000, shippingMode: 'AIR' },
    });
    orderId = order.id;
    const otherOrder = await prisma.order.create({
      data: {
        reference: otherReference,
        userId: otherUser.id,
        totalXaf: 90_000,
        shippingMode: 'SEA',
      },
    });
    otherOrderId = otherOrder.id;
  });

  afterAll(async () => {
    // Rien de ce que le test a créé ne doit rester en base.
    const ids = [orderId, otherOrderId].filter(Boolean);
    await prisma.inspectionReport.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.parcel.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({
      where: { email: { in: [clientEmail, agentEmail, otherEmail] } },
    });
    await app.close();
  });

  it('exige une session', async () => {
    await request(app.getHttpServer()).get('/v1/logistics/orders').expect(401);
    await request(app.getHttpServer()).get(`/v1/logistics/orders/${reference}`).expect(401);
    await request(app.getHttpServer())
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({})
      .expect(401);
  });

  it('montre au client ses commandes, et seulement les siennes', async () => {
    const list = await client.get('/v1/logistics/orders').expect(200);
    const references = list.body.orders.map((order: { reference: string }) => order.reference);
    expect(references).toContain(reference);
    expect(references).not.toContain(otherReference);

    const detail = await client.get(`/v1/logistics/orders/${reference}`).expect(200);
    expect(detail.body.order.stage).toBe('ORDER_PAID');
    expect(detail.body.order.nextStage).toBe('SUPPLIER_CONFIRMED');
    expect(detail.body.parcel.code).toMatch(/^WS-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(detail.body.stages).toHaveLength(13);

    // La commande d'un autre client répond « introuvable », sans révéler son existence.
    await client.get(`/v1/logistics/orders/${otherReference}`).expect(404);
  });

  it('refuse à un client d’enregistrer un événement ou de voir le tableau', async () => {
    await client
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({
        stage: 'SUPPLIER_CONFIRMED',
        occurredAt: new Date().toISOString(),
        description: 'Tentative client',
      })
      .expect(403);
    await client.get('/v1/logistics/board').expect(403);
    await client
      .post('/v1/logistics/board/advance')
      .send({ orderIds: [orderId], description: 'x' })
      .expect(403);
  });

  it('refuse une saisie invalide', async () => {
    const invalid = await agent
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({ stage: 'PAS_UNE_ETAPE', occurredAt: 'hier', description: '' })
      .expect(400);
    expect(invalid.body.message).toBe('Certaines informations sont invalides.');
    expect(invalid.body.issues.map((issue: { path: string }) => issue.path)).toEqual(
      expect.arrayContaining(['stage', 'occurredAt', 'description']),
    );
    await agent
      .post('/v1/logistics/orders/INCONNUE/events')
      .send({
        stage: 'SUPPLIER_CONFIRMED',
        occurredAt: new Date().toISOString(),
        description: 'Commande inexistante',
      })
      .expect(404);
  });

  it('enregistre un événement, fait avancer la commande et notifie une seule fois', async () => {
    mail.sent = [];
    const created = await agent
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({
        stage: 'SUPPLIER_CONFIRMED',
        occurredAt: '2026-09-20T08:30:00.000Z',
        description: 'Le fournisseur a confirmé la commande et le délai de production.',
        proofUrl: 'https://exemple.test/preuves/confirmation.pdf',
      })
      .expect(201);

    expect(created.body.stage).toBe('SUPPLIER_CONFIRMED');
    expect(created.body.previousStage).toBe('ORDER_PAID');
    expect(created.body.recordedByName).toBeTruthy();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.stage).toBe('SUPPLIER_CONFIRMED');

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.template).toBe('shipment-update');
    expect(mail.sent[0]?.to).toBe(clientEmail);
    const data = mail.sent[0]?.data as { stage: string; trackingCode: string; trackingUrl: string };
    expect(data.stage).toBe('SUPPLIER_CONFIRMED');
    expect(data.trackingCode).toMatch(/^WS-/);
    expect(data.trackingUrl).toContain(`/importations/${reference}`);

    // Deux enregistrements identiques : l'historique s'enrichit, la notification ne repart pas.
    await agent
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({
        stage: 'SUPPLIER_CONFIRMED',
        occurredAt: '2026-09-20T08:30:00.000Z',
        description: 'Le fournisseur a confirmé la commande et le délai de production.',
      })
      .expect(201);
    expect(mail.sent).toHaveLength(1);

    const detail = await client.get(`/v1/logistics/orders/${reference}`).expect(200);
    expect(detail.body.events).toHaveLength(2);
    expect(detail.body.events[0].proofUrl === null || detail.body.events[1].proofUrl === null).toBe(
      true,
    );
  });

  it('refuse un retour en arrière à un agent, l’accepte à un administrateur avec motif', async () => {
    mail.sent = [];
    const refused = await agent
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({
        stage: 'ORDER_PAID',
        occurredAt: new Date().toISOString(),
        description: 'Erreur de saisie',
      })
      .expect(403);
    expect(refused.body.message).toContain('administrateur');

    await prisma.user.update({ where: { email: agentEmail }, data: { role: 'ADMIN' } });

    const missingReason = await agent
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({
        stage: 'ORDER_PAID',
        occurredAt: new Date().toISOString(),
        description: 'Erreur de saisie',
      })
      .expect(400);
    expect(missingReason.body.code).toBe('rollback_reason_required');

    const rolledBack = await agent
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({
        stage: 'ORDER_PAID',
        occurredAt: new Date().toISOString(),
        description: 'Confirmation annulée par le fournisseur.',
        rollbackReason: 'Le fournisseur a retiré sa confirmation faute de matière première.',
      })
      .expect(201);
    expect(rolledBack.body.rollbackReason).toContain('matière première');
    expect(mail.sent).toHaveLength(1);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.stage).toBe('ORDER_PAID');

    await prisma.user.update({ where: { email: agentEmail }, data: { role: 'LOGISTICS_AGENT' } });
  });

  it('affiche le tableau par étape, cherche par code de colis et avance en groupe', async () => {
    const detail = await client.get(`/v1/logistics/orders/${reference}`).expect(200);
    const code: string = detail.body.parcel.code;

    const board = await agent
      .get(`/v1/logistics/board?recherche=${encodeURIComponent(code)}`)
      .expect(200);
    expect(board.body.columns).toHaveLength(13);
    expect(board.body.total).toBe(1);
    const column = board.body.columns.find((c: { stage: string }) => c.stage === 'ORDER_PAID');
    expect(column.orders[0].reference).toBe(reference);
    expect(column.orders[0].parcelCode).toBe(code);
    expect(column.orders[0].customerName).toBeTruthy();

    const filtered = await agent
      .get('/v1/logistics/board?mode=SEA&recherche=TEST-LOG-')
      .expect(200);
    const seaRefs = filtered.body.columns.flatMap((c: { orders: { reference: string }[] }) =>
      c.orders.map((o) => o.reference),
    );
    expect(seaRefs).toContain(otherReference);
    expect(seaRefs).not.toContain(reference);

    mail.sent = [];
    const advanced = await agent
      .post('/v1/logistics/board/advance')
      .send({
        orderIds: [orderId, otherOrderId, 'inexistante'],
        description: 'Lot confirmé auprès des fournisseurs.',
      })
      .expect(201);
    expect(advanced.body.advanced).toHaveLength(2);
    expect(advanced.body.skipped).toEqual([
      { orderId: 'inexistante', reason: 'Commande introuvable.' },
    ]);
    expect(mail.sent).toHaveLength(2);

    const orders = await prisma.order.findMany({ where: { id: { in: [orderId, otherOrderId] } } });
    expect(orders.every((order) => order.stage === 'SUPPLIER_CONFIRMED')).toBe(true);
  });

  it('enregistre une inspection, l’archive et la rend consultable par le client', async () => {
    mail.sent = [];
    const invalid = await agent
      .post(`/v1/logistics/orders/${reference}/inspections`)
      .send({ result: 'PARFAIT', weightGrams: 1.5 })
      .expect(400);
    expect(invalid.body.issues.map((issue: { path: string }) => issue.path)).toEqual(
      expect.arrayContaining(['result', 'weightGrams']),
    );

    const report = await agent
      .post(`/v1/logistics/orders/${reference}/inspections`)
      .send({
        result: 'WITH_RESERVATIONS',
        quantityExpected: 500,
        quantityReceived: 496,
        defects: '4 pièces rayées',
        packaging: 'Cartons doubles, coins renforcés',
        measurements: '40 × 30 × 20 cm par carton',
        weightGrams: 48_500,
        photoUrls: [
          'https://exemple.test/inspection/1.jpg',
          'https://exemple.test/inspection/2.jpg',
        ],
        videoUrl: 'https://exemple.test/inspection/video.mp4',
        notes: 'Réserve levée si le fournisseur remplace les 4 pièces.',
      })
      .expect(201);
    expect(report.body.result).toBe('WITH_RESERVATIONS');
    expect(report.body.resultLabel).toBe('Réserve');
    expect(report.body.photoUrls).toHaveLength(2);

    // L'inspection fait avancer la commande à l'étape « Inspection » et prévient le client une fois.
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.stage).toBe('INSPECTION');
    expect(mail.sent).toHaveLength(1);

    const detail = await client.get(`/v1/logistics/orders/${reference}`).expect(200);
    expect(detail.body.inspections).toHaveLength(1);
    expect(detail.body.inspections[0].id).toBe(report.body.id);
    expect(detail.body.order.lastInspectionResult).toBe('WITH_RESERVATIONS');
    expect(detail.body.events[0].stage).toBe('INSPECTION');
    expect(detail.body.events[0].inspectionId).toBe(report.body.id);
    expect(detail.body.events[0].description).toContain('Réserve');

    // Une fois la marchandise partie, plus d'inspection possible.
    await agent
      .post(`/v1/logistics/orders/${reference}/events`)
      .send({
        stage: 'IN_TRANSIT',
        occurredAt: new Date().toISOString(),
        description: 'Conteneur chargé à Guangzhou.',
      })
      .expect(201);
    await agent
      .post(`/v1/logistics/orders/${reference}/inspections`)
      .send({ result: 'COMPLIANT' })
      .expect(409);
  });
});
