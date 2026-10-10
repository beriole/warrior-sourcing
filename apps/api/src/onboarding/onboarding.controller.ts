import { Body, Controller, Get, Logger, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BUDGET_RANGES,
  IMPORTER_GOAL_LABELS,
  IMPORTER_LEVEL_LABELS,
  ImporterProfileSchema,
  INTEREST_CATEGORY_LABELS,
  OnboardingOptionsResponseSchema,
  SaveProfileResponseSchema,
  type ImporterProfile,
  type OnboardingOptionsResponse,
  type SaveProfileResponse,
} from '@ws/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Adresse technique créée lors d'une inscription par téléphone : on n'y écrit pas. */
function isTemporaryEmail(email: string): boolean {
  return email.endsWith('@phone.warrior-sourcing.cm');
}

@ApiTags('Onboarding')
@Controller('me/profile')
@UseGuards(AuthGuard)
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Questions de l'onboarding, pour que l'interface reste alignée sur le serveur (§10). */
  @Get('options')
  @ApiOperation({ summary: 'Options de l’onboarding : niveaux, objectifs, budgets, catégories' })
  @ApiOkResponse({ schema: toOpenApiSchema(OnboardingOptionsResponseSchema) })
  options(): OnboardingOptionsResponse {
    return {
      levels: Object.entries(IMPORTER_LEVEL_LABELS).map(([id, label]) => ({ id, label })),
      goals: Object.entries(IMPORTER_GOAL_LABELS).map(([id, label]) => ({ id, label })),
      budgets: BUDGET_RANGES.map((range) => ({ id: range.id, min: range.min, max: range.max })),
      interests: Object.entries(INTEREST_CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
    };
  }

  @Put()
  @ApiOperation({ summary: 'Enregistre ou met à jour le profil d’importateur' })
  @ApiBody({ schema: toOpenApiSchema(ImporterProfileSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(SaveProfileResponseSchema) })
  async save(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(ImporterProfileSchema)) profile: ImporterProfile,
  ): Promise<SaveProfileResponse> {
    const userId = request.user.id;
    const existing = await this.prisma.importerProfile.findUnique({ where: { userId }, select: { id: true } });

    // Le nom appartient au compte, pas au profil d'importateur : il est écrit à part, et
    // l'email de bienvenue plus bas s'en sert aussitôt.
    const { name, ...preferences } = profile;
    await this.prisma.user.update({ where: { id: userId }, data: { name } });

    const saved = await this.prisma.importerProfile.upsert({
      where: { userId },
      create: { userId, ...preferences },
      update: preferences,
    });

    // Bienvenue envoyée une seule fois, sans faire attendre l'utilisateur : l'envoi part
    // en arrière-plan et un échec n'interrompt jamais l'onboarding.
    if (!existing && !isTemporaryEmail(request.user.email)) {
      void this.mail
        .send({
          to: request.user.email,
          template: 'welcome',
          userId,
          // Le nom qui vient d'être saisi, pas celui de la session : celle-ci porte
          // encore la valeur vide d'avant l'onboarding.
          data: { firstName: name },
        })
        .catch((error: unknown) => {
          this.logger.error(`Email de bienvenue non envoyé à ${request.user.email}`, error);
        });
    }

    return { onboardingCompleted: true, profile: saved };
  }
}
