import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FaqEntrySchema,
  PREORDER_CAMPAIGN_STATUS_LABELS,
  type CampaignProgress,
  type CreatePreorderCampaignRequest,
  type PreorderCampaignDetail,
  type PreorderCampaignListResponse,
  type PreorderCampaignSummary,
  type UpdatePreorderCampaignRequest,
} from '@ws/contracts';
import { z } from 'zod';
import type { PreorderCampaign, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Campagnes de précommande (ORD-04, §22).
 *
 * La progression est recalculée à chaque lecture à partir des participations réellement
 * payées : aucun compteur stocké, aucune urgence artificielle.
 */
@Injectable()
export class PreordersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Campagnes visibles par les clients : ouvertes d'abord, puis terminées récentes. */
  async list(includeDrafts = false): Promise<PreorderCampaignListResponse> {
    const campaigns = await this.prisma.preorderCampaign.findMany({
      where: includeDrafts ? {} : { status: { not: 'DRAFT' } },
      orderBy: [{ status: 'asc' }, { endsAt: 'asc' }],
      take: 100,
    });
    const progress = await this.progressFor(campaigns.map((campaign) => campaign.id));
    return {
      campaigns: campaigns
        .map((campaign) => this.toSummary(campaign, progress.get(campaign.id) ?? emptyProgress(campaign.minimumQuantity)))
        .sort((a, b) => Number(b.acceptsParticipation) - Number(a.acceptsParticipation)),
    };
  }

  async detail(slug: string, includeDrafts = false): Promise<PreorderCampaignDetail> {
    const campaign = await this.prisma.preorderCampaign.findUnique({ where: { slug } });
    if (!campaign || (!includeDrafts && campaign.status === 'DRAFT')) {
      throw new NotFoundException('Cette campagne n’existe pas.');
    }
    const progress = (await this.progressFor([campaign.id])).get(campaign.id) ?? emptyProgress(campaign.minimumQuantity);
    return this.toDetail(campaign, progress);
  }

  async create(input: CreatePreorderCampaignRequest): Promise<PreorderCampaignDetail> {
    const existing = await this.prisma.preorderCampaign.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictException({ message: 'Ce libellé d’URL est déjà utilisé.', code: 'slug_taken' });
    const campaign = await this.prisma.preorderCampaign.create({
      data: { ...input, faq: input.faq as Prisma.InputJsonValue },
    });
    return this.toDetail(campaign, emptyProgress(campaign.minimumQuantity));
  }

  async update(slug: string, input: UpdatePreorderCampaignRequest): Promise<PreorderCampaignDetail> {
    const campaign = await this.prisma.preorderCampaign.findUnique({ where: { slug } });
    if (!campaign) throw new NotFoundException('Cette campagne n’existe pas.');
    const { faq, ...rest } = input;
    const updated = await this.prisma.preorderCampaign.update({
      where: { id: campaign.id },
      data: { ...rest, ...(faq ? { faq: faq as Prisma.InputJsonValue } : {}) },
    });
    return this.detail(updated.slug, true);
  }

  /** Progression réelle : somme des quantités et participants distincts des commandes payées. */
  private async progressFor(campaignIds: string[]): Promise<Map<string, CampaignProgress>> {
    const result = new Map<string, CampaignProgress>();
    if (campaignIds.length === 0) return result;

    const paid = await this.prisma.order.findMany({
      where: { campaignId: { in: campaignIds }, status: 'PAID' },
      select: { campaignId: true, userId: true, lines: { select: { quantity: true } } },
    });
    const campaigns = await this.prisma.preorderCampaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, minimumQuantity: true },
    });

    for (const campaign of campaigns) {
      const orders = paid.filter((order) => order.campaignId === campaign.id);
      const committedQuantity = orders.reduce(
        (sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
        0,
      );
      const participantCount = new Set(orders.map((order) => order.userId)).size;
      const percent = campaign.minimumQuantity > 0 ? Math.min(100, Math.floor((committedQuantity * 100) / campaign.minimumQuantity)) : 0;
      result.set(campaign.id, {
        minimumQuantity: campaign.minimumQuantity,
        committedQuantity,
        participantCount,
        percent,
        reached: committedQuantity >= campaign.minimumQuantity,
        provenance: 'VERIFIED',
      });
    }
    return result;
  }

  private toSummary(campaign: PreorderCampaign, progress: CampaignProgress): PreorderCampaignSummary {
    return {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      status: campaign.status,
      statusLabel: PREORDER_CAMPAIGN_STATUS_LABELS[campaign.status],
      image: campaign.imageUrl ? { url: campaign.imageUrl, alt: campaign.imageAlt ?? campaign.title } : null,
      unitPriceXaf: campaign.unitPriceXaf,
      endsAt: campaign.endsAt.toISOString(),
      acceptsParticipation: campaign.status === 'OPEN' && campaign.endsAt > new Date(),
      progress,
    };
  }

  private async toDetail(campaign: PreorderCampaign, progress: CampaignProgress): Promise<PreorderCampaignDetail> {
    const faq = z.array(FaqEntrySchema).catch([]).parse(campaign.faq);
    const product = campaign.productId
      ? await this.prisma.product.findUnique({ where: { id: campaign.productId }, select: { slug: true } })
      : null;
    return {
      ...this.toSummary(campaign, progress),
      description: campaign.description,
      productSlug: product?.slug ?? null,
      included: campaign.included,
      excluded: campaign.excluded,
      leadTime: campaign.leadTime,
      conditions: campaign.conditions,
      faq,
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}

function emptyProgress(minimumQuantity: number): CampaignProgress {
  return { minimumQuantity, committedQuantity: 0, participantCount: 0, percent: 0, reached: false, provenance: 'VERIFIED' };
}
