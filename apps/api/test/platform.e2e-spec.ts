import { createHash } from 'node:crypto';
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
import { JobsService } from '../src/platform/jobs/jobs.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Identifiants Cloudinary factices, fixés avant le chargement de la configuration.
 * Ils rendent la signature vérifiable et garantissent qu'aucun compte réel n'est touché ;
 * aucun appel réseau n'est fait : seule la signature est calculée.
 */
const FAKE_CLOUDINARY = { cloudName: 'demo-cloud', apiKey: '123456789012345', apiSecret: 'secret-de-test' };
vi.hoisted(() => {
  process.env.CLOUDINARY_URL = 'cloudinary://123456789012345:secret-de-test@demo-cloud';
  // Les tests utilisent toujours la file en mémoire : jamais de connexion Redis.
  process.env.NODE_ENV = 'test';
});

/** Intercepte le code au lieu de l'envoyer : le test lit ce que l'utilisateur recevrait. */
class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/** Uploads signés (PLAT-06) et file de tâches (PLAT-07). Nécessite la base de développement. */
describe('Plateforme : uploads et tâches (e2e)', () => {
  const email = `platform-${Date.now()}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();

  let app: INestApplication;
  let prisma: PrismaService;
  let jobs: JobsService;
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
    jobs = app.get(JobsService);
    agent = request.agent(app.getHttpServer());

    await agent.post('/v1/auth/email-otp/send-verification-otp').send({ email, type: 'sign-in' }).expect(200);
    await agent.post('/v1/auth/sign-in/email-otp').send({ email, otp: otp.lastCode }).expect(200);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  describe('Uploads', () => {
    const image = { contentType: 'image/jpeg', sizeBytes: 1024 * 1024, folder: 'products' };

    it('refuse de signer sans session', async () => {
      const refused = await request(app.getHttpServer()).post('/v1/uploads/sign').send(image).expect(401);
      expect(refused.body.code).toBe('unauthenticated');
    });

    it('refuse un type interdit, même connecté', async () => {
      const exe = await agent
        .post('/v1/uploads/sign')
        .send({ ...image, contentType: 'application/x-msdownload', fileName: 'virus.exe' })
        .expect(400);
      expect(exe.body.code).toBe('unsupported_file_type');
      expect(exe.body.message).not.toMatch(/exe|mime|cloudinary/i);

      const svg = await agent.post('/v1/uploads/sign').send({ ...image, contentType: 'image/svg+xml' }).expect(400);
      expect(svg.body.code).toBe('unsupported_file_type');
    });

    it('refuse un fichier trop lourd pour sa famille', async () => {
      const tooBig = await agent
        .post('/v1/uploads/sign')
        .send({ ...image, sizeBytes: 5 * 1024 * 1024 + 1 })
        .expect(400);
      expect(tooBig.body.code).toBe('file_too_large');
      expect(tooBig.body.message).toContain('5 Mo');

      const pdf = await agent
        .post('/v1/uploads/sign')
        .send({ contentType: 'application/pdf', sizeBytes: 10 * 1024 * 1024 + 1, folder: 'academy' })
        .expect(400);
      expect(pdf.body.code).toBe('file_too_large');
    });

    it('refuse une saisie invalide (dossier inconnu, taille absente)', async () => {
      const invalid = await agent.post('/v1/uploads/sign').send({ contentType: 'image/png', folder: 'ailleurs' }).expect(400);
      expect(invalid.body.code).toBe('invalid_request');
      expect(invalid.body.issues.map((issue: { path: string }) => issue.path)).toEqual(
        expect.arrayContaining(['sizeBytes', 'folder']),
      );
    });

    it('signe une image acceptée sans jamais recevoir le fichier', async () => {
      const signed = await agent.post('/v1/uploads/sign').send(image).expect(200);

      expect(signed.body.kind).toBe('IMAGE');
      expect(signed.body.resourceType).toBe('image');
      expect(signed.body.uploadUrl).toBe(`https://api.cloudinary.com/v1_1/${FAKE_CLOUDINARY.cloudName}/image/upload`);
      expect(signed.body.folder).toBe('warrior-sourcing/products');
      expect(signed.body.maxBytes).toBe(5 * 1024 * 1024);

      const fields = signed.body.fields as Record<string, string>;
      expect(fields.api_key).toBe(FAKE_CLOUDINARY.apiKey);
      expect(fields.folder).toBe('warrior-sourcing/products');
      expect(fields.allowed_formats).toBe('jpg,jpeg,png,webp');
      expect(fields.public_id).toMatch(/^[0-9a-f]{24}$/);
      // Le secret ne sort jamais du serveur.
      expect(JSON.stringify(signed.body)).not.toContain(FAKE_CLOUDINARY.apiSecret);

      // Signature Cloudinary : SHA-1 des paramètres triés (clé=valeur joints par &) suivis du secret.
      const toSign = ['allowed_formats', 'folder', 'public_id', 'timestamp']
        .map((key) => `${key}=${fields[key]}`)
        .join('&');
      const expected = createHash('sha1').update(`${toSign}${FAKE_CLOUDINARY.apiSecret}`).digest('hex');
      expect(fields.signature).toBe(expected);
    });

    it('classe un PDF en document brut et une vidéo MP4 en vidéo', async () => {
      const pdf = await agent
        .post('/v1/uploads/sign')
        .send({ contentType: 'application/pdf', sizeBytes: 2048, folder: 'academy' })
        .expect(200);
      expect(pdf.body.resourceType).toBe('raw');
      expect(pdf.body.uploadUrl).toContain('/raw/upload');

      const video = await agent
        .post('/v1/uploads/sign')
        .send({ contentType: 'video/mp4', sizeBytes: 150 * 1024 * 1024, folder: 'academy' })
        .expect(200);
      expect(video.body.resourceType).toBe('video');
      expect(video.body.maxBytes).toBe(200 * 1024 * 1024);
    });
  });

  describe('Tâches', () => {
    it('exige une session, puis un rôle administrateur', async () => {
      await request(app.getHttpServer()).get('/v1/admin/jobs').expect(401);
      const refused = await agent.get('/v1/admin/jobs').expect(403);
      expect(refused.body.code).toBe('forbidden');
    });

    it('exécute une tâche différée et une tâche récurrente en mémoire, visibles par un administrateur', async () => {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });

      const seen: unknown[] = [];
      jobs.register('test:ping', (payload) => {
        seen.push(payload);
      });
      jobs.register('test:boom', () => {
        throw new Error('Échec volontaire');
      });

      const delayed = await jobs.schedule('test:ping', { hello: 'monde' }, { delayMs: 20 });
      const failing = await jobs.schedule('test:boom', {}, { delayMs: 20, jobId: 'test-boom' });
      const repeating = await jobs.scheduleRepeating('test:ping', { tick: true }, { everyMs: 25, jobId: 'test-tick' });

      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(await jobs.cancel(repeating.id)).toBe(true);

      const response = await agent.get('/v1/admin/jobs').expect(200);
      expect(response.body.backend).toBe('MEMORY');

      const byId = new Map<string, Record<string, unknown>>(
        (response.body.jobs as Record<string, unknown>[]).map((job) => [job.id as string, job]),
      );

      expect(byId.get(delayed.id)).toMatchObject({ name: 'test:ping', kind: 'DELAYED', status: 'COMPLETED', runs: 1 });
      expect(byId.get(failing.id)).toMatchObject({ status: 'FAILED', lastError: 'Échec volontaire' });
      expect(byId.get(repeating.id)).toMatchObject({ kind: 'REPEATING', status: 'CANCELLED', schedule: '25ms' });
      expect((byId.get(repeating.id) as { runs: number }).runs).toBeGreaterThanOrEqual(2);
      expect(seen).toContainEqual({ hello: 'monde' });
      expect(seen.filter((payload) => (payload as { tick?: boolean }).tick).length).toBeGreaterThanOrEqual(2);
    });
  });
});
