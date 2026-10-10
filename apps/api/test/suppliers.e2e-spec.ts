import { Module, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import express from 'express';
import request from 'supertest';
import { configureApp } from '../src/bootstrap.js';
import type { Auth } from '../src/auth/auth.config.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import { validateEnv } from '../src/config/env.js';
import { MailModule } from '../src/mail/mail.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SuppliersModule } from '../src/suppliers/suppliers.module.js';

/**
 * Application réduite au lot SUP : mêmes modules de fondation que `AppModule`, mais
 * sans les autres lots. Le test ne dépend donc pas de leur état d'avancement.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    MailModule.register(false),
    SuppliersModule,
  ],
})
class SuppliersTestModule {}

/**
 * Lot SUP — fournisseurs (§15 à §19).
 *
 * Ce que ces tests prouvent :
 * - chaque filtre de recherche renvoie exactement les fournisseurs attendus (SUP-03) ;
 * - aucun badge n'apparaît sans preuve enregistrée (SUP-02, §16) ;
 * - un compte gratuit n'obtient jamais les coordonnées, même en appelant l'API
 *   directement, sans passer par l'interface (SUP-04, §17).
 *
 * Nécessite la base de développement (pnpm db:create && pnpm db:migrate).
 */

/** Marqueur unique : les données de ce test ne se mélangent à aucune autre. */
const TAG = `E2E-SUP-${Date.now()}`;

/**
 * Session simulée : le test décrit le compte dans un en-tête, le vrai `AuthGuard`
 * fait ensuite son travail habituel, y compris le contrôle du rôle.
 */
const fakeAuth = {
  api: {
    getSession: ({ headers }: { headers: Headers }) => {
      const role = headers.get('x-test-role');
      if (!role) return Promise.resolve(null);
      return Promise.resolve({
        user: {
          id: `${TAG}-user-${role}`,
          name: `Compte ${role}`,
          email: `${role.toLowerCase()}@exemple-warrior.cm`,
          role,
        },
      });
    },
  },
} as unknown as Auth;

describe('Fournisseurs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<typeof request>;

  /** Fournisseur vérifié, personnalisation, échantillon, petit MOQ. */
  let verifie: string;
  /** Fournisseur sans aucune preuve : il ne doit porter aucun badge. */
  let sansPreuve: string;
  /** Fournisseur d'une autre ville, MOQ élevé, sans personnalisation ni échantillon. */
  let autreVille: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [SuppliersTestModule] })
      .overrideProvider(AUTH)
      .useValue(fakeAuth)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(express.json());
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    http = () => request(app.getHttpServer());

    const created = await Promise.all([
      prisma.supplier.create({
        data: {
          name: `${TAG} Atelier vérifié`,
          type: 'MANUFACTURER',
          city: `${TAG}-Guangzhou`,
          moq: 100,
          oem: true,
          sampleAvailable: true,
          leadTimeDays: 15,
          publicSummary: 'Fournisseur de test.',
        },
        select: { id: true },
      }),
      prisma.supplier.create({
        data: {
          name: `${TAG} Négoce sans preuve`,
          type: 'TRADING_COMPANY',
          city: `${TAG}-Guangzhou`,
          moq: 300,
          oem: false,
          sampleAvailable: true,
          leadTimeDays: 25,
        },
        select: { id: true },
      }),
      prisma.supplier.create({
        data: {
          name: `${TAG} Usine autre ville`,
          type: 'MANUFACTURER',
          city: `${TAG}-Shenzhen`,
          moq: 1000,
          oem: false,
          sampleAvailable: false,
          leadTimeDays: 40,
        },
        select: { id: true },
      }),
    ]);
    [verifie, sansPreuve, autreVille] = created.map((supplier) => supplier.id);

    await prisma.supplierOffering.createMany({
      data: [
        { supplierId: verifie, name: `${TAG} Coque de téléphone`, category: 'ACCESSORIES', moq: 100 },
        { supplierId: sansPreuve, name: `${TAG} T-shirt coton`, category: 'FASHION', moq: 300 },
        { supplierId: autreVille, name: `${TAG} Bouilloire`, category: 'HOME', moq: 1000 },
      ],
    });

    await prisma.supplierVerification.createMany({
      data: [
        {
          supplierId: verifie,
          level: 'IDENTITY_VERIFIED',
          evidenceUrl: 'https://exemple.invalid/licence.pdf',
          verifiedAt: new Date('2026-05-20T00:00:00.000Z'),
        },
        // Déclaration sans preuve : elle ne doit produire aucun badge.
        { supplierId: sansPreuve, level: 'PARTNER', evidenceUrl: null, verifiedAt: new Date('2026-06-01T00:00:00.000Z') },
      ],
    });

    await prisma.supplierContact.createMany({
      data: [
        { supplierId: verifie, contactName: 'Contact de test', phone: '+86 000 0000 0001', wechat: 'test-wechat' },
        { supplierId: sansPreuve, contactName: 'Contact de test', phone: '+86 000 0000 0002' },
      ],
    });

    await prisma.supplierIncident.create({
      data: {
        supplierId: sansPreuve,
        occurredAt: new Date('2026-04-18T00:00:00.000Z'),
        severity: 'MAJOR',
        status: 'OPEN',
        summary: 'Retard de production de 12 jours.',
      },
    });
  });

  afterAll(async () => {
    const ids = [verifie, sansPreuve, autreVille];
    const scope = { where: { supplierId: { in: ids } } };
    await prisma.supplierRequest.deleteMany(scope);
    await prisma.supplierContactAccess.deleteMany(scope);
    await prisma.supplierContact.deleteMany(scope);
    await prisma.supplierLevelChange.deleteMany(scope);
    await prisma.supplierIncident.deleteMany(scope);
    await prisma.supplierOffering.deleteMany(scope);
    await prisma.supplierVerification.deleteMany(scope);
    await prisma.supplier.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  // ───────────────────────── Recherche et filtres (SUP-03) ─────────────────────────

  it('liste les fournisseurs sans session : l’aperçu est public', async () => {
    const response = await http().get('/v1/suppliers').query({ q: TAG }).expect(200);

    expect(response.body.items).toHaveLength(3);
    expect(response.body.total).toBe(3);
    expect(response.body.availableCities).toEqual(expect.arrayContaining([`${TAG}-Guangzhou`]));
  });

  it('filtre par produit', async () => {
    const response = await http().get('/v1/suppliers').query({ q: `${TAG} Coque` }).expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([verifie]);
  });

  it('filtre par catégorie', async () => {
    const response = await http().get('/v1/suppliers').query({ q: TAG, category: 'FASHION' }).expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([sansPreuve]);
  });

  it('filtre par ville', async () => {
    const response = await http().get('/v1/suppliers').query({ q: TAG, city: `${TAG}-Shenzhen` }).expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([autreVille]);
  });

  it('filtre par quantité minimale de commande', async () => {
    const response = await http().get('/v1/suppliers').query({ q: TAG, moqMax: 300 }).expect(200);

    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).toEqual(expect.arrayContaining([verifie, sansPreuve]));
    expect(ids).not.toContain(autreVille);
  });

  it('filtre par personnalisation', async () => {
    const response = await http().get('/v1/suppliers').query({ q: TAG, customization: 'true' }).expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([verifie]);
  });

  it('filtre par échantillon disponible', async () => {
    const response = await http().get('/v1/suppliers').query({ q: TAG, sample: 'true' }).expect(200);

    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).toEqual(expect.arrayContaining([verifie, sansPreuve]));
    expect(ids).not.toContain(autreVille);
  });

  it('filtre par niveau de vérification, en ne comptant que les niveaux prouvés', async () => {
    const response = await http().get('/v1/suppliers').query({ q: TAG, minLevel: 'IDENTITY_VERIFIED' }).expect(200);

    // Le fournisseur déclaré « Partenaire » sans preuve n'apparaît pas.
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([verifie]);
  });

  it('refuse un filtre invalide avec un message lisible', async () => {
    const response = await http().get('/v1/suppliers').query({ minLevel: 'SUPER_FIABLE' }).expect(400);

    expect(response.body.code).toBe('invalid_request');
    expect(response.body.message).toBe('Certaines informations sont invalides.');
  });

  // ───────────────────────── Badges et preuves (SUP-02, §16) ─────────────────────────

  it('affiche le badge avec sa preuve et sa date', async () => {
    const response = await http().get(`/v1/suppliers/${verifie}`).expect(200);

    expect(response.body.verification).toMatchObject({
      level: 'IDENTITY_VERIFIED',
      levelLabel: 'Identité vérifiée',
      evidenceUrl: 'https://exemple.invalid/licence.pdf',
      verifiedAt: '2026-05-20T00:00:00.000Z',
    });
    expect(response.body.verification.meaning).not.toBe('');
    expect(response.body.proofs).toHaveLength(1);
  });

  it('n’affiche aucun badge quand la preuve manque', async () => {
    const response = await http().get(`/v1/suppliers/${sansPreuve}`).expect(200);

    expect(response.body.verification).toBeNull();
    expect(response.body.proofs).toEqual([]);
    // Le risque, lui, reste visible (§17).
    expect(response.body.incidents).toHaveLength(1);
  });

  it('refuse d’enregistrer une vérification sans preuve', async () => {
    const response = await http()
      .post(`/v1/suppliers/${verifie}/verifications`)
      .set('x-test-role', 'ADMIN')
      .send({ level: 'SUPPLIER_TESTED', verifiedAt: '2026-09-01T00:00:00.000Z', reason: 'Commande test reçue.' })
      .expect(400);

    expect(response.body.issues.map((issue: { path: string }) => issue.path)).toContain('evidenceUrl');
  });

  it('refuse de sauter un niveau', async () => {
    const response = await http()
      .post(`/v1/suppliers/${verifie}/verifications`)
      .set('x-test-role', 'ADMIN')
      .send({
        level: 'PARTNER',
        evidenceUrl: 'https://exemple.invalid/partenariat.pdf',
        verifiedAt: '2026-09-01T00:00:00.000Z',
        reason: 'Relation récurrente.',
      })
      .expect(400);

    expect(response.body.message).toContain('niveau précédent');
  });

  it('refuse la promotion à un compte client', async () => {
    await http()
      .post(`/v1/suppliers/${verifie}/verifications`)
      .set('x-test-role', 'CLIENT')
      .send({
        level: 'SUPPLIER_TESTED',
        evidenceUrl: 'https://exemple.invalid/commande.pdf',
        verifiedAt: '2026-09-01T00:00:00.000Z',
        reason: 'Tentative.',
      })
      .expect(403);
  });

  it('promeut au niveau suivant avec sa preuve, et garde la trace du passage', async () => {
    const response = await http()
      .post(`/v1/suppliers/${verifie}/verifications`)
      .set('x-test-role', 'ADMIN')
      .send({
        level: 'SUPPLIER_TESTED',
        evidenceUrl: 'https://exemple.invalid/commande-test.pdf',
        verifiedAt: '2026-09-10T00:00:00.000Z',
        reason: 'Commande test réceptionnée et conforme.',
      })
      .expect(201);

    expect(response.body.verification.level).toBe('SUPPLIER_TESTED');
    expect(response.body.verification.lastVerifiedAt).toBe('2026-09-10T00:00:00.000Z');
    expect(response.body.proofs).toHaveLength(2);
    expect(response.body.history[0]).toMatchObject({ fromLevel: 'IDENTITY_VERIFIED', toLevel: 'SUPPLIER_TESTED' });
  });

  // ───────────────────────── Coordonnées réservées (SUP-04, §17) ─────────────────────────

  it('ne laisse fuir aucune coordonnée dans l’aperçu public', async () => {
    const response = await http().get(`/v1/suppliers/${verifie}`).expect(200);
    const body = JSON.stringify(response.body);

    expect(body).not.toContain('+86 000 0000 0001');
    expect(body).not.toContain('test-wechat');
    expect(response.body).not.toHaveProperty('contactDetails');
    expect(response.body.contactAccess.granted).toBe(false);
    expect(response.body.contactAccess.reason).toMatch(/réservées aux membres/);
  });

  it('exige une session pour demander les coordonnées', async () => {
    const response = await http().get(`/v1/suppliers/${verifie}/contact`).expect(401);

    expect(response.body.code).toBe('unauthenticated');
  });

  it('refuse les coordonnées à un compte gratuit appelant l’API directement', async () => {
    const response = await http().get(`/v1/suppliers/${verifie}/contact`).set('x-test-role', 'CLIENT').expect(403);

    expect(response.body.code).toBe('forbidden');
    expect(JSON.stringify(response.body)).not.toContain('+86 000 0000 0001');
  });

  it('donne les coordonnées à un membre et enregistre la consultation', async () => {
    const response = await http()
      .get(`/v1/suppliers/${verifie}/contact`)
      .set('x-test-role', 'PREMIUM_MEMBER')
      .expect(200);

    expect(response.body.phone).toBe('+86 000 0000 0001');
    expect(response.body.wechat).toBe('test-wechat');

    const accesses = await prisma.supplierContactAccess.count({ where: { supplierId: verifie } });
    expect(accesses).toBe(1);
  });

  it('annonce l’accès ouvert dans l’aperçu quand le compte y a droit', async () => {
    const response = await http().get(`/v1/suppliers/${verifie}`).set('x-test-role', 'PREMIUM_MEMBER').expect(200);

    expect(response.body.contactAccess.granted).toBe(true);
    // Même alors, la fiche publique ne transporte pas les coordonnées : elles ont leur route.
    expect(JSON.stringify(response.body)).not.toContain('+86 000 0000 0001');
  });

  // ───────────────────────── Demandes depuis la fiche (SUP-05) ─────────────────────────

  it('exige une session pour demander un devis', async () => {
    await http()
      .post(`/v1/suppliers/${verifie}/requests`)
      .send({ kind: 'QUOTE', productLabel: 'Coque de téléphone' })
      .expect(401);
  });

  it('enregistre une demande de devis et une demande de sourcing', async () => {
    const devis = await http()
      .post(`/v1/suppliers/${verifie}/requests`)
      .set('x-test-role', 'CLIENT')
      .send({ kind: 'QUOTE', productLabel: 'Coque de téléphone', quantity: 500, budgetXafMinor: 750_000 })
      .expect(201);

    expect(devis.body.reference).toMatch(/^DEV-/);
    expect(devis.body.kindLabel).toBe('Demande de devis');

    const sourcing = await http()
      .post(`/v1/suppliers/${verifie}/requests`)
      .set('x-test-role', 'CLIENT')
      .send({ kind: 'SOURCING', productLabel: 'Bouilloire électrique' })
      .expect(201);

    expect(sourcing.body.reference).toMatch(/^SRC-/);
    expect(sourcing.body.status).toBe('SUBMITTED');
  });

  it('refuse une demande incomplète avec un message par champ', async () => {
    const response = await http()
      .post(`/v1/suppliers/${verifie}/requests`)
      .set('x-test-role', 'CLIENT')
      .send({ kind: 'QUOTE', productLabel: 'x' })
      .expect(400);

    expect(response.body.issues.map((issue: { path: string }) => issue.path)).toContain('productLabel');
  });

  it('répond proprement pour un fournisseur inconnu', async () => {
    const response = await http().get('/v1/suppliers/identifiant-inexistant').expect(404);

    expect(response.body.code).toBe('not_found');
  });
});
