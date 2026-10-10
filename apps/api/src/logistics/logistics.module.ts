import { Module } from '@nestjs/common';
import { LogisticsController } from './logistics.controller.js';
import { LogisticsService } from './logistics.service.js';

/**
 * Logistique, suivi et inspection (lot LOG).
 * MailService vient du module global de notifications ; PrismaService du module global de base.
 */
@Module({
  controllers: [LogisticsController],
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
