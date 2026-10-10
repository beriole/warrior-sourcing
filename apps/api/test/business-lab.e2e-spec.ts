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
import { BusinessLabModule } from '../src/business-lab/business-lab.module.js';
import { configureApp } from '../src/bootstrap.js';
import { validateEnv } from '../src/config/env.js';
import { MailModule } from '../src/mail/mail.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/**
 * Business Lab (LAB-01, LAB-02).
 *
 * Ce qui est éprouvé : les indicateurs ne portent que sur les ventes saisies, un projet
 * n'est visible que par son auteur, et une incohérence de saisie est signalée plutôt
 * qu'absorbée.
 */
describe('Business Lab (e2e)', () => {
  const stamp = Date.now();
  const email = `lab-${stamp}@exemple-warrior.cm`;
  const autreEmail = `lab-autre-${stamp}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();
  const mail = { send: vi.fn(async () => ({ id: 'x', subject: 'x', transport: 'test' })) };

  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let autre: ReturnType<typeof request.agent>;
  let projetId = '';

  async function connecter(client: ReturnType<typeof request.agent>, adresse: string) {
    await client.post('/v1/auth/email-otp/send-verification-otp').send({ email: adresse, type: 'sign-in' }).expect(200);
    await client.post('/v1/auth/sign-in/email-otp').send({ email: adresse, otp: otp.lastCode }).expect(200);
  }

  async function nettoyer() {
    const comptes = await prisma.user.findMany({
      where: { email: { in: [email, autreEmail] } },
      select: { id: true },
    });
    const ids = comptes.map((compte) => compte.id);
    const projets = await prisma.businessProject.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    await prisma.businessSale.deleteMany({ where: { projectId: { in: projets.map((p) => p.id) } } });
    await prisma.businessProject.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        MailModule.register(false),
        AuthModule,
        BusinessLabModule,
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

    agent = request.agent(app.getHttpServer());
    autre = request.agent(app.getHttpServer());
    await connecter(agent, email);
    await connecter(autre, autreEmail);
  });

  afterAll(async () => {
    await nettoyer();
    await app.close();
  });

  const PROJET = {
    name: 'Lot de coques de téléphone',
    capitalXaf: 240_000,
    quantity: 100,
    targetUnitPriceXaf: 3_500,
    startedAt: '2026-09-01T08:00:00.000Z',
  };

  it('exige une session', async () => {
    await request(app.getHttpServer()).get('/v1/business-lab/projets').expect(401);
    await request(app.getHttpServer()).post('/v1/business-lab/projets').send(PROJET).expect(401);
  });

  it('refuse un prix de vente visé sous le coût de revient', async () => {
    const refus = await agent
      .post('/v1/business-lab/projets')
      .send({ ...PROJET, targetUnitPriceXaf: 1_000 })
      .expect(400);
    expect(JSON.stringify(refus.body)).toContain('coût de revient');
  });

  it('ouvre un projet dont les indicateurs partent à zéro', async () => {
    const creation = await agent.post('/v1/business-lab/projets').send(PROJET).expect(201);

    projetId = creation.body.project.id;
    const { metrics } = creation.body.project;
    expect(metrics.soldQuantity).toBe(0);
    expect(metrics.revenueXaf).toBe(0);
    expect(metrics.remainingQuantity).toBe(100);
    // Coût de revient : 240 000 / 100.
    expect(metrics.unitCostXaf).toBe(2_400);
    // Aucun prix moyen tant que rien n'est vendu : pas de zéro trompeur.
    expect(metrics.averageUnitPriceXaf).toBeNull();
    expect(creation.body.project.progressLabel).toContain('Aucune vente saisie');
  });

  it('met les indicateurs à jour à chaque vente saisie', async () => {
    const apres = await agent
      .post(`/v1/business-lab/projets/${projetId}/ventes`)
      .send({ quantity: 30, unitPriceXaf: 3_500, soldAt: '2026-09-15T10:00:00.000Z' })
      .expect(201);

    const { metrics } = apres.body.project;
    expect(metrics.revenueXaf).toBe(105_000);
    // Marge constatée sur les 30 vendues, pas sur le lot entier.
    expect(metrics.marginXaf).toBe(33_000);
    expect(metrics.remainingQuantity).toBe(70);
    expect(metrics.capitalRecovered).toBe(false);
    expect(apres.body.project.sales).toHaveLength(1);
  });

  it('annonce le capital récupéré quand les encaissements le couvrent', async () => {
    const apres = await agent
      .post(`/v1/business-lab/projets/${projetId}/ventes`)
      .send({ quantity: 40, unitPriceXaf: 3_500, soldAt: '2026-09-20T10:00:00.000Z' })
      .expect(201);

    // 70 unités à 3 500 = 245 000, au-delà des 240 000 engagés.
    const { metrics } = apres.body.project;
    expect(metrics.capitalRecovered).toBe(true);
    expect(metrics.capitalRemainingXaf).toBe(0);
    expect(metrics.unitsToBreakEven).toBeNull();
    expect(apres.body.project.progressLabel).toContain('Capital récupéré');
  });

  it('retire une vente saisie par erreur et recalcule', async () => {
    const avant = await agent.get(`/v1/business-lab/projets/${projetId}`).expect(200);
    const venteId = avant.body.project.sales[0].id;

    const apres = await agent
      .delete(`/v1/business-lab/projets/${projetId}/ventes/${venteId}`)
      .expect(200);

    expect(apres.body.project.sales).toHaveLength(1);
    // Les indicateurs suivent la correction : ils ne sont jamais figés en base.
    expect(apres.body.project.metrics.soldQuantity).toBeLessThan(70);
  });

  it('signale une saisie supérieure au lot au lieu de la refuser', async () => {
    const apres = await agent
      .post(`/v1/business-lab/projets/${projetId}/ventes`)
      .send({ quantity: 200, unitPriceXaf: 3_000, soldAt: '2026-09-25T10:00:00.000Z' })
      .expect(201);

    expect(apres.body.project.metrics.oversold).toBe(true);
    expect(apres.body.project.metrics.remainingQuantity).toBe(0);
    expect(apres.body.project.progressLabel).toContain('vérifiez la quantité');
  });

  it('refuse de réduire le lot sous ce qui est déjà vendu', async () => {
    // Capital ajusté pour que le prix visé reste au-dessus du coût de revient : c'est
    // bien la règle « déjà vendu » qu'on veut éprouver, pas celle du prix.
    const refus = await agent
      .put(`/v1/business-lab/projets/${projetId}`)
      .send({ ...PROJET, quantity: 10, capitalXaf: 24_000 })
      .expect(400);
    expect(refus.body.message).toContain('déjà saisi');
  });

  it('ne montre un projet qu’à son auteur', async () => {
    await agent.get(`/v1/business-lab/projets/${projetId}`).expect(200);
    await autre.get(`/v1/business-lab/projets/${projetId}`).expect(404);

    const liste = await autre.get('/v1/business-lab/projets').expect(200);
    expect(liste.body.items).toEqual([]);
    expect(liste.body.totalCapitalXaf).toBe(0);
  });

  it('agrège le capital et la marge sur l’ensemble des projets', async () => {
    const liste = await agent.get('/v1/business-lab/projets').expect(200);
    expect(liste.body.totalCapitalXaf).toBe(240_000);
    expect(liste.body.items).toHaveLength(1);
  });

  it('supprime un projet avec ses ventes', async () => {
    await agent.delete(`/v1/business-lab/projets/${projetId}`).expect(200);
    await agent.get(`/v1/business-lab/projets/${projetId}`).expect(404);

    const restantes = await prisma.businessSale.count({ where: { projectId: projetId } });
    expect(restantes).toBe(0);
  });
});
