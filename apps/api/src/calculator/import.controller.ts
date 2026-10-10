import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ImportCalculationInputSchema,
  ImportCalculationResponseSchema,
  SaveSimulationRequestSchema,
  SimulationListResponseSchema,
  SimulationResponseSchema,
  type ImportCalculationInput,
  type ImportCalculationResponse,
  type SaveSimulationRequest,
  type SimulationListResponse,
  type SimulationResponse,
} from '@ws/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CalculatorService } from './calculator.service.js';

/**
 * Calculateur d'importation complet (CALC-01, CALC-04) et simulations sauvegardées (CALC-05).
 * Le calcul est ouvert à tous : c'est l'outil d'entrée de la plateforme.
 * La sauvegarde exige un compte, et chacun ne voit que ses propres simulations.
 */
@ApiTags('Calculateur')
@Controller('calculator')
export class CalculatorImportController {
  constructor(private readonly calculator: CalculatorService) {}

  @Post('import')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Coût d’importation complet, tarif du transitaire appliqué, comparaison des trois modes',
  })
  @ApiBody({ schema: toOpenApiSchema(ImportCalculationInputSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ImportCalculationResponseSchema) })
  compute(
    @Body(new ZodValidationPipe(ImportCalculationInputSchema)) input: ImportCalculationInput,
  ): Promise<ImportCalculationResponse> {
    return this.calculator.compute(input);
  }

  @Get('simulations')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Mes simulations sauvegardées' })
  @ApiOkResponse({ schema: toOpenApiSchema(SimulationListResponseSchema) })
  list(@Req() request: AuthenticatedRequest): Promise<SimulationListResponse> {
    return this.calculator.listSimulations(request.user.id);
  }

  @Post('simulations')
  @HttpCode(201)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Sauvegarder une simulation (recalculée côté serveur)' })
  @ApiBody({ schema: toOpenApiSchema(SaveSimulationRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(SimulationResponseSchema) })
  save(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(SaveSimulationRequestSchema)) body: SaveSimulationRequest,
  ): Promise<SimulationResponse> {
    return this.calculator.saveSimulation(request.user.id, body);
  }

  @Get('simulations/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Reprendre une simulation sauvegardée' })
  @ApiOkResponse({ schema: toOpenApiSchema(SimulationResponseSchema) })
  detail(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<SimulationResponse> {
    return this.calculator.getSimulation(request.user.id, id);
  }

  @Post('simulations/:id/duplication')
  @HttpCode(201)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Dupliquer une simulation, recalculée avec les tarifs du jour' })
  @ApiOkResponse({ schema: toOpenApiSchema(SimulationResponseSchema) })
  duplicate(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<SimulationResponse> {
    return this.calculator.duplicateSimulation(request.user.id, id);
  }

  @Delete('simulations/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Supprimer une simulation' })
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ deleted: boolean }> {
    return this.calculator.deleteSimulation(request.user.id, id);
  }
}
