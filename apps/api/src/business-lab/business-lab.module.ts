import { Module } from '@nestjs/common';
import { BusinessLabController } from './business-lab.controller.js';
import { BusinessLabService } from './business-lab.service.js';

/** Business Lab (lot LAB, §27) : projets commerciaux, ventes et indicateurs constatés. */
@Module({
  controllers: [BusinessLabController],
  providers: [BusinessLabService],
  exports: [BusinessLabService],
})
export class BusinessLabModule {}
