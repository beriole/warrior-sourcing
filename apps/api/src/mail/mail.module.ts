import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailDevController } from './mail.controller.js';
import { MailService } from './mail.service.js';

/**
 * Module de notifications email, global : n'importe quel module métier peut injecter MailService.
 * Les outils de prévisualisation ne sont montés qu'en dehors de la production.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {
  static register(isProduction: boolean): DynamicModule {
    return {
      module: MailModule,
      controllers: isProduction ? [] : [MailDevController],
    };
  }
}
