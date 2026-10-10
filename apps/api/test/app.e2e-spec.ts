import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Aucune requête SQL dans ces tests : une URL factice suffit.
    process.env.DATABASE_URL ??= 'postgresql://ws:ws@localhost:5432/warrior_sourcing';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    expect(app.get(ConfigService)).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/calculator/landed-cost renvoie une estimation', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/calculator/landed-cost')
      .send({ quantity: 100, unitPurchasePrice: 2_000, freight: 50_000, unitSellingPrice: 3_500 })
      .expect(200);

    expect(response.body.provenance).toBe('ESTIMATE');
    expect(response.body.result.totalCost).toBe(250_000);
    expect(response.body.result.unitLandedCost).toBe(2_500);
    expect(response.body.result.selling.breakEvenUnits).toBe(72);
  });

  it('refuse une saisie invalide avec un message lisible', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/calculator/landed-cost')
      .send({ quantity: 0, unitPurchasePrice: -5 })
      .expect(400);

    expect(response.body.message).toBe('Certaines informations sont invalides.');
    expect(response.body.issues.map((issue: { path: string }) => issue.path)).toEqual(
      expect.arrayContaining(['quantity', 'unitPurchasePrice']),
    );
  });
});
