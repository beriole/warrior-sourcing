import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  computeLandedCost,
  LandedCostInputSchema,
  LandedCostResponseSchema,
  type LandedCostInput,
  type LandedCostResponse,
} from '@ws/contracts';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';

@ApiTags('Calculateur')
@Controller('calculator')
export class CalculatorController {
  @Post('landed-cost')
  @HttpCode(200)
  @ApiOperation({ summary: 'Coût rendu Cameroun, marge, ROI et seuil de rentabilité (estimation)' })
  @ApiBody({ schema: toOpenApiSchema(LandedCostInputSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(LandedCostResponseSchema) })
  landedCost(
    @Body(new ZodValidationPipe(LandedCostInputSchema)) input: LandedCostInput,
  ): LandedCostResponse {
    // Le même calcul tourne côté client pour l'affichage instantané ; le serveur fait foi.
    return {
      provenance: 'ESTIMATE',
      result: computeLandedCost(input),
    };
  }
}
