import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import request from 'supertest';
import { AcademyModule } from '../src/academy/academy.module.js';
import { AUTH_BASE_PATH, type Auth } from '../src/auth/auth.config.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import { OtpSender } from '../src/auth/otp-sender.js';
import { configureApp } from '../src/bootstrap.js';
import { validateEnv } from '../src/config/env.js';
import { MailModule } from '../src/mail/mail.module.js';
import { MailService } from '../src/mail/mail.service.js';
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
 * Academy (lot ACA) : catalogue, droit d'accès, lecteur, progression, notes, quiz, bibliothèque.
 *
 * Le test central est celui du droit d'accès : un compte connecté mais non inscrit ne doit
 * jamais obtenir l'URL de lecture d'une leçon payante (§54). Les emails sont capturés.
 * Nécessite la base de développement (pnpm db:create && pnpm db:migrate).
 */
const PREFIX = 'e2e-aca-';
const GRATUITE = `${PREFIX}gratuite`;
const PAYANTE = `${PREFIX}payante`;
const BROUILLON = `${PREFIX}brouillon`;
const RESSOURCE_LIBRE = `${PREFIX}ressource-libre`;
const RESSOURCE_RESERVEE = `${PREFIX}ressource-reservee`;

const FICHIER_DEMO = 'data:text/plain;charset=utf-8,Fichier%20de%20test';

describe('Academy (e2e)', () => {
  const marqueur = Date.now();
  const emailClient = `aca-client-${marqueur}@exemple-warrior.cm`;
  const emailInscrit = `aca-inscrit-${marqueur}@exemple-warrior.cm`;
  const emailAdmin = `aca-admin-${marqueur}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();
  const mail = {
    send: vi.fn(async (_input: { template: string; to: string }) => ({
      id: 'x',
      subject: 'x',
      transport: 'test',
    })),
  };

  let app: INestApplication;
  let prisma: PrismaService;
  /** Visiteur sans session : les routes publiques se testent directement sur le serveur. */
  let anonyme: ReturnType<typeof request.agent>;
  /** Compte connecté sans aucune inscription : c'est lui qui doit se voir refuser la vidéo. */
  let sansDroit: ReturnType<typeof request.agent>;
  /** Compte à qui l'équipe ouvre l'accès à la formation payante. */
  let inscrit: ReturnType<typeof request.agent>;
  let admin: ReturnType<typeof request.agent>;

  let quizId = '';
  let idInscrit = '';

  async function connecter(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/email-otp/send-verification-otp').send({ email, type: 'sign-in' }).expect(200);
    await agent.post('/v1/auth/sign-in/email-otp').send({ email, otp: otp.lastCode }).expect(200);
    return agent;
  }

  /**
   * Nettoyage des données créées par ce fichier.
   *
   * Les **comptes** en faisaient partie et ne l'étaient pas : chaque exécution en laissait
   * trois derrière elle, et ils s'accumulaient dans la base de développement jusqu'à
   * encombrer l'écran « Utilisateurs » du back-office. Une suite de tests qui salit la
   * base qu'elle partage finit par rendre cette base inutilisable.
   */
  async function nettoyer() {
    await prisma.libraryResource.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.course.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.instructor.deleteMany({ where: { id: { startsWith: PREFIX } } });

    const comptes = await prisma.user.findMany({
      where: { email: { in: [emailClient, emailInscrit, emailAdmin] } },
      select: { id: true },
    });
    const ids = comptes.map((compte) => compte.id);
    if (ids.length === 0) return;

    // Les lignes qui dépendent du compte partent d'abord : la clé étrangère le refuserait
    // dans l'autre sens, et le test échouerait sur son propre ménage.
    await prisma.lessonNote.deleteMany({ where: { userId: { in: ids } } });
    await prisma.lessonProgress.deleteMany({ where: { userId: { in: ids } } });
    await prisma.quizAttempt.deleteMany({ where: { userId: { in: ids } } });
    await prisma.coursePurchase.deleteMany({ where: { userId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.importerProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.emailLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.account.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        MailModule.register(false),
        AuthModule,
        AcademyModule,
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

    const formateur = await prisma.instructor.create({
      data: {
        id: `${PREFIX}formateur`,
        name: 'Formateur de test',
        headline: 'Profil créé par les tests automatisés.',
      },
    });

    // ── Formation gratuite, avec un avis : la note moyenne doit être calculée, pas inventée.
    const gratuite = await prisma.course.create({
      data: {
        slug: GRATUITE,
        title: 'Formation de test gratuite',
        summary: 'Formation créée par les tests automatisés.',
        description: 'Description de test.',
        level: 'BEGINNER',
        theme: 'BASICS',
        access: 'FREE',
        priceXaf: 0,
        outcomes: ['Savoir faire une chose vérifiable.'],
        prerequisites: [],
        instructorId: formateur.id,
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    const chapitreGratuit = await prisma.chapter.create({
      data: { courseId: gratuite.id, title: 'Chapitre de test', position: 0 },
    });

    await prisma.lesson.create({
      data: {
        courseId: gratuite.id,
        chapterId: chapitreGratuit.id,
        slug: 'premiere',
        title: 'Première leçon de test',
        position: 0,
        durationMinutes: 10,
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    await prisma.lesson.create({
      data: {
        courseId: gratuite.id,
        chapterId: chapitreGratuit.id,
        slug: 'seconde',
        title: 'Seconde leçon de test',
        position: 1,
        durationMinutes: 20,
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    await prisma.courseReview.create({
      data: {
        courseId: gratuite.id,
        userId: `${PREFIX}auteur`,
        authorName: 'Auteur de test',
        rating: 4,
        comment: 'Avis créé par les tests automatisés.',
        publishedAt: new Date('2026-09-10T00:00:00.000Z'),
      },
    });

    // ── Formation payante : un extrait offert, une leçon fermée, un quiz.
    const payante = await prisma.course.create({
      data: {
        slug: PAYANTE,
        title: 'Formation de test payante',
        summary: 'Formation créée par les tests automatisés.',
        description: 'Description de test.',
        level: 'INTERMEDIATE',
        theme: 'SOURCING',
        access: 'PAID',
        priceXaf: 25_000,
        outcomes: [],
        prerequisites: [],
        instructorId: formateur.id,
        publishedAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    const chapitrePayant = await prisma.chapter.create({
      data: { courseId: payante.id, title: 'Chapitre payant de test', position: 0 },
    });

    await prisma.lesson.create({
      data: {
        courseId: payante.id,
        chapterId: chapitrePayant.id,
        slug: 'extrait',
        title: 'Extrait offert',
        position: 0,
        durationMinutes: 5,
        videoPublicId: 'warrior-sourcing/academy/e2e-extrait',
        videoFormat: 'mp4',
        preview: true,
        publishedAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    const leconPayante = await prisma.lesson.create({
      data: {
        courseId: payante.id,
        chapterId: chapitrePayant.id,
        slug: 'lecon-payante',
        title: 'Leçon payante',
        position: 1,
        durationMinutes: 15,
        videoPublicId: 'warrior-sourcing/academy/e2e-payante',
        videoFormat: 'mp4',
        preview: false,
        publishedAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    await prisma.lessonDocument.create({
      data: {
        lessonId: leconPayante.id,
        title: 'Document de test',
        fileFormat: 'txt',
        sizeBytes: 18,
        url: FICHIER_DEMO,
        position: 0,
      },
    });

    const quiz = await prisma.quiz.create({
      data: { chapterId: chapitrePayant.id, title: 'Quiz de test', passScorePercent: 50 },
    });
    quizId = quiz.id;

    await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        prompt: 'Première question de test ?',
        position: 0,
        explanation: 'Explication de test.',
        choices: {
          create: [
            { label: 'Bonne réponse', correct: true, position: 0 },
            { label: 'Mauvaise réponse', correct: false, position: 1 },
          ],
        },
      },
    });
    await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        prompt: 'Seconde question de test ?',
        position: 1,
        choices: {
          create: [
            { label: 'Bonne réponse', correct: true, position: 0 },
            { label: 'Mauvaise réponse', correct: false, position: 1 },
          ],
        },
      },
    });

    // ── Formation non publiée : ni listée, ni consultable.
    await prisma.course.create({
      data: {
        slug: BROUILLON,
        title: 'Formation de test non publiée',
        summary: 'Formation créée par les tests automatisés.',
        description: 'Description de test.',
        level: 'ADVANCED',
        theme: 'SELLING',
        access: 'FREE',
        outcomes: [],
        prerequisites: [],
        instructorId: formateur.id,
        publishedAt: null,
      },
    });

    // ── Bibliothèque : une ressource libre, une ressource réservée aux inscrits.
    await prisma.libraryResource.create({
      data: {
        slug: RESSOURCE_LIBRE,
        title: 'Ressource de test libre',
        description: 'Ressource créée par les tests automatisés.',
        type: 'CHECKLIST',
        theme: 'BASICS',
        fileFormat: 'txt',
        sizeBytes: 18,
        pageCount: 1,
        fileUrl: FICHIER_DEMO,
        free: true,
        publishedAt: new Date('2026-09-02T00:00:00.000Z'),
      },
    });
    await prisma.libraryResource.create({
      data: {
        slug: RESSOURCE_RESERVEE,
        title: 'Ressource de test réservée',
        description: 'Ressource créée par les tests automatisés.',
        type: 'PDF',
        theme: 'SOURCING',
        fileFormat: 'txt',
        sizeBytes: 18,
        pageCount: null,
        fileUrl: FICHIER_DEMO,
        courseId: payante.id,
        free: false,
        publishedAt: new Date('2026-09-06T00:00:00.000Z'),
      },
    });

    anonyme = request.agent(app.getHttpServer());
    sansDroit = await connecter(emailClient);
    inscrit = await connecter(emailInscrit);
    admin = await connecter(emailAdmin);
    await prisma.user.update({ where: { email: emailAdmin }, data: { role: 'ADMIN' } });

    const compte = await prisma.user.findUniqueOrThrow({ where: { email: emailInscrit }, select: { id: true } });
    idInscrit = compte.id;
  });

  afterAll(async () => {
    await nettoyer();
    await app.close();
  });

  /** Catalogue restreint aux formations du test : le thème SOURCING n'est pas utilisé ailleurs. */
  const catalogue = (agent: ReturnType<typeof request.agent>, query: Record<string, string | number> = {}) =>
    agent.get('/v1/academy/courses').query({ perPage: 48, ...query }).expect(200);

  const slugs = (body: { items: { slug: string }[] }) => body.items.map((item) => item.slug);

  describe('Catalogue', () => {
    it('liste les formations publiées, sans compte', async () => {
      const reponse = await catalogue(anonyme);

      expect(slugs(reponse.body)).toContain(GRATUITE);
      expect(slugs(reponse.body)).toContain(PAYANTE);
      expect(slugs(reponse.body)).not.toContain(BROUILLON);
      expect(reponse.body.resume).toBeNull();

      const payante = reponse.body.items.find((item: { slug: string }) => item.slug === PAYANTE);
      expect(payante.priceXaf).toBe(25_000);
      expect(payante.accessLabel).toBe('Formation payante');
      expect(payante.durationMinutes).toBe(20);
      expect(payante.lessonCount).toBe(2);
      expect(payante.enrolled).toBe(false);
      expect(payante.progress).toBeNull();
    });

    it('calcule la note moyenne et n’en invente pas quand il n’y a aucun avis', async () => {
      const reponse = await catalogue(anonyme);
      const items = reponse.body.items as { slug: string; rating: { average: number | null; count: number } }[];

      expect(items.find((item) => item.slug === GRATUITE)?.rating).toEqual({ average: 4, count: 1 });
      expect(items.find((item) => item.slug === PAYANTE)?.rating).toEqual({ average: null, count: 0 });
    });

    it('filtre par niveau, par thème et par recherche libre', async () => {
      // La recherche restreint la liste aux formations du test : la base contient aussi
      // le jeu de démonstration, et les assertions doivent rester vraies malgré lui.
      expect(slugs((await catalogue(anonyme, { theme: 'SOURCING', search: 'de test' })).body)).toEqual([PAYANTE]);
      expect(slugs((await catalogue(anonyme, { level: 'BEGINNER', search: 'test gratuite' })).body)).toEqual([
        GRATUITE,
      ]);
      expect(slugs((await catalogue(anonyme, { access: 'PAID', search: 'test payante' })).body)).toEqual([PAYANTE]);
    });

    it('annonce les niveaux et thèmes réellement présents', async () => {
      const reponse = await catalogue(anonyme);
      const themes = reponse.body.themes as { theme: string; label: string; count: number }[];

      expect(themes.find((entree) => entree.theme === 'SOURCING')?.count).toBeGreaterThanOrEqual(1);
      expect(themes.find((entree) => entree.theme === 'SOURCING')?.label).toBe('Recherche de produits');
      expect(reponse.body.levels.length).toBeGreaterThan(0);
    });

    it('refuse un niveau inconnu avec un message lisible', async () => {
      const reponse = await anonyme.get('/v1/academy/courses').query({ level: 'EXPERT' }).expect(400);

      expect(reponse.body.message).toBe('Certaines informations sont invalides.');
      expect(reponse.body.issues[0].path).toBe('level');
    });
  });

  describe('Fiche de formation', () => {
    it('explique pourquoi le contenu est fermé à un visiteur sans compte', async () => {
      const reponse = await anonyme.get(`/v1/academy/courses/${PAYANTE}`).expect(200);
      const { course } = reponse.body;

      expect(course.lockReason).toBe('SIGN_IN_REQUIRED');
      expect(course.lockMessage).toContain('Connectez-vous');
      expect(course.reviews).toEqual([]);

      const lecons = course.chapters[0].lessons as { slug: string; locked: boolean; preview: boolean }[];
      expect(lecons.find((lecon) => lecon.slug === 'extrait')).toMatchObject({ preview: true, locked: false });
      expect(lecons.find((lecon) => lecon.slug === 'lecon-payante')).toMatchObject({ preview: false, locked: true });
      expect(course.chapters[0].quizQuestionCount).toBe(2);
    });

    it('dit « achat nécessaire » à un compte connecté sans inscription', async () => {
      const reponse = await sansDroit.get(`/v1/academy/courses/${PAYANTE}`).expect(200);

      expect(reponse.body.course.lockReason).toBe('PURCHASE_REQUIRED');
      expect(reponse.body.course.enrolled).toBe(false);
      // La ressource réservée est annoncée comme non téléchargeable, avec sa raison.
      const ressource = reponse.body.course.resources[0];
      expect(ressource.downloadable).toBe(false);
      expect(ressource.lockedReason).toContain('payante');
    });

    it('ne sert ni une formation inconnue ni un brouillon', async () => {
      await anonyme.get('/v1/academy/courses/formation-inexistante').expect(404);
      await anonyme.get(`/v1/academy/courses/${BROUILLON}`).expect(404);
    });
  });

  describe('Droit de lecture d’une leçon payante (§54)', () => {
    it('refuse l’URL de lecture à un compte connecté sans inscription', async () => {
      const reponse = await sansDroit.get(`/v1/academy/courses/${PAYANTE}/lessons/lecon-payante`).expect(403);

      expect(reponse.body.code).toBe('lesson_locked');
      expect(reponse.body.message).toContain('payante');
      // Aucune URL, aucun identifiant de fichier, rien qui permette de deviner la vidéo.
      const corps = JSON.stringify(reponse.body);
      expect(corps).not.toContain('playbackUrl');
      expect(corps).not.toContain('cloudinary');
      expect(corps).not.toContain('e2e-payante');
    });

    it('refuse aussi l’URL de lecture à un visiteur sans compte', async () => {
      const reponse = await anonyme.get(`/v1/academy/courses/${PAYANTE}/lessons/lecon-payante`).expect(403);

      expect(reponse.body.message).toContain('Connectez-vous');
      expect(JSON.stringify(reponse.body)).not.toContain('playbackUrl');
    });

    it('laisse lire l’extrait offert, même sans compte, sans ouvrir le reste du programme', async () => {
      const reponse = await anonyme.get(`/v1/academy/courses/${PAYANTE}/lessons/extrait`).expect(200);

      expect(reponse.body.lesson.slug).toBe('extrait');
      expect(reponse.body.lesson.watchedSeconds).toBe(0);
      attendreLecture(reponse.body.lesson);

      const lecons = reponse.body.chapters[0].lessons as { slug: string; locked: boolean }[];
      expect(lecons.find((lecon) => lecon.slug === 'lecon-payante')?.locked).toBe(true);
    });

    it('ouvre la leçon dès que l’équipe a enregistré l’inscription', async () => {
      const ouverture = await admin
        .post('/v1/academy/enrollments')
        .send({ userId: idInscrit, courseSlug: PAYANTE, source: 'PURCHASE' })
        .expect(201);

      expect(ouverture.body.alreadyEnrolled).toBe(false);
      expect(ouverture.body.sourceLabel).toBe('Achat de la formation');

      // Idempotent : rappeler la route ne crée pas de doublon.
      const repetition = await admin
        .post('/v1/academy/enrollments')
        .send({ userId: idInscrit, courseSlug: PAYANTE, source: 'PURCHASE' })
        .expect(201);
      expect(repetition.body.alreadyEnrolled).toBe(true);

      const reponse = await inscrit.get(`/v1/academy/courses/${PAYANTE}/lessons/lecon-payante`).expect(200);
      attendreLecture(reponse.body.lesson);
      expect(reponse.body.lesson.documents).toHaveLength(1);
      expect(reponse.body.lesson.quizId).toBe(quizId);
      expect(reponse.body.previousLessonSlug).toBe('extrait');
      expect(reponse.body.nextLessonSlug).toBeNull();
    });

    it('réserve l’ouverture d’un accès à l’équipe', async () => {
      await sansDroit
        .post('/v1/academy/enrollments')
        .send({ userId: idInscrit, courseSlug: PAYANTE })
        .expect(403);
      await anonyme
        .post('/v1/academy/enrollments')
        .send({ userId: idInscrit, courseSlug: PAYANTE })
        .expect(401);
    });
  });

  describe('Progression, reprise et notes', () => {
    it('inscrit un compte connecté dès qu’il ouvre une formation gratuite', async () => {
      await sansDroit.get(`/v1/academy/courses/${GRATUITE}/lessons/premiere`).expect(200);

      const reponse = await catalogue(sansDroit);
      const gratuite = reponse.body.items.find((item: { slug: string }) => item.slug === GRATUITE);
      expect(gratuite.enrolled).toBe(true);
      expect(gratuite.progress).toMatchObject({ completedLessons: 0, totalLessons: 2, percent: 0 });
    });

    it('enregistre la position de lecture et ne la fait jamais reculer', async () => {
      const premiere = await sansDroit
        .post(`/v1/academy/courses/${GRATUITE}/lessons/premiere/progress`)
        .send({ watchedSeconds: 120, completed: false })
        .expect(200);

      expect(premiere.body.status).toBe('IN_PROGRESS');
      expect(premiere.body.watchedSeconds).toBe(120);
      expect(premiere.body.progress.percent).toBe(0);

      const retour = await sansDroit
        .post(`/v1/academy/courses/${GRATUITE}/lessons/premiere/progress`)
        .send({ watchedSeconds: 10 })
        .expect(200);
      expect(retour.body.watchedSeconds).toBe(120);

      const relecture = await sansDroit.get(`/v1/academy/courses/${GRATUITE}/lessons/premiere`).expect(200);
      expect(relecture.body.lesson.watchedSeconds).toBe(120);
      expect(relecture.body.lesson.status).toBe('IN_PROGRESS');
    });

    it('compte la formation terminée quand la dernière leçon est achevée', async () => {
      const premiere = await sansDroit
        .post(`/v1/academy/courses/${GRATUITE}/lessons/premiere/progress`)
        .send({ watchedSeconds: 600, completed: true })
        .expect(200);

      expect(premiere.body.status).toBe('COMPLETED');
      expect(premiere.body.progress).toMatchObject({ completedLessons: 1, totalLessons: 2, percent: 50 });
      expect(premiere.body.progress.resumeLessonSlug).toBe('seconde');
      expect(premiere.body.courseCompleted).toBe(false);

      const seconde = await sansDroit
        .post(`/v1/academy/courses/${GRATUITE}/lessons/seconde/progress`)
        .send({ watchedSeconds: 1_200, completed: true })
        .expect(200);

      expect(seconde.body.progress.percent).toBe(100);
      expect(seconde.body.progress.resumeLessonSlug).toBeNull();
      expect(seconde.body.courseCompleted).toBe(true);
    });

    it('propose de reprendre la dernière leçon travaillée', async () => {
      const reponse = await catalogue(sansDroit);

      expect(reponse.body.resume).toMatchObject({ courseSlug: GRATUITE, lessonSlug: 'seconde', percent: 100 });
    });

    it('relance la progression par email une seule fois par jour', async () => {
      // L'envoi ne bloque pas l'enregistrement de la progression : on attend qu'il parte.
      await vi.waitFor(() => {
        const relances = mail.send.mock.calls.filter((appel) => appel[0].template === 'course-progress');
        expect(relances).toHaveLength(1);
        expect(relances[0][0]).toMatchObject({ template: 'course-progress', to: emailClient });
      });
    });

    it('enregistre puis efface les notes personnelles', async () => {
      const enregistre = await sansDroit
        .put(`/v1/academy/courses/${GRATUITE}/lessons/premiere/notes`)
        .send({ notes: 'Rappel : vérifier le poids avant de commander.' })
        .expect(200);

      expect(enregistre.body.notes).toBe('Rappel : vérifier le poids avant de commander.');

      const relecture = await sansDroit.get(`/v1/academy/courses/${GRATUITE}/lessons/premiere`).expect(200);
      expect(relecture.body.lesson.notes).toBe('Rappel : vérifier le poids avant de commander.');

      const efface = await sansDroit
        .put(`/v1/academy/courses/${GRATUITE}/lessons/premiere/notes`)
        .send({ notes: '   ' })
        .expect(200);
      expect(efface.body.notes).toBeNull();
    });

    it('ne laisse écrire ni progression ni note sur une leçon fermée', async () => {
      await sansDroit
        .post(`/v1/academy/courses/${PAYANTE}/lessons/lecon-payante/progress`)
        .send({ watchedSeconds: 10 })
        .expect(403);
      await sansDroit
        .put(`/v1/academy/courses/${PAYANTE}/lessons/lecon-payante/notes`)
        .send({ notes: 'tentative' })
        .expect(403);
      await anonyme
        .post(`/v1/academy/courses/${GRATUITE}/lessons/premiere/progress`)
        .send({ watchedSeconds: 10 })
        .expect(401);
    });

    it('refuse une position de lecture invalide avec un message lisible', async () => {
      const reponse = await sansDroit
        .post(`/v1/academy/courses/${GRATUITE}/lessons/premiere/progress`)
        .send({ watchedSeconds: -5 })
        .expect(400);

      expect(reponse.body.issues[0].path).toBe('watchedSeconds');
    });
  });

  describe('Quiz', () => {
    it('n’envoie pas les bonnes réponses avec les questions', async () => {
      const reponse = await inscrit.get(`/v1/academy/quizzes/${quizId}`).expect(200);

      expect(reponse.body.passScorePercent).toBe(50);
      expect(reponse.body.questions).toHaveLength(2);
      expect(reponse.body.lastAttempt).toBeNull();
      expect(JSON.stringify(reponse.body)).not.toContain('correct');
    });

    it('corrige côté serveur et garde la dernière tentative', async () => {
      const questions = (await inscrit.get(`/v1/academy/quizzes/${quizId}`).expect(200)).body
        .questions as { id: string; choices: { id: string; label: string }[] }[];

      const bonnes = questions.map((question) => ({
        questionId: question.id,
        choiceId: question.choices.find((choix) => choix.label === 'Bonne réponse')!.id,
      }));

      const parfait = await inscrit
        .post(`/v1/academy/quizzes/${quizId}/attempts`)
        .send({ answers: bonnes })
        .expect(200);

      expect(parfait.body).toMatchObject({ scorePercent: 100, correctCount: 2, questionCount: 2, passed: true });
      expect(parfait.body.corrections[0].explanation).toBe('Explication de test.');

      const moitie = await inscrit
        .post(`/v1/academy/quizzes/${quizId}/attempts`)
        .send({
          answers: [
            {
              questionId: questions[0].id,
              choiceId: questions[0].choices.find((choix) => choix.label === 'Mauvaise réponse')!.id,
            },
            bonnes[1],
          ],
        })
        .expect(200);

      expect(moitie.body).toMatchObject({ scorePercent: 50, correctCount: 1, passed: true });
      expect(moitie.body.corrections[0].correct).toBe(false);
      expect(moitie.body.corrections[0].correctChoiceLabel).toBe('Bonne réponse');

      const relecture = await inscrit.get(`/v1/academy/quizzes/${quizId}`).expect(200);
      expect(relecture.body.lastAttempt).toMatchObject({ scorePercent: 50, passed: true });
    });

    it('ferme le quiz d’une formation sans droit d’accès', async () => {
      await sansDroit.get(`/v1/academy/quizzes/${quizId}`).expect(403);
      await anonyme.get(`/v1/academy/quizzes/${quizId}`).expect(401);
    });
  });

  describe('Bibliothèque', () => {
    const bibliotheque = (agent: ReturnType<typeof request.agent>, query: Record<string, string | number> = {}) =>
      agent.get('/v1/academy/resources').query({ perPage: 48, ...query }).expect(200);

    it('liste les ressources publiées et dit lesquelles sont téléchargeables', async () => {
      const reponse = await bibliotheque(anonyme, { search: 'de test' });
      const items = reponse.body.items as { slug: string; downloadable: boolean; lockedReason: string | null }[];

      expect(items.find((item) => item.slug === RESSOURCE_LIBRE)).toMatchObject({
        downloadable: true,
        lockedReason: null,
      });
      expect(items.find((item) => item.slug === RESSOURCE_RESERVEE)?.downloadable).toBe(false);
      expect(reponse.body.types.length).toBeGreaterThan(0);
      expect(reponse.body.themes.length).toBeGreaterThan(0);
    });

    it('filtre par nature et par thème', async () => {
      const parType = await bibliotheque(anonyme, { type: 'CHECKLIST', search: 'de test' });
      expect(parType.body.items.map((item: { slug: string }) => item.slug)).toEqual([RESSOURCE_LIBRE]);

      const parTheme = await bibliotheque(anonyme, { theme: 'SOURCING', search: 'de test' });
      expect(parTheme.body.items.map((item: { slug: string }) => item.slug)).toEqual([RESSOURCE_RESERVEE]);
    });

    it('sert le lien d’une ressource libre et refuse celui d’une ressource réservée', async () => {
      const libre = await anonyme.get(`/v1/academy/resources/${RESSOURCE_LIBRE}/download`).expect(200);
      expect(libre.body.fileFormat).toBe('txt');
      expect(libre.body.url).toBe(FICHIER_DEMO);
      expect(new Date(libre.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const refus = await sansDroit.get(`/v1/academy/resources/${RESSOURCE_RESERVEE}/download`).expect(403);
      expect(refus.body.code).toBe('resource_locked');
      expect(JSON.stringify(refus.body)).not.toContain('data:text/plain');

      // Le compte inscrit à la formation, lui, y a droit.
      const autorise = await inscrit.get(`/v1/academy/resources/${RESSOURCE_RESERVEE}/download`).expect(200);
      expect(autorise.body.url).toBe(FICHIER_DEMO);
    });

    it('ne sert pas une ressource inconnue', async () => {
      await anonyme.get('/v1/academy/resources/ressource-inexistante/download').expect(404);
    });
  });
});

/**
 * Vérifie la lecture d'une leçon à qui l'accès a été accordé.
 * Avec `CLOUDINARY_URL`, une URL signée doit être présente ; sans elle, le contrat prévoit
 * `playbackUrl: null` accompagné de sa raison — jamais une URL inventée.
 */
function attendreLecture(lesson: { playbackUrl: string | null; playbackUnavailableReason: string | null }): void {
  if (process.env.CLOUDINARY_URL) {
    expect(lesson.playbackUrl).toMatch(/^https:\/\//);
    expect(lesson.playbackUrl).toContain('signature=');
    expect(lesson.playbackUnavailableReason).toBeNull();
  } else {
    expect(lesson.playbackUrl).toBeNull();
    expect(lesson.playbackUnavailableReason).toContain('hébergement');
  }
}
