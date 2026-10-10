import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CONVERSATION_CATEGORIES,
  CONVERSATION_CATEGORY_LABELS,
  CONVERSATION_STATUS_LABELS,
  messagePreview,
  statusAfterMessage,
  type ConversationCategory,
  type ConversationDetail,
  type ConversationListResponse,
  type ConversationQuery,
  type ConversationResponse,
  type ConversationStatus,
  type ConversationSummary,
  type CreateConversationRequest,
  type Message,
  type MessageAttachmentInput,
  type MessageAuthorKind,
  type PostMessageRequest,
} from '@ws/contracts';
import type { SessionUser } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

type LigneMessage = {
  id: string;
  authorKind: MessageAuthorKind;
  authorName: string;
  body: string;
  createdAt: Date;
  attachments: {
    id: string;
    title: string;
    fileFormat: string;
    sizeBytes: number | null;
    url: string;
  }[];
};

type LigneConversation = {
  id: string;
  userId: string;
  category: ConversationCategory;
  subject: string;
  status: ConversationStatus;
  orderReference: string | null;
  clientReadAt: Date | null;
  staffReadAt: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  user: { name: string; email: string };
  messages: LigneMessage[];
};

/**
 * Messagerie (lot MSG, §32).
 *
 * Trois décisions portent ce service :
 *
 * 1. **L'état est déduit, jamais déclaré.** « Répondu » suit une réponse réelle de
 *    l'équipe ; personne ne peut marquer une conversation comme traitée sans l'avoir
 *    traitée. Seule la clôture est un acte, et elle appartient à l'équipe.
 * 2. **Un message du client rouvre une conversation close.** Lui demander d'en ouvrir une
 *    autre ferait perdre le fil, et le contexte est précisément ce qui fait la valeur
 *    d'un échange écrit.
 * 3. **Les non-lus se comptent à partir d'un seul horodatage par côté.** Les messages
 *    sont ordonnés dans le temps et personne ne lit un dossier à l'envers : une table de
 *    lectures par message n'apporterait rien qu'une complication.
 */
@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  /** L'équipe, c'est tout ce qui n'est ni client ni membre premium. */
  private estEquipe(user: SessionUser): boolean {
    return user.role !== 'CLIENT' && user.role !== 'PREMIUM_MEMBER';
  }

  private nonLus(row: LigneConversation, pourEquipe: boolean): number {
    const depuis = pourEquipe ? row.staffReadAt : row.clientReadAt;
    const deLautre: MessageAuthorKind = pourEquipe ? 'CLIENT' : 'STAFF';
    return row.messages.filter(
      (message) =>
        message.authorKind === deLautre && (depuis === null || message.createdAt > depuis),
    ).length;
  }

  private resume(row: LigneConversation, pourEquipe: boolean): ConversationSummary {
    const dernier = row.messages[row.messages.length - 1];
    return {
      id: row.id,
      category: row.category,
      categoryLabel: CONVERSATION_CATEGORY_LABELS[row.category].label,
      subject: row.subject,
      status: row.status,
      statusLabel: CONVERSATION_STATUS_LABELS[row.status].label,
      orderReference: row.orderReference,
      lastMessagePreview: dernier ? messagePreview(dernier.body) : '',
      lastMessageAt: row.lastMessageAt.toISOString(),
      messageCount: row.messages.length,
      unreadCount: this.nonLus(row, pourEquipe),
      clientName: row.user.name || row.user.email,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private message(row: LigneMessage): Message {
    return {
      id: row.id,
      author: row.authorKind,
      authorName: row.authorName,
      body: row.body,
      attachments: row.attachments.map((piece) => ({
        id: piece.id,
        title: piece.title,
        fileFormat: piece.fileFormat,
        sizeBytes: piece.sizeBytes,
        url: piece.url,
      })),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private detail(row: LigneConversation, pourEquipe: boolean): ConversationDetail {
    return {
      ...this.resume(row, pourEquipe),
      messages: row.messages.map((message) => this.message(message)),
      // L'équipe peut toujours écrire, même sur une conversation close — c'est ainsi
      // qu'elle ajoute une précision après coup. Le client, lui, la rouvre en écrivant.
      canReply: true,
    };
  }

  private static readonly INCLUSION = {
    user: { select: { name: true, email: true } },
    messages: {
      orderBy: { createdAt: 'asc' as const },
      include: { attachments: { orderBy: { createdAt: 'asc' as const } } },
    },
  } as const;

  async list(user: SessionUser, query: ConversationQuery): Promise<ConversationListResponse> {
    const equipe = this.estEquipe(user);
    // `toutes` n'a d'effet que pour l'équipe : un client ne voit jamais que ses dossiers,
    // quel que soit le paramètre envoyé.
    const toutes = equipe && query.toutes === true;

    const where = {
      ...(toutes ? {} : { userId: user.id }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.statut ? { status: query.statut } : {}),
    };

    const [rows, total, parCategorie] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: MessagingService.INCLUSION,
        orderBy: { lastMessageAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.groupBy({
        by: ['category'],
        where: toutes ? {} : { userId: user.id },
        _count: { _all: true },
      }),
    ]);

    const items = rows.map((row) => this.resume(row as unknown as LigneConversation, toutes));

    return {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      items,
      unreadTotal: items.reduce((somme, item) => somme + item.unreadCount, 0),
      counts: CONVERSATION_CATEGORIES.map((category) => ({
        category,
        label: CONVERSATION_CATEGORY_LABELS[category].label,
        count: parCategorie.find((groupe) => groupe.category === category)?._count._all ?? 0,
      })).filter((compte) => compte.count > 0),
    };
  }

  /** Une conversation est lisible par son auteur et par l'équipe, par personne d'autre. */
  private async trouver(id: string, user: SessionUser): Promise<LigneConversation> {
    const row = await this.prisma.conversation.findUnique({
      where: { id },
      include: MessagingService.INCLUSION,
    });
    // Même réponse qu'un identifiant inconnu : on ne révèle pas l'existence du dossier.
    if (!row || (row.userId !== user.id && !this.estEquipe(user))) {
      throw new NotFoundException('Cette conversation n’existe pas.');
    }
    return row as unknown as LigneConversation;
  }

  async findOne(id: string, user: SessionUser): Promise<ConversationResponse> {
    const row = await this.trouver(id, user);
    const equipe = this.estEquipe(user);

    // Ouvrir, c'est lire : la marque de lecture se pose ici plutôt que d'exiger un appel
    // de plus que l'interface pourrait oublier.
    await this.prisma.conversation.update({
      where: { id },
      data: equipe ? { staffReadAt: new Date() } : { clientReadAt: new Date() },
    });

    return { conversation: this.detail(row, equipe) };
  }

  async create(user: SessionUser, input: CreateConversationRequest): Promise<ConversationResponse> {
    const equipe = this.estEquipe(user);
    const maintenant = new Date();

    const row = await this.prisma.conversation.create({
      data: {
        userId: user.id,
        category: input.category,
        subject: input.subject,
        orderReference: input.orderReference,
        status: statusAfterMessage(equipe ? 'STAFF' : 'CLIENT'),
        lastMessageAt: maintenant,
        // Celui qui écrit a lu ce qu'il écrit.
        ...(equipe ? { staffReadAt: maintenant } : { clientReadAt: maintenant }),
        messages: {
          create: {
            authorId: user.id,
            authorKind: equipe ? 'STAFF' : 'CLIENT',
            authorName: user.name || user.email,
            body: input.body,
            attachments: { create: this.pieces(input.attachments) },
          },
        },
      },
      include: MessagingService.INCLUSION,
    });

    return { conversation: this.detail(row as unknown as LigneConversation, equipe) };
  }

  private pieces(attachments: MessageAttachmentInput[]) {
    return attachments.map((piece) => ({
      title: piece.title,
      fileFormat: piece.fileFormat,
      sizeBytes: piece.sizeBytes,
      url: piece.url,
    }));
  }

  async postMessage(
    id: string,
    user: SessionUser,
    input: PostMessageRequest,
  ): Promise<ConversationResponse> {
    const conversation = await this.trouver(id, user);
    const equipe = this.estEquipe(user);
    const auteur: MessageAuthorKind = equipe ? 'STAFF' : 'CLIENT';
    const maintenant = new Date();

    await this.prisma.message.create({
      data: {
        conversationId: id,
        authorId: user.id,
        authorKind: auteur,
        authorName: user.name || user.email,
        body: input.body,
        attachments: { create: this.pieces(input.attachments) },
      },
    });

    await this.prisma.conversation.update({
      where: { id },
      data: {
        // Un message du client rouvre une conversation close : le fil continue.
        status: statusAfterMessage(auteur),
        lastMessageAt: maintenant,
        ...(equipe ? { staffReadAt: maintenant } : { clientReadAt: maintenant }),
      },
    });

    const fraiche = await this.prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: MessagingService.INCLUSION,
    });
    void conversation;
    return { conversation: this.detail(fraiche as unknown as LigneConversation, equipe) };
  }

  /** Clôture par l'équipe. Le client n'en a pas besoin : son silence suffit. */
  async close(id: string, user: SessionUser): Promise<ConversationResponse> {
    if (!this.estEquipe(user)) {
      throw new ForbiddenException('Seule l’équipe peut clore une conversation.');
    }
    const conversation = await this.trouver(id, user);
    if (conversation.status === 'CLOSED') {
      throw new ConflictException({
        message: 'Cette conversation est déjà close.',
        code: 'conversation_already_closed',
      });
    }

    await this.prisma.conversation.update({ where: { id }, data: { status: 'CLOSED' } });
    return this.findOne(id, user);
  }

  /** Nombre de messages non lus, pour une pastille de navigation. */
  async unreadCount(user: SessionUser): Promise<{ unread: number }> {
    const equipe = this.estEquipe(user);
    const rows = await this.prisma.conversation.findMany({
      where: equipe ? {} : { userId: user.id },
      include: MessagingService.INCLUSION,
    });

    return {
      unread: rows.reduce(
        (somme, row) => somme + this.nonLus(row as unknown as LigneConversation, equipe),
        0,
      ),
    };
  }
}
