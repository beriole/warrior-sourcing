import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IMAGE_TRANSFORMATIONS,
  UPLOAD_ALLOWED_FORMATS,
  UPLOAD_MAX_BYTES,
  uploadKindForContentType,
  type CloudinaryResourceType,
  type ImageTransformation,
  type SignUploadRequest,
  type SignUploadResponse,
  type UploadKind,
} from '@ws/contracts';
import { v2 as cloudinary } from 'cloudinary';
import type { Env } from '../../config/env.js';

/** Identifiants Cloudinary, lus depuis `CLOUDINARY_URL` (cloudinary://<api_key>:<api_secret>@<cloud_name>). */
type CloudinaryCredentials = { cloudName: string; apiKey: string; apiSecret: string };

/** Préfixe de tous les dossiers de l'application dans le compte Cloudinary. */
const ROOT_FOLDER = 'warrior-sourcing';

/** Durée de validité d'une signature côté Cloudinary : une heure après `timestamp`. */
const SIGNATURE_TTL_MS = 60 * 60 * 1000;

const RESOURCE_TYPES: Record<UploadKind, CloudinaryResourceType> = {
  IMAGE: 'image',
  DOCUMENT: 'raw',
  VIDEO: 'video',
};

const KIND_LABELS: Record<UploadKind, string> = {
  IMAGE: 'une image (JPEG, PNG ou WebP)',
  DOCUMENT: 'un document PDF',
  VIDEO: 'une vidéo MP4',
};

/**
 * Signature des envois Cloudinary (PLAT-06).
 *
 * Le serveur ne reçoit jamais le fichier : il vérifie le type et la taille annoncés, puis
 * signe les paramètres (horodatage, dossier, identifiant, formats autorisés). Le navigateur
 * envoie ensuite les octets directement à Cloudinary avec cette signature. Cloudinary
 * refuse tout paramètre qui ne correspond pas à la signature, donc le dossier et les
 * formats ne peuvent pas être modifiés côté client.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly credentials: CloudinaryCredentials | null;

  constructor(config: ConfigService<Env, true>) {
    this.credentials = parseCloudinaryUrl(config.get('CLOUDINARY_URL', { infer: true }));
    if (!this.credentials) {
      this.logger.warn('CLOUDINARY_URL absent : les envois de fichiers sont désactivés.');
    }
  }

  /** Vrai quand un compte Cloudinary est configuré. */
  get enabled(): boolean {
    return this.credentials !== null;
  }

  /** Vérifie le type et la taille, puis signe un envoi direct vers Cloudinary. */
  sign(request: SignUploadRequest): SignUploadResponse {
    const kind = this.checkFile(request.contentType, request.sizeBytes);

    if (!this.credentials) {
      throw new ServiceUnavailableException("L'envoi de fichiers n'est pas disponible pour le moment.");
    }

    const resourceType = RESOURCE_TYPES[kind];
    const folder = `${ROOT_FOLDER}/${request.folder}`;
    const publicId = randomBytes(12).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);

    // Seuls ces paramètres sont signés : Cloudinary rejettera un envoi qui en change un.
    const signed: Record<string, string | number> = {
      timestamp,
      folder,
      public_id: publicId,
      allowed_formats: UPLOAD_ALLOWED_FORMATS[kind].join(','),
    };
    const signature = cloudinary.utils.api_sign_request(signed, this.credentials.apiSecret);

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.credentials.cloudName}/${resourceType}/upload`,
      fields: {
        ...Object.fromEntries(Object.entries(signed).map(([key, value]) => [key, String(value)])),
        api_key: this.credentials.apiKey,
        signature,
      },
      kind,
      resourceType,
      publicId,
      folder,
      maxBytes: UPLOAD_MAX_BYTES[kind],
      expiresAt: new Date(timestamp * 1000 + SIGNATURE_TTL_MS).toISOString(),
    };
  }

  /**
   * Contrôle du type et de la taille annoncés. Les messages sont ceux que verra l'utilisateur.
   * Renvoie la famille du fichier.
   */
  checkFile(contentType: string, sizeBytes: number): UploadKind {
    const kind = uploadKindForContentType(contentType);
    if (!kind) {
      throw new BadRequestException({
        message: 'Ce type de fichier n’est pas accepté. Envoyez une image (JPEG, PNG, WebP), un PDF ou une vidéo MP4.',
        code: 'unsupported_file_type',
      });
    }

    const maxBytes = UPLOAD_MAX_BYTES[kind];
    if (sizeBytes > maxBytes) {
      throw new BadRequestException({
        message: `Ce fichier est trop volumineux : ${KIND_LABELS[kind]} ne doit pas dépasser ${formatMegabytes(maxBytes)}.`,
        code: 'file_too_large',
      });
    }

    return kind;
  }

  /**
   * URL de livraison d'une image stockée, avec une transformation nommée
   * (vignette, carte, plein écran) et format/qualité automatiques.
   * Pour un module qui conserve l'identifiant public plutôt que l'URL complète.
   */
  imageUrl(publicId: string, transformation: ImageTransformation = 'card'): string | null {
    if (!this.credentials) return null;
    return cloudinary.url(publicId, {
      cloud_name: this.credentials.cloudName,
      secure: true,
      resource_type: 'image',
      raw_transformation: IMAGE_TRANSFORMATIONS[transformation],
    });
  }
}

function parseCloudinaryUrl(value: string | undefined): CloudinaryCredentials | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const cloudName = url.hostname;
    const apiKey = decodeURIComponent(url.username);
    const apiSecret = decodeURIComponent(url.password);
    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  } catch {
    return null;
  }
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} Mo`;
}
