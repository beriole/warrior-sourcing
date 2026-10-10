import { Module } from '@nestjs/common';
import { CalculatorService } from '../calculator/calculator.service.js';
import { CalculatorImportController } from '../calculator/import.controller.js';
import { CargoController } from './cargo.controller.js';
import { CargoService } from './cargo.service.js';
import { ShippingAddressService } from './shipping-address.service.js';

/**
 * Transitaires et grilles tarifaires (lot CARGO), et calculateur branché dessus (lot CALC).
 * Les deux vivent dans le même module : le calculateur ne sait calculer un fret
 * que parce qu'il lit les grilles saisies ici (CARGO-05, CALC-02).
 */
@Module({
  controllers: [CargoController, CalculatorImportController],
  providers: [CargoService, CalculatorService, ShippingAddressService],
  exports: [CargoService, CalculatorService],
})
export class CargoModule {}
