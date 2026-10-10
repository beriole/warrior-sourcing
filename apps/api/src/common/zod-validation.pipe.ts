import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/**
 * Valide un corps de requête avec un schéma de @ws/contracts.
 * Les erreurs renvoyées sont lisibles (§45) : champ + message, jamais de trace technique.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Certaines informations sont invalides.',
        code: 'invalid_request',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}

/** Schéma OpenAPI dérivé du schéma Zod, pour que la doc reste alignée sur la validation. */
export function toOpenApiSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }) as Record<string, unknown>;
}
