import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { FavoritesService } from './favorites/favorites.service.js';
import { AdminJobsController } from './jobs/admin-jobs.controller.js';
import { BullMqJobsService } from './jobs/bullmq-jobs.service.js';
import { JobsService } from './jobs/jobs.service.js';
import { MemoryJobsService } from './jobs/memory-jobs.service.js';
import { SearchController } from './search/search.controller.js';
import { SearchService } from './search/search.service.js';
import { UploadsController } from './uploads/uploads.controller.js';
import { UploadsService } from './uploads/uploads.service.js';

export { FavoritesService, JobsService, SearchService, UploadsService };
export type { JobHandler, JobPayload, RepeatOptions, ScheduleOptions } from './jobs/jobs.service.js';

/**
 * Uploads Cloudinary, files de tâches, recherche globale et favoris (lot PLAT).
 *
 * `JobsService` bascule sur BullMQ dès que `REDIS_URL` est défini ; sans Redis (poste de
 * développement, tests), la file vit en mémoire. Les tests n'ouvrent jamais de connexion réseau.
 */
@Module({
  controllers: [UploadsController, AdminJobsController, SearchController],
  providers: [
    UploadsService,
    SearchService,
    FavoritesService,
    {
      provide: JobsService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): JobsService => {
        const redisUrl = config.get('REDIS_URL', { infer: true });
        const isTest = config.get('NODE_ENV', { infer: true }) === 'test';
        if (redisUrl && !isTest) {
          new Logger('Tâches').log('File de tâches : BullMQ sur Redis.');
          return new BullMqJobsService(redisUrl);
        }
        new Logger('Tâches').log('File de tâches : en mémoire (REDIS_URL absent). Rien ne survit à un redémarrage.');
        return new MemoryJobsService();
      },
    },
  ],
  exports: [JobsService, UploadsService, SearchService, FavoritesService],
})
export class PlatformModule {}
