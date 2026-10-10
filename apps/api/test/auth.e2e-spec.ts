import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { AUTH_BASE_PATH, isAcceptedPhoneNumber, type Auth } from '../src/auth/auth.config.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import { OtpSender } from '../src/auth/otp-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Intercepte le code au lieu de l'envoyer : le test lit ce que l'utilisateur recevrait. */
class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/**
 * Parcours réel : demande de code par email, vérification, session, onboarding.
 * Nécessite la base de développement (pnpm db:create && pnpm db:migrate).
 */
describe('Connexion par email (e2e)', () => {
  const email = `test-${Date.now()}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();

  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;

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
  });

  afterAll(async () => {
    // Le compte créé par le test ne doit pas rester en base.
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('exige une session pour consulter son compte', async () => {
    await request(app.getHttpServer()).get('/v1/me').expect(401);
  });

  it('crée le compte à la vérification du code puis ouvre une session', async () => {
    await agent
      .post('/v1/auth/email-otp/send-verification-otp')
      .send({ email, type: 'sign-in' })
      .expect(200);
    expect(otp.lastCode).toMatch(/^\d{6}$/);

    const signedIn = await agent.post('/v1/auth/sign-in/email-otp').send({ email, otp: otp.lastCode }).expect(200);

    expect(signedIn.body.user.email).toBe(email);
    // Le rôle vient du serveur : il ne peut pas être imposé par la requête.
    expect(signedIn.body.user.role).toBe('CLIENT');

    const me = await agent.get('/v1/me').expect(200);
    expect(me.body.user.email).toBe(email);
    expect(me.body.onboardingCompleted).toBe(false);
  });

  it('refuse un code erroné', async () => {
    await agent.post('/v1/auth/sign-in/email-otp').send({ email, otp: '000000' }).expect(400);
  });

  it('enregistre le profil d’importateur et marque l’onboarding terminé', async () => {
    await agent.put('/v1/me/profile').send({ level: 'EXPERT_INCONNU', goals: [] }).expect(400);

    // Sans nom, l'onboarding est refusé : un compte créé par code email n'en a aucun,
    // et tout ce qui s'adresse ensuite à la personne en dépend.
    await agent
      .put('/v1/me/profile')
      .send({
        level: 'BEGINNER',
        goals: ['LEARN'],
        budgetRange: 'FROM_100K_TO_300K',
        interests: ['PHONES'],
      })
      .expect(400);

    const saved = await agent
      .put('/v1/me/profile')
      .send({
        name: 'Marie Ngo',
        level: 'BEGINNER',
        goals: ['LEARN', 'FIND_PRODUCTS'],
        budgetRange: 'FROM_100K_TO_300K',
        interests: ['PHONES'],
        city: 'Douala',
      })
      .expect(200);

    expect(saved.body.onboardingCompleted).toBe(true);
    expect(saved.body.profile.city).toBe('Douala');

    const me = await agent.get('/v1/me').expect(200);
    expect(me.body.onboardingCompleted).toBe(true);
    expect(me.body.profile.goals).toEqual(['LEARN', 'FIND_PRODUCTS']);
    // Le nom est écrit sur le compte, pas sur le profil d'importateur.
    expect(me.body.user.name).toBe('Marie Ngo');
  });

  it('expose les options de l’onboarding', async () => {
    const options = await agent.get('/v1/me/profile/options').expect(200);

    expect(options.body.levels).toHaveLength(5);
    expect(options.body.budgets[0]).toMatchObject({ id: 'UNDER_100K' });
    expect(options.body.interests.map((item: { id: string }) => item.id)).toContain('PHONES');
  });

  it('valide toujours le format d’un numéro camerounais pour le profil', () => {
    // Le téléphone n'ouvre plus de session, mais il sert au paiement et à la livraison.
    expect(isAcceptedPhoneNumber('0670112233')).toBe(false);
    expect(isAcceptedPhoneNumber('+237570112233')).toBe(false);
    expect(isAcceptedPhoneNumber('+237670112233')).toBe(true);
  });
});
