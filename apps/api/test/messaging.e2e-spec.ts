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
import { MessagingModule } from '../src/messaging/messaging.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

class CapturingOtpSender extends OtpSender {
  public lastCode = '';

  async send(_email: string, code: string): Promise<void> {
    this.lastCode = code;
  }
}

/**
 * Messagerie (MSG-01).
 *
 * Ce qui est éprouvé : l'isolement des dossiers entre clients, l'état déduit de l'auteur,
 * la réouverture d'une conversation close par un message du client, et le compte des
 * non-lus de chaque côté.
 */
describe('Messagerie (e2e)', () => {
  const stamp = Date.now();
  const email = `msg-${stamp}@exemple-warrior.cm`;
  const autreEmail = `msg-autre-${stamp}@exemple-warrior.cm`;
  const equipeEmail = `msg-equipe-${stamp}@exemple-warrior.cm`;
  const otp = new CapturingOtpSender();
  const mail = { send: vi.fn(async () => ({ id: 'x', subject: 'x', transport: 'test' })) };

  let app: INestApplication;
  let prisma: PrismaService;
  let client: ReturnType<typeof request.agent>;
  let autre: ReturnType<typeof request.agent>;
  let equipe: ReturnType<typeof request.agent>;
  let conversationId = '';

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
    const conversations = await prisma.conversation.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const idsConversations = conversations.map((c) => c.id);
    const messages = await prisma.message.findMany({
      where: { conversationId: { in: idsConversations } },
      select: { id: true },
    });
    await prisma.messageAttachment.deleteMany({ where: { messageId: { in: messages.map((m) => m.id) } } });
    await prisma.message.deleteMany({ where: { conversationId: { in: idsConversations } } });
    await prisma.conversation.deleteMany({ where: { id: { in: idsConversations } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        MailModule.register(false),
        AuthModule,
        MessagingModule,
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

    client = request.agent(app.getHttpServer());
    autre = request.agent(app.getHttpServer());
    equipe = request.agent(app.getHttpServer());
    await connecter(client, email);
    await connecter(autre, autreEmail);
    await connecter(equipe, equipeEmail);
    await prisma.user.update({ where: { email: equipeEmail }, data: { role: 'SUPPORT', name: 'Agent de test' } });
    await prisma.user.update({ where: { email }, data: { name: 'Cliente de test' } });
  });

  afterAll(async () => {
    await nettoyer();
    await app.close();
  });

  it('exige une session', async () => {
    await request(app.getHttpServer()).get('/v1/conversations').expect(401);
    await request(app.getHttpServer()).post('/v1/conversations').send({}).expect(401);
  });

  it('refuse un premier message trop court pour être traité', async () => {
    await client
      .post('/v1/conversations')
      .send({ category: 'SOURCING', subject: 'Un sujet assez long', body: 'trop court' })
      .expect(400);
  });

  it('ouvre une conversation en attente de réponse', async () => {
    const creation = await client
      .post('/v1/conversations')
      .send({
        category: 'LOGISTICS',
        subject: 'Colis bloqué à la douane de Douala',
        orderReference: 'WS-20260901-A1B2',
        body: 'Mon colis est annoncé arrivé depuis six jours et rien ne bouge. Que dois-je fournir ?',
        attachments: [
          {
            title: 'Avis d’arrivée',
            fileFormat: 'pdf',
            url: 'https://exemple.test/avis.pdf',
            sizeBytes: 12_000,
          },
        ],
      })
      .expect(201);

    conversationId = creation.body.conversation.id;
    const { conversation } = creation.body;
    // L'état est déduit de l'auteur : un message du client laisse la main à l'équipe.
    expect(conversation.status).toBe('OPEN');
    expect(conversation.categoryLabel).toBe('Logistique');
    expect(conversation.orderReference).toBe('WS-20260901-A1B2');
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0].author).toBe('CLIENT');
    expect(conversation.messages[0].attachments).toHaveLength(1);
    // Celui qui écrit a lu ce qu'il écrit.
    expect(conversation.unreadCount).toBe(0);
  });

  it('ne montre pas le dossier d’un client à un autre', async () => {
    await client.get(`/v1/conversations/${conversationId}`).expect(200);
    // Même réponse qu'un identifiant inconnu : l'existence du dossier n'est pas révélée.
    await autre.get(`/v1/conversations/${conversationId}`).expect(404);

    const siennes = await autre.get('/v1/conversations').expect(200);
    expect(siennes.body.items).toEqual([]);
  });

  it('compte le message du client comme non lu pour l’équipe', async () => {
    const vueEquipe = await equipe.get('/v1/conversations?toutes=true').expect(200);
    const dossier = vueEquipe.body.items.find((item: { id: string }) => item.id === conversationId);
    expect(dossier.unreadCount).toBe(1);
    expect(dossier.clientName).toBe('Cliente de test');
    expect(vueEquipe.body.unreadTotal).toBeGreaterThanOrEqual(1);
  });

  it('ignore « toutes » pour un client : il ne voit que ses dossiers', async () => {
    const vueAutre = await autre.get('/v1/conversations?toutes=true').expect(200);
    expect(vueAutre.body.items).toEqual([]);
  });

  it('passe à « répondu » quand l’équipe écrit, et porte le nom de l’intervenant', async () => {
    const reponse = await equipe
      .post(`/v1/conversations/${conversationId}/messages`)
      .send({ body: 'Envoyez-nous la facture commerciale et le connaissement, nous relançons le transitaire.' })
      .expect(201);

    expect(reponse.body.conversation.status).toBe('ANSWERED');
    const dernier = reponse.body.conversation.messages.at(-1);
    expect(dernier.author).toBe('STAFF');
    expect(dernier.authorName).toBe('Agent de test');
  });

  it('marque le dossier comme lu quand le client l’ouvre', async () => {
    const avant = await client.get('/v1/conversations').expect(200);
    expect(avant.body.items[0].unreadCount).toBe(1);

    await client.get(`/v1/conversations/${conversationId}`).expect(200);

    const apres = await client.get('/v1/conversations').expect(200);
    expect(apres.body.items[0].unreadCount).toBe(0);
    expect(apres.body.unreadTotal).toBe(0);
  });

  it('réserve la clôture à l’équipe', async () => {
    await client.patch(`/v1/conversations/${conversationId}/cloture`).expect(403);

    const close = await equipe.patch(`/v1/conversations/${conversationId}/cloture`).expect(200);
    expect(close.body.conversation.status).toBe('CLOSED');

    await equipe.patch(`/v1/conversations/${conversationId}/cloture`).expect(409);
  });

  it('rouvre la conversation quand le client écrit après la clôture', async () => {
    const apres = await client
      .post(`/v1/conversations/${conversationId}/messages`)
      .send({ body: 'Le colis est toujours bloqué, j’ai envoyé les documents hier.' })
      .expect(201);

    // Le fil continue plutôt que d'obliger à ouvrir un second dossier sans contexte.
    expect(apres.body.conversation.status).toBe('OPEN');
    expect(apres.body.conversation.messages).toHaveLength(3);
  });

  it('filtre par catégorie et compte les dossiers réellement présents', async () => {
    await client
      .post('/v1/conversations')
      .send({
        category: 'TRAINING',
        subject: 'Accès à la leçon sur la douane',
        body: 'La vidéo de la troisième leçon ne se lance pas depuis mon téléphone.',
      })
      .expect(201);

    const logistique = await client.get('/v1/conversations?category=LOGISTICS').expect(200);
    expect(logistique.body.items).toHaveLength(1);

    const toutes = await client.get('/v1/conversations').expect(200);
    const categories = toutes.body.counts.map((compte: { category: string }) => compte.category);
    expect(categories).toContain('LOGISTICS');
    expect(categories).toContain('TRAINING');
    // Les catégories sans dossier ne sont pas annoncées : un onglet vide n'apprend rien.
    expect(categories).not.toContain('SUPPORT');
  });

  it('expose un compte de non-lus utilisable par la navigation', async () => {
    await equipe
      .post(`/v1/conversations/${conversationId}/messages`)
      .send({ body: 'Bien reçu, nous revenons vers vous sous 48 heures.' })
      .expect(201);

    const compte = await client.get('/v1/conversations/non-lus').expect(200);
    expect(compte.body.unread).toBe(1);
  });
});
