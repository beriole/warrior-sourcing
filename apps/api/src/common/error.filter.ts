import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Réponse d'erreur unique, quelle que soit l'origine du problème. */
export type ErrorBody = {
  /** Message destiné à l'utilisateur, en français, sans terme technique (§45). */
  message: string;
  /** Code stable, pensé pour l'interface : elle branche dessus, jamais sur le texte. */
  code: string;
  /** Détail par champ, uniquement pour une saisie invalide. */
  issues?: { path: string; message: string }[];
  /** Identifiant de l'incident, repris dans les logs pour le support. */
  incidentId?: string;
};

const CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'invalid_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'payload_too_large',
  [HttpStatus.TOO_MANY_REQUESTS]: 'too_many_requests',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'service_unavailable',
};

/** Messages par défaut : jamais « Internal server error » en anglais devant un client. */
const MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Certaines informations sont invalides.',
  [HttpStatus.UNAUTHORIZED]: 'Vous devez être connecté pour continuer.',
  [HttpStatus.FORBIDDEN]: "Votre compte n'a pas accès à cette fonctionnalité.",
  [HttpStatus.NOT_FOUND]: "Cette page ou cette donnée n'existe pas.",
  [HttpStatus.CONFLICT]: 'Cette action entre en conflit avec une donnée existante.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Le fichier envoyé est trop volumineux.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Trop de tentatives. Patientez un instant, puis réessayez.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Le service est momentanément indisponible. Réessayez dans un instant.',
};

const FALLBACK = {
  message: "Une erreur inattendue s'est produite de notre côté. Réessayez dans un instant.",
  code: 'server_error',
};

/**
 * Traduit toute exception en une réponse unique (§45).
 *
 * Deux règles : l'utilisateur ne voit jamais de détail technique, et l'interface peut se fier
 * au `code` plutôt qu'au texte du message, qui peut changer ou être traduit.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erreur');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.buildBody(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Le détail reste dans les logs, avec l'identifiant remis au client.
      this.logger.error(
        `${request.method} ${request.url} — incident ${body.incidentId}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private buildBody(exception: unknown, status: number): ErrorBody {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return { ...FALLBACK, incidentId: randomIncidentId() };
    }

    const code = CODES[status] ?? 'request_failed';
    const fallbackMessage = MESSAGES[status] ?? 'La requête n’a pas abouti.';

    if (!(exception instanceof HttpException)) {
      return { message: fallbackMessage, code };
    }

    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { message: usable(payload) ?? fallbackMessage, code };
    }

    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      const rawMessage = record.message;

      return {
        // Nest renvoie parfois un tableau de messages : on garde le premier, lisible.
        message:
          (typeof rawMessage === 'string'
            ? usable(rawMessage)
            : Array.isArray(rawMessage) && typeof rawMessage[0] === 'string'
              ? usable(rawMessage[0])
              : null) ?? fallbackMessage,
        code: typeof record.code === 'string' ? record.code : code,
        ...(Array.isArray(record.issues) ? { issues: record.issues as ErrorBody['issues'] } : {}),
      };
    }

    return { message: fallbackMessage, code };
  }
}

/**
 * Écarte les messages techniques que produisent Nest et ses dépendances
 * (« Cannot GET /… », « Unauthorized », « Internal server error ») : ils ne sont ni
 * en français ni utiles à l'utilisateur. Le message par défaut prend alors le relais.
 */
function usable(message: string): string | null {
  const technical = /^(Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) )|^(Unauthorized|Forbidden|Not Found|Bad Request|Internal Server Error|Too Many Requests)$/i;
  return technical.test(message.trim()) ? null : message;
}

function randomIncidentId(): string {
  return Math.random().toString(36).slice(2, 10);
}
