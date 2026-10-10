import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { getEmail, isEmailKey } from '@ws/emails';
import type { Response } from 'express';
import type { Env } from '../config/env.js';
import { MailService } from './mail.service.js';

/**
 * Prévisualisation et envoi de test. Ce contrôleur n'est monté qu'hors production
 * (voir MailModule) : il ne doit jamais être joignable par un utilisateur final.
 */
@ApiExcludeController()
@Controller('dev/emails')
export class MailDevController {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  list() {
    return {
      templates: this.mail.listTemplates(),
      testRecipient: this.config.get('MAIL_TEST_RECIPIENT', { infer: true }),
    };
  }

  /** Aperçu HTML dans le navigateur : /v1/dev/emails/welcome?fixture=... */
  @Get(':key')
  async preview(@Param('key') key: string, @Query('fixture') fixture: string | undefined, @Res() res: Response) {
    const definition = this.resolve(key);
    const data = fixture ? definition.fixtures[fixture] : Object.values(definition.fixtures)[0];

    if (fixture && !Object.hasOwn(definition.fixtures, fixture)) {
      throw new NotFoundException(`Jeu de données « ${fixture} » inconnu pour ce template.`);
    }

    const { html } = await this.mail.render(key as never, data);
    res.type('html').send(html);
  }

  /** Version texte, pour vérifier la lisibilité sans HTML. */
  @Get(':key/text')
  async text(@Param('key') key: string, @Query('fixture') fixture: string | undefined) {
    const definition = this.resolve(key);
    const data = fixture ? definition.fixtures[fixture] : Object.values(definition.fixtures)[0];
    const { subject, text } = await this.mail.render(key as never, data);
    return { subject, text };
  }

  /** Envoi réel vers l'adresse de test, avec un jeu de données de démonstration. */
  @Post(':key/send')
  async send(@Param('key') key: string, @Body() body: { fixture?: string; to?: string; data?: unknown }) {
    const definition = this.resolve(key);
    const data = body.data ?? (body.fixture ? definition.fixtures[body.fixture] : Object.values(definition.fixtures)[0]);

    if (body.fixture && !Object.hasOwn(definition.fixtures, body.fixture)) {
      throw new BadRequestException(`Jeu de données « ${body.fixture} » inconnu pour ce template.`);
    }

    return this.mail.send({
      to: body.to ?? this.config.get('MAIL_TEST_RECIPIENT', { infer: true }),
      template: key as never,
      data,
    });
  }

  private resolve(key: string) {
    if (!isEmailKey(key)) {
      throw new NotFoundException(`Template « ${key} » inconnu.`);
    }
    return getEmail(key);
  }
}
