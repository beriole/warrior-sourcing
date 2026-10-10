import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MeResponseSchema, UpdateMeRequestSchema, type MeResponse, type UpdateMeRequest } from '@ws/contracts';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js';

/**
 * Les routes d'inscription et de connexion sont servies par Better Auth,
 * monté sur /v1/auth (voir main.ts). Ce contrôleur n'expose que le profil courant.
 */
@ApiTags('Compte')
@Controller('me')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Utilisateur connecté et état de son onboarding' })
  @ApiOkResponse({ schema: toOpenApiSchema(MeResponseSchema) })
  async me(@Req() request: AuthenticatedRequest): Promise<MeResponse> {
    return this.lire(request.user.id);
  }

  /**
   * Modification des informations du compte.
   *
   * Le rôle n'est pas modifiable ici, et ne le sera jamais : il se change depuis le
   * back-office, réservé au SUPER_ADMIN et journalisé. L'email non plus — c'est
   * l'identifiant de connexion, et le changer demanderait de prouver qu'on possède la
   * nouvelle adresse.
   */
  @Patch()
  @ApiOperation({ summary: 'Modifier son nom ou son numéro de téléphone' })
  @ApiBody({ schema: toOpenApiSchema(UpdateMeRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(MeResponseSchema) })
  async update(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateMeRequestSchema)) input: UpdateMeRequest,
  ): Promise<MeResponse> {
    await this.prisma.user.update({
      where: { id: request.user.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        // `null` efface le numéro ; champ absent, on n'y touche pas.
        ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
      },
    });

    return this.lire(request.user.id);
  }

  /** Lecture du compte et de son profil, partagée par la consultation et la modification. */
  private async lire(userId: string): Promise<MeResponse> {
    const compte = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, phoneNumber: true, role: true },
    });
    const profile = await this.prisma.importerProfile.findUnique({
      where: { userId },
      select: { level: true, goals: true, budgetRange: true, interests: true, city: true },
    });

    return {
      user: {
        id: compte.id,
        name: compte.name,
        email: compte.email,
        phoneNumber: compte.phoneNumber,
        role: compte.role,
      },
      // L'interface sait ainsi s'il faut envoyer l'utilisateur vers l'onboarding (§10).
      onboardingCompleted: profile !== null,
      profile,
    };
  }
}
