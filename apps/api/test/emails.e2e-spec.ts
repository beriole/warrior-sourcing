import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';

/**
 * Prévisualisation des emails exposée par l'API en développement.
 * Aucun envoi ni accès base ici : uniquement le rendu.
 */
describe('Emails (e2e)', () => {
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

  it('liste les templates disponibles et l’adresse de test', async () => {
    const response = await request(app.getHttpServer()).get('/v1/dev/emails').expect(200);

    const keys = response.body.templates.map((template: { key: string }) => template.key);
    expect(keys).toEqual(
      expect.arrayContaining(['welcome', 'payment-confirmed', 'shipment-update', 'sourcing-result', 'course-progress']),
    );
    expect(response.body.testRecipient).toContain('@');
  });

  it('rend un email en HTML avec un jeu de données choisi', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/dev/emails/payment-confirmed')
      .query({ fixture: 'Paiement MTN MoMo' })
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    // Intl sépare les milliers par une espace insécable étroite : on normalise avant de comparer.
    expect(response.text.replaceAll(/\s/g, ' ')).toContain('247 000 FCFA');
    expect(response.text).toContain('#WR-209184');
  });

  it('fournit la version texte', async () => {
    const response = await request(app.getHttpServer()).get('/v1/dev/emails/welcome/text').expect(200);

    expect(response.body.subject.length).toBeGreaterThan(5);
    expect(response.body.text).toContain('WARRIOR SOURCING');
  });

  it('refuse un template inconnu', async () => {
    await request(app.getHttpServer()).get('/v1/dev/emails/template-inexistant').expect(404);
  });

  it('refuse un jeu de données inconnu', async () => {
    await request(app.getHttpServer()).get('/v1/dev/emails/welcome').query({ fixture: 'inexistant' }).expect(404);
  });
});
