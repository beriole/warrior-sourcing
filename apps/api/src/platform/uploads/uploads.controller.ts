import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SignUploadRequestSchema, SignUploadResponseSchema, type SignUploadRequest, type SignUploadResponse } from '@ws/contracts';
import { AuthGuard } from '../../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { UploadsService } from './uploads.service.js';

/**
 * Signature des envois de fichiers (PLAT-06). Réservé aux comptes connectés : un visiteur
 * ne peut pas remplir le compte Cloudinary. Le fichier lui-même ne transite jamais par l'API.
 */
@ApiTags('Fichiers')
@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('sign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Signer un envoi direct vers Cloudinary (type et taille contrôlés)' })
  @ApiBody({ schema: toOpenApiSchema(SignUploadRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(SignUploadResponseSchema) })
  sign(@Body(new ZodValidationPipe(SignUploadRequestSchema)) body: SignUploadRequest): SignUploadResponse {
    return this.uploads.sign(body);
  }
}
