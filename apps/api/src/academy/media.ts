import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { Env } from '../config/env.js';

/** Identifiants Cloudinary, lus depuis `CLOUDINARY_URL` (cloudinary://<api_key>:<api_secret>@<cloud_name>). */
type CloudinaryCredentials = { cloudName: string; apiKey: string; apiSecret: string };

/** Durée de validité d'un lien de lecture ou de téléchargement : quelques heures (§26). */
export const MEDIA_LINK_TTL_MS = 6 * 60 * 60 * 1000;

/** Un lien signé et sa fin de validité. */
export interface SignedMedia {
  url: string;
  expiresAt: Date;
}

/**
 * Liens de lecture et de téléchargement de l'Academy (ACA-02, DEC-04).
 *
 * L'URL n'est jamais stockée en base : elle est signée à la demande, et seulement après que
 * le service a vérifié le droit d'accès. Une URL absente de la réponse est donc une URL
 * qu'aucun client ne peut deviner.
 *
 * Le lot PLAT signe les *envois* vers Cloudinary (`platform/uploads`) ; il ne signe pas les
 * liens de *livraison*, et ce module appartient à un autre lot. Les identifiants sont donc
 * relus ici. Quand `CLOUDINARY_URL` manque, `enabled` vaut faux et les réponses renseignent
 * `playbackUnavailableReason` plutôt que d'inventer une URL — c'est ce que prévoit le contrat.
 */
@Injectable()
export class AcademyMedia {
  private readonly logger = new Logger(AcademyMedia.name);
  private readonly credentials: CloudinaryCredentials | null;

  constructor(config: ConfigService<Env, true>) {
    this.credentials = parseCloudinaryUrl(config.get('CLOUDINARY_URL', { infer: true }));
    if (!this.credentials) {
      this.logger.warn('CLOUDINARY_URL absent : aucune vidéo ni aucun document ne peut être servi.');
      return;
    }

    // Le SDK ne permet pas de passer les identifiants à `private_download_url` : il les lit
    // dans sa configuration. Ce sont les mêmes que celles du lot PLAT (une seule variable
    // d'environnement), donc rien d'autre dans l'application n'en est affecté.
    cloudinary.config({
      cloud_name: this.credentials.cloudName,
      api_key: this.credentials.apiKey,
      api_secret: this.credentials.apiSecret,
      secure: true,
    });
  }

  /** Vrai quand un compte Cloudinary est configuré. */
  get enabled(): boolean {
    return this.credentials !== null;
  }

  /**
   * Lien signé vers une vidéo de leçon, valable quelques heures.
   * `null` quand l'hébergement n'est pas configuré.
   */
  videoUrl(publicId: string, format: string): SignedMedia | null {
    // Lecture dans la page : le fichier est servi en ligne, pas en pièce jointe.
    return this.signed(publicId, format, 'video', false);
  }

  /**
   * Lien signé vers un fichier (PDF, document, modèle), valable quelques heures.
   * `null` quand l'hébergement n'est pas configuré.
   */
  fileUrl(publicId: string, format: string): SignedMedia | null {
    return this.signed(publicId, format, 'raw', true);
  }

  private signed(
    publicId: string,
    format: string,
    resourceType: 'video' | 'raw',
    attachment: boolean,
  ): SignedMedia | null {
    if (!this.credentials) return null;

    const expiresAt = new Date(Date.now() + MEDIA_LINK_TTL_MS);
    // `private_download_url` produit une URL signée qui cesse d'être valable à `expires_at` :
    // c'est l'outil documenté par Cloudinary pour un lien temporaire, et il porte la date de fin.
    const url = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      attachment,
    });

    return { url, expiresAt };
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
