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
import { configureApp } from '../src/bootstrap.js';
import { validateEnv } from '../src/config/env.js';
import { MailModule } from '../src/mail/mail.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { FakePaymentProvider } from '../src/payments/fake.provider.js';
import { PAYMENT_PROVIDER } from '../src/payments/payment-provider.js';
import { PaymentsModule } from '../src/payments/payments.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ServicesModule } from '../src/services/services.module.js';

/** Intercepte le code au lieu de l'envoyer : le test lit ce que l'utilisateur recevrait. */
class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/**
 * Prestations et commandes de prestation (SRV-01, SRV-02).
 *
 * L'agrégateur de paiement est remplacé par son implémentation en mémoire : aucun appel
 * réseau. Ce qui est vérifié ici n'est pas « ça répond 200 », mais les trois règles qui
 * protègent le client : le montant vient du catalogue, une prestation sur devis ne se
 * paie pas en ligne, et personne d'autre que l'équipe ne fait avancer une exécution.
 */
const PREFIX = 'e2e-srv-';

describe('Prestations (e2e)', () => {
  const stamp = Date.now();
  const email = `srv-${stamp}@exemple-warrior.cm`;
  const autreEmail = `srv-autre-${stamp}@exemple-warrior.cm`;
  const equipeEmail = `srv-equipe-${stamp}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();
  const provider = new FakePaymentProvider();
  const mail = { send: vi.fn(async () => ({ id: 'x', subject: 'x', transport: 'test' })) };

  let app: INestApplication;
  let prisma: PrismaService;
  let client: ReturnType<typeof request.agent>;
  let autre: ReturnType<typeof request.agent>;
  let equipe: ReturnType<typeof request.agent>;
  let reference = '';
  let providerRef = '';

  async function connecter(agent: ReturnType<typeof request.agent>, adresse: string) {
    await agent.post('/v1/auth/email-otp/send-verification-otp').send({ email: adresse, type: 'sign-in' }).expect(200);
    await agent.post('/v1/auth/sign-in/email-otp').send({ email: adresse, otp: otp.lastCode }).expect(200);
  }

  async function nettoyer() {
    const comptes = await prisma.user.findMany({
      where: { email: { in: [email, autreEmail, equipeEmail] } },
      select: { id: true },
    });
    const ids = comptes.map((compte) => compte.id);
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    const commandes = await prisma.serviceOrder.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const idsCommandes = commandes.map((commande) => commande.id);
    await prisma.serviceDeliverable.deleteMany({ where: { serviceOrderId: { in: idsCommandes } } });
    await prisma.serviceOrderEvent.deleteMany({ where: { serviceOrderId: { in: idsCommandes } } });
    await prisma.serviceOrder.deleteMany({ where: { id: { in: idsCommandes } } });
    await prisma.serviceOffering.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        MailModule.register(false),
        AuthModule,
        PaymentsModule,
        ServicesModule,
      ],
    })
      .overrideProvider(OtpSender)
      .useValue(otp)
      .overrideProvider(PAYMENT_PROVIDER)
      .useValue(provider)
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

    await prisma.serviceOffering.createMany({
      data: [
        {
          slug: `${PREFIX}inspection`,
          name: 'Inspection de test',
          summary: 'Prestation créée par les tests automatisés.',
          description: 'Prestation créée par les tests automatisés des prestations.',
          category: 'INSPECTION',
          pricingMode: 'FIXED',
          priceXaf: 45_000,
          leadTimeDays: 4,
          deliverables: ['Un rapport d’inspection'],
          conditions: ['Condition de test'],
          requirements: ['L’adresse du fournisseur'],
          position: 1,
          publishedAt: new Date('2026-09-01T00:00:00.000Z'),
        },
        {
          slug: `${PREFIX}sur-devis`,
          name: 'Transport de test',
          summary: 'Prestation sans tarif public, créée par les tests.',
          description: 'Prestation sans tarif public, créée par les tests automatisés.',
          category: 'SHIPPING',
          pricingMode: 'QUOTE',
          priceXaf: null,
          leadTimeDays: null,
          deliverables: ['Un devis détaillé'],
          conditions: ['Condition de test'],
          requirements: ['Le poids du colis'],
          position: 2,
          publishedAt: new Date('2026-09-01T00:00:00.000Z'),
        },
        {
          slug: `${PREFIX}brouillon`,
          name: 'Prestation non publiée',
          summary: 'Ne doit jamais apparaître au catalogue.',
          description: 'Prestation non publiée, créée par les tests automatisés.',
          category: 'COACHING',
          pricingMode: 'FIXED',
          priceXaf: 10_000,
          leadTimeDays: 1,
          deliverables: ['Rien'],
          conditions: ['Rien'],
          requirements: ['Rien'],
          position: 3,
          publishedAt: null,
        },
      ],
    });

    client = request.agent(app.getHttpServer());
    autre = request.agent(app.getHttpServer());
    equipe = request.agent(app.getHttpServer());
    await connecter(client, email);
    await connecter(autre, autreEmail);
    await connecter(equipe, equipeEmail);
    await prisma.user.update({ where: { email: equipeEmail }, data: { role: 'SOURCING_AGENT' } });
  });

  afterAll(async () => {
    await nettoyer();
    await app.close();
  });

  describe('Catalogue (SRV-01)', () => {
    it('sert les prestations publiées sans compte, et jamais un brouillon', async () => {
      const reponse = await request(app.getHttpServer()).get('/v1/services?perPage=48').expect(200);
      const slugs = reponse.body.items.map((item: { slug: string }) => item.slug);
      expect(slugs).toContain(`${PREFIX}inspection`);
      expect(slugs).not.toContain(`${PREFIX}brouillon`);
    });

    it('annonce « sur devis » et « délai non communiqué » au lieu d’inventer un chiffre (§54)', async () => {
      const fiche = await request(app.getHttpServer()).get(`/v1/services/${PREFIX}sur-devis`).expect(200);
      expect(fiche.body.service.priceXaf).toBeNull();
      expect(fiche.body.service.leadTimeLabel).toBe('Délai non communiqué');
      expect(fiche.body.service.orderable).toBe(false);
      expect(fiche.body.service.notOrderableReason).toContain('ne se paie pas en ligne');
    });

    it('porte livrables, conditions et prérequis sur la fiche', async () => {
      const fiche = await request(app.getHttpServer()).get(`/v1/services/${PREFIX}inspection`).expect(200);
      expect(fiche.body.service.deliverables.length).toBeGreaterThan(0);
      expect(fiche.body.service.conditions.length).toBeGreaterThan(0);
      expect(fiche.body.service.requirements.length).toBeGreaterThan(0);
      expect(fiche.body.service.leadTimeLabel).toBe('4 jours ouvrés');
    });

    it('ne sert ni une prestation inconnue ni une prestation non publiée', async () => {
      await request(app.getHttpServer()).get('/v1/services/prestation-inconnue').expect(404);
      await request(app.getHttpServer()).get(`/v1/services/${PREFIX}brouillon`).expect(404);
    });
  });

  describe('Commande et paiement (SRV-02)', () => {
    it('exige une session pour commander', async () => {
      await request(app.getHttpServer())
        .post('/v1/service-orders')
        .send({ serviceSlug: `${PREFIX}inspection` })
        .expect(401);
    });

    it('refuse de facturer une prestation sur devis', async () => {
      const refus = await client
        .post('/v1/service-orders')
        .send({
          serviceSlug: `${PREFIX}sur-devis`,
          brief: 'Un besoin décrit avec assez de mots pour passer le contrat.',
          city: 'Douala',
          contactPhone: '670112233',
          paymentMethod: 'MTN_MOMO',
        })
        .expect(409);
      expect(refus.body.message).toContain('ne se paie pas en ligne');
    });

    it('fige le montant du catalogue, sans l’accepter du client', async () => {
      const creation = await client
        .post('/v1/service-orders')
        .send({
          serviceSlug: `${PREFIX}inspection`,
          brief: 'Contrôler 200 coques de téléphone avant expédition depuis Shenzhen.',
          city: 'Douala',
          contactPhone: '670112233',
          quantity: 200,
          paymentMethod: 'MTN_MOMO',
        })
        .expect(201);

      reference = creation.body.order.reference;
      expect(creation.body.order.amountXaf).toBe(45_000);
      expect(creation.body.order.status).toBe('PENDING_PAYMENT');
      expect(creation.body.order.progressPercent).toBe(25);
      // Les livrables annoncés sont figés à la commande, pas relus sur la fiche.
      expect(creation.body.order.orderedDeliverables).toEqual(['Un rapport d’inspection']);
      expect(creation.body.payment.amountXaf).toBe(45_000);

      const paiement = await prisma.payment.findUniqueOrThrow({
        where: { reference: creation.body.payment.reference },
      });
      providerRef = paiement.providerRef ?? '';
      expect(paiement.serviceOrderId).not.toBeNull();
      expect(paiement.orderId).toBeNull();
    });

    it('ne montre la commande qu’à son auteur', async () => {
      await client.get(`/v1/service-orders/${reference}`).expect(200);
      // Même message qu'une référence inconnue : on ne révèle pas qu'elle existe.
      await autre.get(`/v1/service-orders/${reference}`).expect(404);
    });

    it('ne sert aucun livrable tant que la prestation n’est pas payée', async () => {
      const commande = await prisma.serviceOrder.findUniqueOrThrow({ where: { reference } });
      await prisma.serviceDeliverable.create({
        data: {
          serviceOrderId: commande.id,
          title: 'Rapport déposé trop tôt',
          fileFormat: 'pdf',
          url: 'https://exemple.test/rapport.pdf',
        },
      });

      const avant = await client.get(`/v1/service-orders/${reference}`).expect(200);
      expect(avant.body.order.deliverables).toEqual([]);
    });

    it('refuse à l’équipe de déposer un livrable avant paiement', async () => {
      const refus = await equipe
        .post(`/v1/service-orders/${reference}/livrables`)
        .send({ title: 'Rapport', fileFormat: 'pdf', url: 'https://exemple.test/r.pdf' })
        .expect(409);
      expect(refus.body.message).toContain('avant le paiement');
    });

    it('passe la commande à « payée » à la confirmation du paiement, et pas avant', async () => {
      provider.setStatus(providerRef, 'SUCCESSFUL');
      await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('x-wh-secret', provider.webhookSecret)
        .send(provider.webhookBody(providerRef))
        .expect(200);

      const apres = await client.get(`/v1/service-orders/${reference}`).expect(200);
      expect(apres.body.order.status).toBe('PAID');
      expect(apres.body.order.paidAt).not.toBeNull();
      expect(apres.body.order.progressPercent).toBe(50);
      // Le suivi lu par le client porte l'étape écrite par le paiement.
      expect(apres.body.order.events.some((event: { status: string }) => event.status === 'PAID')).toBe(true);
      // Les livrables deviennent visibles une fois la prestation payée.
      expect(apres.body.order.deliverables.length).toBe(1);
    });
  });

  describe('Suivi d’exécution', () => {
    it('refuse au client de faire avancer sa propre commande', async () => {
      await client.patch(`/v1/service-orders/${reference}/etat`).send({ status: 'IN_PROGRESS' }).expect(403);
    });

    it('refuse d’écrire « payée » à la main', async () => {
      const refus = await equipe
        .patch(`/v1/service-orders/${reference}/etat`)
        .send({ status: 'PAID' })
        .expect(409);
      expect(refus.body.message).toContain('confirmation du paiement');
    });

    it('refuse une transition hors machine à états', async () => {
      const refus = await equipe
        .patch(`/v1/service-orders/${reference}/etat`)
        .send({ status: 'DELIVERED' })
        .expect(409);
      expect(refus.body.message).toContain('ne peut pas passer');
    });

    it('laisse l’équipe avancer étape par étape, avec sa note', async () => {
      const enCours = await equipe
        .patch(`/v1/service-orders/${reference}/etat`)
        .send({ status: 'IN_PROGRESS', note: 'Intervenant envoyé chez le fournisseur mercredi.' })
        .expect(200);
      expect(enCours.body.order.status).toBe('IN_PROGRESS');

      const attente = await equipe
        .patch(`/v1/service-orders/${reference}/etat`)
        .send({ status: 'AWAITING_CLIENT', note: 'Besoin de la référence exacte du modèle.' })
        .expect(200);
      // L'attente d'une réponse ne fait pas reculer l'avancement affiché.
      expect(attente.body.order.progressPercent).toBe(75);

      const livree = await equipe
        .patch(`/v1/service-orders/${reference}/etat`)
        .send({ status: 'DELIVERED', note: 'Rapport d’inspection déposé.' })
        .expect(200);
      expect(livree.body.order.status).toBe('DELIVERED');
      expect(livree.body.order.deliveredAt).not.toBeNull();
      expect(livree.body.order.progressPercent).toBe(100);
    });

    it('ne fait plus rien avancer une fois la prestation livrée', async () => {
      await equipe.patch(`/v1/service-orders/${reference}/etat`).send({ status: 'IN_PROGRESS' }).expect(409);
    });

    it('refuse de relancer le paiement d’une prestation déjà payée', async () => {
      const refus = await client
        .post(`/v1/service-orders/${reference}/payment`)
        .send({ paymentMethod: 'MTN_MOMO' })
        .expect(409);
      expect(refus.body.message).toContain('n’attend plus de paiement');
    });

    it('liste les commandes du client, et seulement les siennes', async () => {
      const miennes = await client.get('/v1/service-orders').expect(200);
      expect(miennes.body.items.some((item: { reference: string }) => item.reference === reference)).toBe(true);

      const autres = await autre.get('/v1/service-orders').expect(200);
      expect(autres.body.items).toEqual([]);
    });
  });

  describe('Annulation', () => {
    it('laisse annuler tant que rien n’est payé, puis plus rien', async () => {
      const creation = await client
        .post('/v1/service-orders')
        .send({
          serviceSlug: `${PREFIX}inspection`,
          brief: 'Une seconde demande, créée pour éprouver l’annulation.',
          city: 'Yaoundé',
          contactPhone: '690112233',
          paymentMethod: 'ORANGE_MONEY',
        })
        .expect(201);
      const seconde = creation.body.order.reference;

      const annulee = await client.patch(`/v1/service-orders/${seconde}/annulation`).expect(200);
      expect(annulee.body.order.status).toBe('CANCELLED');
      expect(annulee.body.order.progressPercent).toBe(0);

      await client.patch(`/v1/service-orders/${seconde}/annulation`).expect(409);
    });
  });
});
