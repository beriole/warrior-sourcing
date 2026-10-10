import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJobsResponseSchema, type AdminJobsResponse } from '@ws/contracts';
import { AuthGuard, Roles } from '../../auth/auth.guard.js';
import { toOpenApiSchema } from '../../common/zod-validation.pipe.js';
import { JobsService } from './jobs.service.js';

/** Tableau de bord de la file de tâches (PLAT-07), réservé à l'administration (§40). */
@ApiTags('Administration')
@Controller('admin/jobs')
@UseGuards(AuthGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Tâches planifiées et leur dernier état' })
  @ApiOkResponse({ schema: toOpenApiSchema(AdminJobsResponseSchema) })
  async list(): Promise<AdminJobsResponse> {
    return { backend: this.jobs.backend, jobs: await this.jobs.list() };
  }
}
