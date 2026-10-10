import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';

/**
 * Forme des réponses d'erreur (§45) : un message lisible, un code stable pour l'interface,
 * et jamais de détail technique exposé.
 */
describe('Erreurs de l’API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://ws:ws@localhost:5432/warrior_sourcing';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('décrit une saisie invalide champ par champ', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/calculator/landed-cost')
      .send({ quantity: 0 })
      .expect(400);

    expect(response.body.code).toBe('invalid_request');
    expect(response.body.message).toBe('Certaines informations sont invalides.');
    expect(response.body.issues[0]).toHaveProperty('path');
  });

  it('répond en français quand la session manque', async () => {
    const response = await request(app.getHttpServer()).get('/v1/me').expect(401);

    expect(response.body.code).toBe('unauthenticated');
    expect(response.body.message).toMatch(/connecté/i);
    expect(response.body).not.toHaveProperty('stack');
  });

  it('répond proprement sur une route inconnue', async () => {
    const response = await request(app.getHttpServer()).get('/v1/route-inexistante').expect(404);

    expect(response.body.code).toBe('not_found');
    // Nest renvoie « Cannot GET … » par défaut : ce texte ne doit jamais sortir tel quel.
    expect(response.body.message).not.toMatch(/Cannot GET/);
  });

  it('n’expose jamais de terme technique anglais dans le message', async () => {
    const response = await request(app.getHttpServer()).get('/v1/me').expect(401);

    for (const leak of ['Internal', 'Unauthorized', 'Error:', 'TypeError']) {
      expect(response.body.message).not.toContain(leak);
    }
  });
});
