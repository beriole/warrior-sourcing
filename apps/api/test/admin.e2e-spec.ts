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
 * Back-office (lot ADM) : indicateurs, utilisateurs et rôles, commandes, litiges.
 * Nécessite la base de développement (pnpm db:create && pnpm db:migrate).
 */
describe('Back-office (e2e)', () => {
  const marqueur = Date.now();
  const emailClient = `adm-client-${marqueur}@exemple-warrior.cm`;
  const emailAdmin = `adm-admin-${marqueur}@exemple-warrior.cm`;
  const emailSuper = `adm-super-${marqueur}@exemple-warrior.cm`;
  const referenceCommande = `WS-ADM-${marqueur}`;
  const otp = new CapturingOtpSender();

  let app: INestApplication;
  let prisma: PrismaService;
  let client: ReturnType<typeof request.agent>;
  let admin: ReturnType<typeof request.agent>;
  let superAdmin: ReturnType<typeof request.agent>;

  let clientId = '';
  let commandeId = '';
  let litigeId = '';

  /** Crée une session pour une adresse donnée et renvoie l'agent qui la porte. */
  async function connecter(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/email-otp/send-verification-otp').send({ email, type: 'sign-in' }).expect(200);
    await agent.post('/v1/auth/sign-in/email-otp').send({ email, otp: otp.lastCode }).expect(200);
    return agent;
  }

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

    client = await connecter(emailClient);
    admin = await connecter(emailAdmin);
    superAdmin = await connecter(emailSuper);

    // Le rôle est relu côté serveur à chaque requête : la promotion en base suffit.
    await prisma.user.update({ where: { email: emailAdmin }, data: { role: 'ADMIN' } });
    await prisma.user.update({ where: { email: emailSuper }, data: { role: 'SUPER_ADMIN' } });

    const compteClient = await prisma.user.findUniqueOrThrow({ where: { email: emailClient } });
    clientId = compteClient.id;

    // Une commande support de test, pour le détail et les litiges.
    const commande = await prisma.order.create({
      data: {
        reference: referenceCommande,
        userId: clientId,
        totalXaf: 150_000,
        subtotalXaf: 120_000,
        freightXaf: 20_000,
        serviceFeeXaf: 10_000,
        city: 'Douala',
        phone: '670112233',
      },
    });
    commandeId = commande.id;
  });

  afterAll(async () => {
    // Rien de ce que le test a créé ne doit rester en base.
    await prisma.disputeEvent.deleteMany({ where: { dispute: { orderId: commandeId } } });
    await prisma.dispute.deleteMany({ where: { orderId: commandeId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [clientId] } } });
    await prisma.order.deleteMany({ where: { reference: referenceCommande } });
    const produits = await prisma.product.findMany({
      where: { name: { contains: `de test ${marqueur}` } },
      select: { id: true },
    });
    const idsProduits = produits.map((produit) => produit.id);
    await prisma.productMarketData.deleteMany({ where: { productId: { in: idsProduits } } });
    await prisma.productImage.deleteMany({ where: { productId: { in: idsProduits } } });
    await prisma.product.deleteMany({ where: { id: { in: idsProduits } } });
    const fournisseurs = await prisma.supplier.findMany({
      where: { name: { contains: `de test ${marqueur}` } },
      select: { id: true },
    });
    const idsFournisseurs = fournisseurs.map((fournisseur) => fournisseur.id);
    await prisma.supplierLevelChange.deleteMany({ where: { supplierId: { in: idsFournisseurs } } });
    await prisma.supplierVerification.deleteMany({ where: { supplierId: { in: idsFournisseurs } } });
    await prisma.supplier.deleteMany({ where: { id: { in: idsFournisseurs } } });
    const formations = await prisma.course.findMany({
      where: { title: { contains: `de test ${marqueur}` } },
      select: { id: true },
    });
    const idsFormations = formations.map((formation) => formation.id);
    await prisma.lesson.deleteMany({ where: { courseId: { in: idsFormations } } });
    await prisma.chapter.deleteMany({ where: { courseId: { in: idsFormations } } });
    await prisma.libraryResource.deleteMany({ where: { title: { contains: `de test ${marqueur}` } } });
    await prisma.course.deleteMany({ where: { id: { in: idsFormations } } });
    await prisma.instructor.deleteMany({ where: { name: { contains: `de test ${marqueur}` } } });
    const comptes = await prisma.user.findMany({
      where: { email: { in: [emailClient, emailAdmin, emailSuper] } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: comptes.map((compte) => compte.id) } } });
    await prisma.user.deleteMany({ where: { email: { in: [emailClient, emailAdmin, emailSuper] } } });
    await app.close();
  });

  describe('droits d’accès (§40)', () => {
    it('exige une session sur toute route d’administration', async () => {
      await request(app.getHttpServer()).get('/v1/admin/stats').expect(401);
      await request(app.getHttpServer()).get('/v1/admin/users').expect(401);
      await request(app.getHttpServer()).get('/v1/admin/orders').expect(401);
      await request(app.getHttpServer()).get('/v1/admin/disputes').expect(401);
    });

    it('renvoie 403 à un client sur toute route d’administration', async () => {
      const refus = await client.get('/v1/admin/stats').expect(403);
      expect(refus.body.message).toBe("Votre compte n'a pas accès à cette fonctionnalité.");

      await client.get('/v1/admin/dashboard').expect(403);
      await client.get('/v1/admin/audit').expect(403);
      await client.get('/v1/admin/users').expect(403);
      await client.patch(`/v1/admin/users/${clientId}/role`).send({ role: 'ADMIN', reason: 'essai' }).expect(403);
      await client.get('/v1/admin/orders').expect(403);
      await client.get(`/v1/admin/orders/${commandeId}`).expect(403);
      await client
        .patch(`/v1/admin/orders/${commandeId}/status`)
        .send({ status: 'PAID', reason: 'essai' })
        .expect(403);
      await client.get('/v1/admin/disputes').expect(403);
      await client
        .post('/v1/admin/disputes')
        .send({ orderId: commandeId, category: 'AUTRE', subject: 'essai', description: 'essai essai' })
        .expect(403);
    });
  });

  describe('indicateurs (ADM-02)', () => {
    it('agrège des chiffres réels, et zéro quand il n’y a rien', async () => {
      const reponse = await admin.get('/v1/admin/stats?periode=7j').expect(200);

      expect(reponse.body.provenance).toBe('VERIFIED');
      expect(reponse.body.period).toBe('7j');
      expect(typeof reponse.body.since).toBe('string');
      // La commande créée par le test est comptée, et elle n'est pas payée.
      expect(reponse.body.orders.total).toBeGreaterThanOrEqual(1);
      expect(reponse.body.orders.pendingPayment).toBeGreaterThanOrEqual(1);
      // Tous les états de paiement sont présents, même ceux sans aucune ligne.
      expect(reponse.body.payments.byStatus).toHaveLength(7);
      for (const ligne of reponse.body.payments.byStatus) {
        expect(ligne.count).toBeGreaterThanOrEqual(0);
        expect(ligne.amountXaf).toBeGreaterThanOrEqual(0);
      }
      // Aucun chiffre n'est estimé : les totaux restent cohérents entre eux.
      expect(reponse.body.revenue.netXaf).toBe(
        reponse.body.revenue.grossXaf - reponse.body.revenue.refundedXaf,
      );
    });

    it('ne borne pas la période « tout » et refuse une période inconnue', async () => {
      const tout = await admin.get('/v1/admin/stats?periode=tout').expect(200);
      expect(tout.body.since).toBeNull();

      await admin.get('/v1/admin/stats?periode=hier').expect(400);
    });

    it('sert le tableau de bord avec son journal d’audit', async () => {
      const reponse = await admin.get('/v1/admin/dashboard?periode=30j').expect(200);
      expect(reponse.body.stats.period).toBe('30j');
      expect(Array.isArray(reponse.body.audit.entries)).toBe(true);
    });
  });

  describe('utilisateurs et rôles (ADM-07)', () => {
    it('laisse un administrateur lire la liste et la filtrer', async () => {
      const reponse = await admin.get(`/v1/admin/users?recherche=${encodeURIComponent(emailClient)}`).expect(200);
      expect(reponse.body.users).toHaveLength(1);
      expect(reponse.body.users[0].role).toBe('CLIENT');
      expect(reponse.body.users[0].orderCount).toBe(1);
    });

    it('refuse à un ADMIN de promouvoir quelqu’un SUPER_ADMIN', async () => {
      const refus = await admin
        .patch(`/v1/admin/users/${clientId}/role`)
        .send({ role: 'SUPER_ADMIN', reason: 'tentative de promotion' })
        .expect(403);
      expect(refus.body.message).toBe("Votre compte n'a pas accès à cette fonctionnalité.");

      // Aucun changement de rôle n'a été écrit.
      const inchange = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(inchange.role).toBe('CLIENT');
    });

    it('laisse un SUPER_ADMIN changer un rôle, et le journalise', async () => {
      const reponse = await superAdmin
        .patch(`/v1/admin/users/${clientId}/role`)
        .send({ role: 'SUPPORT', reason: 'renfort support pendant les fêtes' })
        .expect(200);

      expect(reponse.body.previousRole).toBe('CLIENT');
      expect(reponse.body.user.role).toBe('SUPPORT');

      const trace = await prisma.auditLog.findFirst({
        where: { action: 'user.role.changed', entityId: clientId },
        orderBy: { createdAt: 'desc' },
      });
      expect(trace).not.toBeNull();
      expect(trace?.metadata).toMatchObject({ from: 'CLIENT', to: 'SUPPORT' });

      // Remise en état : le compte redevient client pour la suite du fichier.
      await prisma.user.update({ where: { id: clientId }, data: { role: 'CLIENT' } });
    });

    it('refuse un motif vide et un rôle inconnu', async () => {
      await superAdmin.patch(`/v1/admin/users/${clientId}/role`).send({ role: 'ADMIN', reason: '' }).expect(400);
      await superAdmin
        .patch(`/v1/admin/users/${clientId}/role`)
        .send({ role: 'PATRON', reason: 'motif valable' })
        .expect(400);
    });

    it('refuse à un super-administrateur de changer son propre rôle', async () => {
      const moi = await prisma.user.findUniqueOrThrow({ where: { email: emailSuper } });
      await superAdmin
        .patch(`/v1/admin/users/${moi.id}/role`)
        .send({ role: 'CLIENT', reason: 'auto-rétrogradation' })
        .expect(400);
    });
  });

  describe('commandes (ADM-06)', () => {
    it('liste, filtre et détaille une commande', async () => {
      const liste = await admin.get('/v1/admin/orders?statut=PENDING_PAYMENT').expect(200);
      expect(liste.body.orders.map((item: { id: string }) => item.id)).toContain(commandeId);

      const detail = await admin.get(`/v1/admin/orders/${commandeId}`).expect(200);
      expect(detail.body.order.reference).toBe(referenceCommande);
      expect(detail.body.amounts.totalXaf).toBe(150_000);
      expect(detail.body.allowedStatuses).toEqual(['PAID', 'CANCELLED']);
    });

    it('refuse une transition impossible et journalise celles qui passent', async () => {
      const passage = await admin
        .patch(`/v1/admin/orders/${commandeId}/status`)
        .send({ status: 'PAID', reason: 'paiement encaissé en espèces à l’entrepôt' })
        .expect(200);
      expect(passage.body.order.status).toBe('PAID');
      expect(passage.body.order.paidAt).not.toBeNull();
      expect(passage.body.allowedStatuses).toEqual(['CANCELLED']);

      // Une commande payée ne redevient pas « en attente de paiement ».
      const refus = await admin
        .patch(`/v1/admin/orders/${commandeId}/status`)
        .send({ status: 'PENDING_PAYMENT', reason: 'retour en arrière' })
        .expect(400);
      expect(refus.body.message).toContain('Payée');

      const trace = await prisma.auditLog.findFirst({
        where: { action: 'order.status.changed', entityId: commandeId },
        orderBy: { createdAt: 'desc' },
      });
      expect(trace?.metadata).toMatchObject({ from: 'PENDING_PAYMENT', to: 'PAID' });
    });

    it('renvoie 404 sur une commande inconnue', async () => {
      await admin.get('/v1/admin/orders/identifiant-inconnu').expect(404);
    });
  });

  describe('litiges (ADM-08, §39)', () => {
    it('ouvre un dossier rattaché à une commande', async () => {
      const ouvert = await admin
        .post('/v1/admin/disputes')
        .send({
          orderId: commandeId,
          category: 'NON_CONFORME',
          subject: 'Articles non conformes à l’échantillon',
          description: 'Le client signale une matière différente de l’échantillon validé.',
          claimedAmountXaf: 50_000,
        })
        .expect(201);

      litigeId = ouvert.body.dispute.id;
      expect(ouvert.body.dispute.status).toBe('OPENED');
      expect(ouvert.body.dispute.orderReference).toBe(referenceCommande);
      expect(ouvert.body.events).toHaveLength(1);
      expect(ouvert.body.allowedStatuses).toEqual(['ANALYSIS']);
    });

    it('refuse tout raccourci dans le workflow', async () => {
      const refus = await admin
        .post(`/v1/admin/disputes/${litigeId}/etapes`)
        .send({ status: 'RESOLVED', note: 'on rembourse tout de suite' })
        .expect(400);
      expect(refus.body.message).toContain('Analyse');

      await admin
        .post(`/v1/admin/disputes/${litigeId}/etapes`)
        .send({ status: 'CLOSED', note: 'clôture immédiate' })
        .expect(400);

      const inchange = await admin.get(`/v1/admin/disputes/${litigeId}`).expect(200);
      expect(inchange.body.dispute.status).toBe('OPENED');
      expect(inchange.body.events).toHaveLength(1);
    });

    it('exige une note à chaque étape', async () => {
      await admin.post(`/v1/admin/disputes/${litigeId}/etapes`).send({ status: 'ANALYSIS' }).expect(400);
      await admin
        .post(`/v1/admin/disputes/${litigeId}/etapes`)
        .send({ status: 'ANALYSIS', note: '' })
        .expect(400);
    });

    it('déroule les sept étapes dans l’ordre, en journalisant chacune', async () => {
      const etapes = [
        { status: 'ANALYSIS', note: 'Faits qualifiés : non-conformité de matière.' },
        {
          status: 'EVIDENCE',
          note: 'Photos du client et rapport d’inspection réunis.',
          evidenceUrl: 'https://exemple-warrior.cm/preuves/1.jpg',
        },
        { status: 'SUPPLIER_CONTACTED', note: 'Fournisseur saisi par écrit le jour même.' },
        { status: 'PROPOSAL', note: 'Geste commercial de 40 000 FCFA proposé au client.' },
        { status: 'RESOLVED', note: 'Proposition acceptée et appliquée.', resolvedAmountXaf: 40_000 },
        { status: 'CLOSED', note: 'Dossier clos, client informé.' },
      ];

      for (const etape of etapes) {
        const reponse = await admin.post(`/v1/admin/disputes/${litigeId}/etapes`).send(etape).expect(201);
        expect(reponse.body.dispute.status).toBe(etape.status);
      }

      const final = await admin.get(`/v1/admin/disputes/${litigeId}`).expect(200);
      expect(final.body.dispute.resolvedAmountXaf).toBe(40_000);
      expect(final.body.dispute.closedAt).not.toBeNull();
      expect(final.body.allowedStatuses).toEqual([]);
      // Ouverture + six passages : le journal conserve tout le parcours.
      expect(final.body.events).toHaveLength(7);
      expect(final.body.events[2].evidenceUrl).toBe('https://exemple-warrior.cm/preuves/1.jpg');

      const traces = await prisma.auditLog.count({
        where: { action: 'dispute.status.changed', entityId: litigeId },
      });
      expect(traces).toBe(6);
    });

    it('ne change plus rien sur un dossier clôturé', async () => {
      await admin
        .post(`/v1/admin/disputes/${litigeId}/etapes`)
        .send({ status: 'CLOSED', note: 'nouvelle tentative' })
        .expect(400);
    });

    it('compte les dossiers par étape, y compris les étapes vides', async () => {
      const liste = await admin.get('/v1/admin/disputes').expect(200);
      expect(liste.body.byStatus).toHaveLength(7);
      expect(liste.body.byStatus.find((item: { status: string }) => item.status === 'CLOSED').count).toBeGreaterThanOrEqual(1);
    });

    it('renvoie 404 sur un litige inconnu et refuse une commande inconnue', async () => {
      await admin.get('/v1/admin/disputes/identifiant-inconnu').expect(404);
      await admin
        .post('/v1/admin/disputes')
        .send({
          orderId: 'commande-inconnue',
          category: 'AUTRE',
          subject: 'Dossier orphelin',
          description: 'Description suffisamment longue.',
        })
        .expect(404);
    });
  });

  describe('gestion des produits (ADM-03)', () => {
    let produitId = '';

    it('refuse la gestion des produits à un client', async () => {
      await request(app.getHttpServer()).get('/v1/admin/products').expect(401);
      await client.get('/v1/admin/products').expect(403);
      await client.post('/v1/admin/products').send({}).expect(403);
    });

    it('crée une fiche en brouillon et dit ce qui manque pour la publier', async () => {
      const creation = await admin
        .post('/v1/admin/products')
        .send({
          name: `Produit de test ${marqueur}`,
          description: 'Une description assez longue pour être acceptée par le contrat.',
          category: 'ELECTRONICS',
          purchasePriceMinor: 1_200,
          purchaseCurrency: 'CNY',
          exchangeRate: 85,
          exchangeRateAt: new Date().toISOString(),
          exchangeRateSource: 'Banque centrale, relevé manuel',
          moq: 50,
          weightGrams: 220,
        })
        .expect(201);

      produitId = creation.body.product.id;
      expect(creation.body.product.status).toBe('DRAFT');
      // Le prix en FCFA est recalculé par le serveur à partir du taux fourni.
      expect(creation.body.product.purchasePriceXaf).toBe(102_000);
      expect(creation.body.product.missingForPublication).toContain('Au moins une image du produit');
      expect(creation.body.market).toBeNull();
    });

    it('refuse de publier une fiche incomplète, et dit pourquoi', async () => {
      const refus = await admin
        .patch(`/v1/admin/products/${produitId}/status`)
        .send({ status: 'PUBLISHED', reason: 'Prête selon moi' })
        .expect(400);
      expect(refus.body.message).toContain('ne peut pas être publiée');
      expect(refus.body.message).toContain('image');

      const apres = await admin.get(`/v1/admin/products/${produitId}`).expect(200);
      expect(apres.body.product.status).toBe('DRAFT');
      expect(apres.body.product.publishedAt).toBeNull();
    });

    it('refuse un prix local sans date ni source (§54)', async () => {
      await admin
        .put(`/v1/admin/products/${produitId}/market`)
        .send({ localPriceMinXaf: 2_000, localPriceMaxXaf: 3_500 })
        .expect(400);

      const avecOrigine = await admin
        .put(`/v1/admin/products/${produitId}/market`)
        .send({
          localPriceMinXaf: 2_000,
          localPriceMaxXaf: 3_500,
          localPriceObservedAt: new Date().toISOString(),
          localPriceSource: 'Marché Mboppi, relevé terrain',
        })
        .expect(200);
      expect(avecOrigine.body.market.localPriceSource).toBe('Marché Mboppi, relevé terrain');
      expect(avecOrigine.body.market.localPriceObservedAt).not.toBeNull();
    });

    it('publie une fiche complète et journalise la décision', async () => {
      await prisma.productImage.create({
        data: { productId: produitId, url: 'https://exemple.test/image.jpg', alt: 'Produit de test', position: 0 },
      });
      await admin
        .patch(`/v1/admin/products/${produitId}`)
        .send({ watchPoints: ['Vérifier la conformité de la prise électrique'] })
        .expect(200);

      const publication = await admin
        .patch(`/v1/admin/products/${produitId}/status`)
        .send({ status: 'PUBLISHED', reason: 'Fiche complète et relevé de marché à jour' })
        .expect(200);
      expect(publication.body.product.status).toBe('PUBLISHED');
      expect(publication.body.product.publishedAt).not.toBeNull();
      expect(publication.body.product.missingForPublication).toEqual([]);

      const journal = await admin.get('/v1/admin/audit').expect(200);
      expect(
        journal.body.entries.some(
          (entree: { action: string; entityId: string | null }) =>
            entree.action === 'product.published' && entree.entityId === produitId,
        ),
      ).toBe(true);
    });

    it('retire une fiche sans effacer sa date de première publication', async () => {
      const avant = await admin.get(`/v1/admin/products/${produitId}`).expect(200);
      const retrait = await admin
        .patch(`/v1/admin/products/${produitId}/status`)
        .send({ status: 'ARCHIVED', reason: 'Fournisseur indisponible jusqu’à nouvel ordre' })
        .expect(200);
      expect(retrait.body.product.status).toBe('ARCHIVED');
      expect(retrait.body.product.publishedAt).toBe(avant.body.product.publishedAt);
    });
  });

  describe('fournisseurs et niveaux de vérification (ADM-04, §16)', () => {
    let fournisseurId = '';

    beforeAll(async () => {
      const fournisseur = await prisma.supplier.create({
        data: { name: `Fournisseur de test ${marqueur}`, type: 'MANUFACTURER', city: 'Guangzhou' },
      });
      fournisseurId = fournisseur.id;
    });

    it('refuse la gestion des fournisseurs à un client', async () => {
      await request(app.getHttpServer()).get('/v1/admin/suppliers').expect(401);
      await client.get('/v1/admin/suppliers').expect(403);
      await client.post(`/v1/admin/suppliers/${fournisseurId}/verifications`).send({}).expect(403);
    });

    it('présente une fiche sans preuve comme non vérifiée', async () => {
      const detail = await admin.get(`/v1/admin/suppliers/${fournisseurId}`).expect(200);
      expect(detail.body.supplier.unverified).toBe(true);
      expect(detail.body.supplier.currentLevel).toBeNull();
      expect(detail.body.verifications).toEqual([]);
    });

    it('refuse une promotion sans preuve consultable', async () => {
      await admin
        .post(`/v1/admin/suppliers/${fournisseurId}/verifications`)
        .send({
          level: 'IDENTITY_VERIFIED',
          verifiedAt: new Date().toISOString(),
          reason: 'Documents reçus par courriel',
        })
        .expect(400);

      await admin
        .post(`/v1/admin/suppliers/${fournisseurId}/verifications`)
        .send({
          level: 'IDENTITY_VERIFIED',
          evidenceUrl: 'pas-un-lien',
          verifiedAt: new Date().toISOString(),
          reason: 'Documents reçus par courriel',
        })
        .expect(400);

      const inchange = await admin.get(`/v1/admin/suppliers/${fournisseurId}`).expect(200);
      expect(inchange.body.supplier.currentLevel).toBeNull();
    });

    it('promeut avec preuve, et rattache la preuve au changement', async () => {
      const promotion = await admin
        .post(`/v1/admin/suppliers/${fournisseurId}/verifications`)
        .send({
          level: 'SUPPLIER_TESTED',
          evidenceUrl: 'https://exemple.test/preuves/commande-test.pdf',
          notes: 'Commande de 50 pièces reçue conforme.',
          verifiedAt: new Date().toISOString(),
          reason: 'Commande test passée et reçue, conforme au cahier des charges',
        })
        .expect(201);

      expect(promotion.body.supplier.currentLevel).toBe('SUPPLIER_TESTED');
      expect(promotion.body.supplier.unverified).toBe(false);
      expect(promotion.body.verification.evidenceUrl).toBe(
        'https://exemple.test/preuves/commande-test.pdf',
      );
      expect(promotion.body.change.demotion).toBe(false);

      // Aucune ligne de changement ne doit exister sans sa preuve.
      const changement = await prisma.supplierLevelChange.findFirstOrThrow({
        where: { supplierId: fournisseurId },
      });
      const preuve = await prisma.supplierVerification.findUnique({
        where: { id: changement.verificationId },
      });
      expect(preuve?.evidenceUrl).not.toBeNull();
    });

    it('signale une rétrogradation comme telle, preuve exigée là aussi', async () => {
      const retrogradation = await admin
        .post(`/v1/admin/suppliers/${fournisseurId}/verifications`)
        .send({
          level: 'IDENTITY_VERIFIED',
          evidenceUrl: 'https://exemple.test/preuves/incident.pdf',
          verifiedAt: new Date().toISOString(),
          reason: 'Qualité non conforme sur la dernière commande, niveau abaissé',
        })
        .expect(201);
      expect(retrogradation.body.change.demotion).toBe(true);

      // Le niveau affiché reste le plus haut réellement prouvé : la preuve antérieure existe
      // toujours, et l'historique montre la rétrogradation.
      const detail = await admin.get(`/v1/admin/suppliers/${fournisseurId}`).expect(200);
      expect(detail.body.changes[0].demotion).toBe(true);
      expect(detail.body.verifications).toHaveLength(2);
    });

    it('isole les fiches sans preuve par le filtre de niveau', async () => {
      const sansPreuve = await admin.get('/v1/admin/suppliers?level=aucun').expect(200);
      expect(
        sansPreuve.body.items.every((item: { unverified: boolean }) => item.unverified),
      ).toBe(true);
    });
  });

  describe('formations et bibliothèque (ADM-05)', () => {
    let formateurId = '';
    let formationId = '';
    let chapitreId = '';
    let leconId = '';

    it('refuse la gestion des formations à un client', async () => {
      await request(app.getHttpServer()).get('/v1/admin/courses').expect(401);
      await client.get('/v1/admin/courses').expect(403);
      await client.post('/v1/admin/instructors').send({}).expect(403);
    });

    it('ajoute un formateur avec ce qu’il fait réellement', async () => {
      const liste = await admin
        .post('/v1/admin/instructors')
        .send({
          name: `Formateur de test ${marqueur}`,
          headline: 'Transitaire au port de Douala depuis huit ans',
        })
        .expect(201);

      const cree = liste.body.items.find(
        (item: { name: string }) => item.name === `Formateur de test ${marqueur}`,
      );
      expect(cree).toBeDefined();
      expect(cree.courseCount).toBe(0);
      formateurId = cree.id;
    });

    it('refuse un prix sur une formation annoncée gratuite', async () => {
      await admin
        .post('/v1/admin/courses')
        .send({
          title: `Formation incohérente ${marqueur}`,
          summary: 'Un résumé suffisant pour le contrat.',
          description: 'Une description assez longue pour être acceptée par le contrat.',
          level: 'BEGINNER',
          theme: 'BASICS',
          access: 'FREE',
          priceXaf: 15_000,
          instructorId: formateurId,
        })
        .expect(400);
    });

    it('crée une formation non publiée et énumère ce qui manque', async () => {
      const creation = await admin
        .post('/v1/admin/courses')
        .send({
          title: `Formation de test ${marqueur}`,
          summary: 'Un résumé suffisant pour le contrat.',
          description: 'Une description assez longue pour être acceptée par le contrat.',
          level: 'BEGINNER',
          theme: 'BASICS',
          access: 'FREE',
          instructorId: formateurId,
        })
        .expect(201);

      formationId = creation.body.course.id;
      expect(creation.body.course.published).toBe(false);
      expect(creation.body.course.durationMinutes).toBe(0);
      expect(creation.body.course.missingForPublication).toContain('Au moins un chapitre');
      expect(creation.body.course.missingForPublication).toContain('Au moins une leçon publiée');
    });

    it('refuse de publier une formation sans programme, et dit pourquoi', async () => {
      const refus = await admin
        .patch(`/v1/admin/courses/${formationId}/publication`)
        .send({ published: true, reason: 'Prête selon moi' })
        .expect(400);
      expect(refus.body.message).toContain('ne peut pas être publiée');
      expect(refus.body.message).toContain('chapitre');
    });

    it('construit le programme : un chapitre, puis une leçon', async () => {
      const avecChapitre = await admin
        .post(`/v1/admin/courses/${formationId}/chapters`)
        .send({ title: 'Premier chapitre' })
        .expect(201);
      expect(avecChapitre.body.chapters).toHaveLength(1);
      chapitreId = avecChapitre.body.chapters[0].id;

      const avecLecon = await admin
        .post(`/v1/admin/courses/${formationId}/chapters/${chapitreId}/lessons`)
        .send({ title: 'Première leçon', durationMinutes: 12 })
        .expect(201);
      expect(avecLecon.body.chapters[0].lessons).toHaveLength(1);
      leconId = avecLecon.body.chapters[0].lessons[0].id;
      expect(avecLecon.body.chapters[0].lessons[0].published).toBe(false);
      expect(avecLecon.body.chapters[0].lessons[0].hasVideo).toBe(false);
    });

    it('refuse une vidéo à moitié renseignée', async () => {
      await admin
        .patch(`/v1/admin/courses/${formationId}/lessons/${leconId}`)
        .send({ videoPublicId: 'academy/test-video' })
        .expect(400);
    });

    it('refuse de publier une leçon sans vidéo', async () => {
      const refus = await admin
        .patch(`/v1/admin/courses/${formationId}/lessons/${leconId}`)
        .send({ published: true })
        .expect(400);
      expect(refus.body.message).toContain('vidéo');
    });

    it('publie la leçon une fois la vidéo déposée, et la durée suit', async () => {
      await admin
        .patch(`/v1/admin/courses/${formationId}/lessons/${leconId}`)
        .send({ videoPublicId: 'academy/test-video', videoFormat: 'mp4' })
        .expect(200);

      const publiee = await admin
        .patch(`/v1/admin/courses/${formationId}/lessons/${leconId}`)
        .send({ published: true })
        .expect(200);

      expect(publiee.body.chapters[0].lessons[0].published).toBe(true);
      // La durée annoncée ne compte que les leçons publiées.
      expect(publiee.body.course.durationMinutes).toBe(12);
      expect(publiee.body.course.publishedLessonCount).toBe(1);
    });

    it('refuse de supprimer un chapitre qui contient encore des leçons', async () => {
      const refus = await admin
        .delete(`/v1/admin/courses/${formationId}/chapters/${chapitreId}`)
        .expect(400);
      expect(refus.body.message).toContain('leçons');
    });

    it('publie la formation complète et journalise la décision', async () => {
      await admin
        .patch(`/v1/admin/courses/${formationId}`)
        .send({ outcomes: ['Savoir préparer un dossier de dédouanement'] })
        .expect(200);

      const publication = await admin
        .patch(`/v1/admin/courses/${formationId}/publication`)
        .send({ published: true, reason: 'Programme complet et relu' })
        .expect(200);
      expect(publication.body.course.published).toBe(true);
      expect(publication.body.course.missingForPublication).toEqual([]);

      const journal = await admin.get('/v1/admin/audit').expect(200);
      expect(
        journal.body.entries.some(
          (entree: { action: string; entityId: string | null }) =>
            entree.action === 'course.published' && entree.entityId === formationId,
        ),
      ).toBe(true);
    });

    it('retire la formation du catalogue, la décision restant au journal', async () => {
      const retrait = await admin
        .patch(`/v1/admin/courses/${formationId}/publication`)
        .send({ published: false, reason: 'Contenu à mettre à jour' })
        .expect(200);
      // `publishedAt` porte l'état de publication : le retrait l'efface, et c'est le
      // journal d'audit qui garde la trace des deux décisions.
      expect(retrait.body.course.published).toBe(false);
      expect(retrait.body.course.publishedAt).toBeNull();

      const journal = await admin.get('/v1/admin/audit').expect(200);
      expect(
        journal.body.entries.some(
          (entree: { action: string; entityId: string | null }) =>
            entree.action === 'course.unpublished' && entree.entityId === formationId,
        ),
      ).toBe(true);
    });

    it('refuse de publier une ressource sans fichier déposé', async () => {
      const ressource = await prisma.libraryResource.create({
        data: {
          slug: `ressource-test-${marqueur}`,
          title: `Ressource de test ${marqueur}`,
          description: 'Une description suffisante pour le contrat.',
          type: 'CHECKLIST',
          theme: 'BASICS',
          fileFormat: 'pdf',
        },
      });

      const refus = await admin
        .patch(`/v1/admin/resources/${ressource.id}/publication`)
        .send({ published: true, reason: 'Prête à publier' })
        .expect(400);
      expect(refus.body.message).toContain('fichier');

      const liste = await admin.get('/v1/admin/resources?publiee=non').expect(200);
      const trouvee = liste.body.items.find((item: { id: string }) => item.id === ressource.id);
      expect(trouvee.hasFile).toBe(false);
      expect(trouvee.published).toBe(false);
    });
  });
});
