import { z } from 'zod';
import {
  CtaButton,
  DarkCard,
  Divider,
  EmailLayout,
  Label,
  Micro,
  Panel,
  Paragraph,
  Skyline,
  PillarGrid,
  Small,
  Spacer,
  Subtitle,
  TextLink,
  Title,
} from '../components/index.js';
import { BaseSchema, greeting, LinkSchema } from '../props.js';
import { color, font, type } from '../theme/tokens.js';

export const WelcomeSchema = BaseSchema.extend({
  /** Lien d'entrée dans la plateforme, après connexion. */
  dashboardUrl: LinkSchema,
  /** Première action conseillée, issue de l'onboarding. */
  nextStepLabel: z.string().default('Choisir une première opportunité'),
  nextStepUrl: LinkSchema,
});
export type WelcomeProps = z.input<typeof WelcomeSchema>;

export const welcomeSubject = (props: z.output<typeof WelcomeSchema>) =>
  props.firstName ? `${props.firstName}, votre espace d'importation est prêt` : "Votre espace d'importation est prêt";

/** Email de référence : il fixe le ton de tous les autres. */
export function WelcomeEmail(props: z.output<typeof WelcomeSchema>) {
  return (
    <EmailLayout
      preview="Votre espace est prêt : apprendre, sourcer, importer, vendre."
      eyebrow="Bienvenue"
      kicker="中国 → 🇨🇲"
      reason="Vous recevez cet email parce que votre compte vient d'être créé."
      brand={props.brand}
    >
      <Panel>
        <div className="ws-rise">
          <Label>Votre nouvel espace d'importation</Label>
          <Spacer size={10} />
          <Title>
            Bienvenue dans votre
            <br />
            <span style={{ color: color.imperial }}>espace d'importation</span>
          </Title>
          <Spacer size={14} />
          <Paragraph>{greeting(props.firstName)}</Paragraph>
          <Spacer size={6} />
          <Subtitle>
            Votre espace est maintenant prêt. Vous y trouverez tout ce qu'il faut pour transformer une idée
            d'importation en opération suivie : ce que vous devez faire, ce que cela coûte, où se trouve votre
            marchandise et ce qui vient ensuite.
          </Subtitle>
        </div>

        <Spacer size={24} />
        <div className="ws-rise-2">
          <PillarGrid />
        </div>

        <Spacer size={18} />
        <div className="ws-rise-3">
          <CtaButton href={props.dashboardUrl}>Découvrir ma plateforme</CtaButton>
        </div>

        <Spacer size={20} />
        <Divider tone="gold" />
        <Spacer size={20} />

        <DarkCard>
          <Skyline />
          <Spacer size={18} />
          <Label tone="gold">Votre prochaine étape</Label>
          <Spacer size={8} />
          <span
            style={{
              ...type.titleSmall,
              fontFamily: font.display,
              color: color.onDark,
              display: 'block',
            }}
          >
            Votre prochaine opportunité pourrait commencer ici.
          </span>
          <Spacer size={10} />
          <span style={{ ...type.small, fontFamily: font.body, color: color.onDarkMuted, display: 'block' }}>
            Nous vous proposons des produits adaptés à votre budget, avec le coût rendu estimé au Cameroun et la
            marge possible. À vous de décider, chiffres en main.
          </span>
          <Spacer size={16} />
          <CtaButton href={props.nextStepUrl} variant="gold">
            {props.nextStepLabel}
          </CtaButton>
        </DarkCard>

        <Spacer size={20} />
        <Small>
          Une question pour démarrer ? Écrivez-nous, un membre de l'équipe vous répond.{' '}
          <TextLink href={`mailto:${props.brand.supportEmail}`}>{props.brand.supportEmail}</TextLink>
        </Small>
        <Spacer size={6} />
        <Micro style={{ color: color.inkMuted }}>
          Les estimations affichées sur la plateforme reposent sur des hypothèses : elles ne garantissent aucun
          bénéfice.
        </Micro>
      </Panel>
    </EmailLayout>
  );
}
