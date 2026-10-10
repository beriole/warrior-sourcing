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
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Intercepte le code au lieu de l'envoyer : le test lit ce que l'utilisateur recevrait. */
class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/**
 * Transitaires, grilles tarifaires (CARGO-03) et branchement au calculateur (CARGO-05).
 * Nécessite la base de développement (pnpm db:create && pnpm db:migrate).
 */
describe('Transitaires et calculateur (e2e)', () => {
  const email = `cargo-${Date.now()}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();

  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let forwarderId = '';
  let simulationId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OtpSender)
      .useValue(otp)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(AUTH_BASE_PATH, toNodeHandler(app.get<Auth>(AUTH)));
    app.use(express.json());
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    agent = request.agent(app.getHttpServer());

    await agent
      .post('/v1/auth/email-otp/send-verification-otp')
      .send({ email, type: 'sign-in' })
      .expect(200);
    await agent.post('/v1/auth/sign-in/email-otp').send({ email, otp: otp.lastCode }).expect(200);
  });

  afterAll(async () => {
    // Rien de ce que le test a créé ne doit rester en base.
    await prisma.importSimulation.deleteMany({ where: { label: { startsWith: 'Test e2e' } } });
    if (forwarderId) await prisma.forwarder.delete({ where: { id: forwarderId } }).catch(() => null);
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('exige une session pour toucher aux transitaires', async () => {
    await request(app.getHttpServer()).get('/v1/cargo/forwarders').expect(401);
    await request(app.getHttpServer()).post('/v1/cargo/forwarders').send({}).expect(401);
  });

  it('refuse l’accès à un compte client, même avec une session valide', async () => {
    const refused = await agent.get('/v1/cargo/forwarders').expect(403);
    expect(refused.body.message).toBe("Votre compte n'a pas accès à cette fonctionnalité.");

    await agent
      .post('/v1/cargo/forwarders')
      .send({ name: 'Transitaire pirate', modes: ['AIR'] })
      .expect(403);
    await agent.patch('/v1/cargo/forwarders/inconnu').send({ active: false }).expect(403);
    await agent
      .post('/v1/cargo/forwarders/inconnu/rates')
      .send({ mode: 'AIR', unit: 'KG', unitPriceXaf: 1, transitDays: 1, effectiveFrom: new Date(), source: 'x' })
      .expect(403);
  });

  it('ouvre les options du calculateur à tous, avec la fourchette de repli datée', async () => {
    const options = await request(app.getHttpServer()).get('/v1/cargo/options').expect(200);

    expect(options.body.fallback.provenance).toBe('ESTIMATE');
    expect(options.body.fallback.observedAt).toBe('2026-09-20');
    expect(options.body.fallback.ranges).toHaveLength(3);
  });

  describe('avec un compte administrateur', () => {
    beforeAll(async () => {
      // Le rôle est lu côté serveur à chaque requête : la promotion suffit.
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    });

    it('crée un transitaire puis refuse une saisie invalide', async () => {
      const created = await agent
        .post('/v1/cargo/forwarders')
        .send({
          name: 'Test e2e Cargo Douala',
          contactPhone: '+237670112233',
          cities: ['Douala', 'Yaoundé'],
          modes: ['AIR', 'SEA'],
          notes: 'Transitaire créé par le test automatisé.',
        })
        .expect(201);

      forwarderId = created.body.id;
      expect(created.body.active).toBe(true);
      expect(created.body.rateCount).toBe(0);

      const invalid = await agent.post('/v1/cargo/forwarders').send({ name: 'X', modes: [] }).expect(400);
      expect(invalid.body.message).toBe('Certaines informations sont invalides.');
    });

    it('conserve l’historique des prix : une nouvelle grille date l’ancienne', async () => {
      await agent
        .post(`/v1/cargo/forwarders/${forwarderId}/rates`)
        .send({
          mode: 'AIR',
          unit: 'KG',
          unitPriceXaf: 2_600,
          minimumChargeXaf: 20_000,
          weightBreakKg: 0,
          transitDays: 14,
          effectiveFrom: '2026-01-15T00:00:00.000Z',
          source: 'Devis du 15/01/2026',
        })
        .expect(201);

      const recent = await agent
        .post(`/v1/cargo/forwarders/${forwarderId}/rates`)
        .send({
          mode: 'AIR',
          unit: 'KG',
          unitPriceXaf: 2_000,
          minimumChargeXaf: 20_000,
          weightBreakKg: 20,
          transitDays: 12,
          effectiveFrom: '2026-06-01T00:00:00.000Z',
          source: 'Devis du 01/06/2026',
        })
        .expect(201);
      expect(recent.body.unitPriceXaf).toBe(2_000);

      const detail = await agent.get(`/v1/cargo/forwarders/${forwarderId}`).expect(200);
      expect(detail.body.forwarder.rateCount).toBe(2);
      // Les deux prix coexistent : le plus récent en tête, l'ancien toujours lisible.
      expect(detail.body.rates.map((rate: { unitPriceXaf: number }) => rate.unitPriceXaf)).toEqual([
        2_000, 2_600,
      ]);
    });

    it('retrouve le transitaire par nom et par ville', async () => {
      const byName = await agent.get('/v1/cargo/forwarders?recherche=Test e2e').expect(200);
      expect(byName.body.forwarders.map((item: { id: string }) => item.id)).toContain(forwarderId);

      const byCity = await agent.get('/v1/cargo/forwarders?ville=Douala&mode=AIR').expect(200);
      expect(byCity.body.forwarders.map((item: { id: string }) => item.id)).toContain(forwarderId);
    });
  });

  describe('branchement au calculateur (CARGO-05)', () => {
    it('applique le tarif du transitaire et dit depuis quand il est valable', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/calculator/import')
        .send({
          quantity: 100,
          unitPurchasePrice: 2_000,
          mode: 'AIR',
          forwarderId,
          parcels: [{ cartons: 2, weightKgPerCarton: 10, lengthCm: 60, widthCm: 40, heightCm: 30 }],
        })
        .expect(200);

      expect(response.body.provenance).toBe('ESTIMATE');
      // 24 kg facturables : le palier des 20 kg s'applique, à 2 000 FCFA le kilo.
      expect(response.body.result.freight.origin).toBe('TARIFF');
      expect(response.body.result.freight.amountXaf).toBe(48_000);
      expect(response.body.result.freight.effectiveFrom).toBe('2026-06-01T00:00:00.000Z');
      expect(response.body.result.freight.source).toBe('Devis du 01/06/2026');
      expect(response.body.comparison).toHaveLength(3);
      // Pas de grille maritime chez ce transitaire : repli marqué « estimation ».
      const sea = response.body.comparison.find((item: { mode: string }) => item.mode === 'SEA');
      expect(sea.freight.provenance).toBe('ESTIMATE');
    });

    it('bascule sur la fourchette de repli sans transitaire', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/calculator/import')
        .send({
          quantity: 10,
          unitPurchasePrice: 5_000,
          mode: 'SEA',
          parcels: [{ cartons: 2, weightKgPerCarton: 10, lengthCm: 60, widthCm: 40, heightCm: 30 }],
        })
        .expect(200);

      expect(response.body.result.freight.origin).toBe('FALLBACK');
      expect(response.body.result.freight.range).toEqual({ lowXaf: 12_960, highXaf: 25_920 });
    });

    it('refuse une simulation invalide', async () => {
      await request(app.getHttpServer())
        .post('/v1/calculator/import')
        .send({ quantity: 0, unitPurchasePrice: -1, mode: 'FUSEE' })
        .expect(400);
    });
  });

  describe('simulations sauvegardées (CALC-05)', () => {
    const input = {
      quantity: 50,
      unitPurchasePrice: 3_000,
      mode: 'AIR' as const,
      forwarderId: '',
      parcels: [{ cartons: 1, weightKgPerCarton: 12, lengthCm: 50, widthCm: 40, heightCm: 30 }],
    };

    it('exige un compte pour sauvegarder', async () => {
      await request(app.getHttpServer())
        .post('/v1/calculator/simulations')
        .send({ label: 'Test e2e refusé', input: { ...input, forwarderId } })
        .expect(401);
    });

    it('sauvegarde, retrouve et duplique une simulation', async () => {
      const saved = await agent
        .post('/v1/calculator/simulations')
        .send({ label: 'Test e2e montres', input: { ...input, forwarderId } })
        .expect(201);

      simulationId = saved.body.id;
      expect(saved.body.result.freight.forwarderName).toBe('Test e2e Cargo Douala');

      const reopened = await agent.get(`/v1/calculator/simulations/${simulationId}`).expect(200);
      expect(reopened.body.input.quantity).toBe(50);

      const copy = await agent
        .post(`/v1/calculator/simulations/${simulationId}/duplication`)
        .expect(201);
      expect(copy.body.label).toBe('Copie de Test e2e montres');
      expect(copy.body.totalXaf).toBe(saved.body.totalXaf);

      const list = await agent.get('/v1/calculator/simulations').expect(200);
      expect(list.body.total).toBe(2);
    });

    it('ne laisse voir que ses propres simulations', async () => {
      await request(app.getHttpServer())
        .get(`/v1/calculator/simulations/${simulationId}`)
        .expect(401);
      await agent.get('/v1/calculator/simulations/identifiant-inconnu').expect(404);
    });

    it('supprime une simulation', async () => {
      await agent.delete(`/v1/calculator/simulations/${simulationId}`).expect(200);
      await agent.get(`/v1/calculator/simulations/${simulationId}`).expect(404);
    });
  });

  it('désactive un transitaire sans le supprimer, et le retire du calculateur', async () => {
    const disabled = await agent
      .patch(`/v1/cargo/forwarders/${forwarderId}`)
      .send({ active: false })
      .expect(200);
    expect(disabled.body.active).toBe(false);

    const options = await request(app.getHttpServer()).get('/v1/cargo/options').expect(200);
    expect(options.body.forwarders.map((item: { id: string }) => item.id)).not.toContain(forwarderId);

    // La fiche et son historique restent consultables par l'administration.
    const detail = await agent.get(`/v1/cargo/forwarders/${forwarderId}`).expect(200);
    expect(detail.body.rates).toHaveLength(2);
  });
});
