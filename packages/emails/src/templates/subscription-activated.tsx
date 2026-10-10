import { z } from 'zod';
import {
  CtaButton,
  DarkCard,
  Divider,
  EmailLayout,
  InfoRows,
  Label,
  Panel,
  Paragraph,
  Small,
  Spacer,
  Subtitle,
  Title,
} from '../components/index.js';
import { BaseSchema, DateSchema, formatDate, greeting, LinkSchema, MoneyPropSchema } from '../props.js';
import { color, font, radius } from '../theme/tokens.js';

/**
 * Chasse fixe explicite : le thème n'en propose pas, et un mot de passe recopié à
 * la main a besoin que `l`, `1` et `I` ne se ressemblent pas.
 */
const MONOSPACE = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

/**
 * Abonnement actif, avec les identifiants de connexion engendrés au paiement.
 *
 * `password` est vide quand l'abonnement a été souscrit depuis un compte existant :
 * l'email dit alors « connectez-vous comme d'habitude » plutôt que d'inventer un mot
 * de passe que personne n'a demandé. C'est le seul email du catalogue qui transporte
 * un secret, et il le dit : pas de promotion, pas de lien de désabonnement.
 */
export const SubscriptionActivatedSchema = BaseSchema.extend({
  planName: z.string().default('Pro'),
  amount: MoneyPropSchema,
  endsAt: DateSchema,
  email: z.string().default('client@example.com'),
  /** Mot de passe engendré. Vide : le compte existait déjà, rien n'a été changé. */
  password: z.string().catch('').default(''),
  rights: z.array(z.string()).catch([]).default([]),
  loginUrl: LinkSchema,
});
export type SubscriptionActivatedProps = z.input<typeof SubscriptionActivatedSchema>;

export const subscriptionActivatedSubject = (props: z.output<typeof SubscriptionActivatedSchema>) =>
  props.password
    ? `Votre abonnement ${props.planName} est actif — vos identifiants`
    : `Votre abonnement ${props.planName} est actif`;

export function SubscriptionActivatedEmail(props: z.output<typeof SubscriptionActivatedSchema>) {
  return (
    <EmailLayout
      preview={
        props.password
          ? `Abonnement ${props.planName} actif. Vos identifiants de connexion sont dans cet email.`
          : `Votre abonnement ${props.planName} est actif.`
      }
      eyebrow="Abonnement"
      reason="Vous recevez cet email parce qu’un paiement d’abonnement a été confirmé pour cette adresse."
      brand={props.brand}
    >
      <Panel>
        <Label>Paiement confirmé</Label>
        <Spacer size={10} />
        <Title>Votre abonnement {props.planName} est actif</Title>
        <Spacer size={14} />
        <Paragraph>{greeting(props.firstName)}</Paragraph>
        <Spacer size={6} />
        <Subtitle>
          {props.password
            ? 'Votre compte a été créé avec ce paiement. Voici de quoi vous connecter.'
            : 'Vos droits sont ouverts. Connectez-vous avec vos identifiants habituels.'}
        </Subtitle>

        {props.password ? (
          <>
            <Spacer size={22} />
            <DarkCard tone="charcoal">
              <Label tone="gold">Identifiant</Label>
              <Spacer size={6} />
              <span
                style={{
                  display: 'block',
                  fontFamily: font.body,
                  fontSize: '15px',
                  lineHeight: '22px',
                  fontWeight: 600,
                  color: '#ffffff',
                  wordBreak: 'break-all',
                }}
              >
                {props.email}
              </span>

              <Spacer size={16} />
              <Label tone="gold">Mot de passe</Label>
              <Spacer size={6} />
              {/*
                Le mot de passe n'existe en clair que dans cet email : il n'est pas
                conservé en base, donc il ne peut pas être renvoyé. Chasse fixe et
                interlettrage ouvert, pour qu'on puisse le recopier sans confondre
                un caractère avec un autre.
              */}
              <span
                style={{
                  display: 'inline-block',
                  fontFamily: MONOSPACE,
                  fontSize: '22px',
                  lineHeight: '30px',
                  fontWeight: 800,
                  letterSpacing: '3px',
                  color: color.goldBright,
                  backgroundColor: 'rgba(212,165,55,0.08)',
                  border: '1px solid rgba(212,165,55,0.35)',
                  borderRadius: radius.md,
                  padding: '10px 14px',
                  wordBreak: 'break-all',
                }}
              >
                {props.password}
              </span>
            </DarkCard>
          </>
        ) : null}

        <Spacer size={20} />
        <InfoRows
          rows={[
            { label: 'Offre', value: props.planName },
            { label: 'Montant réglé', value: `${props.amount.amountMinor.toLocaleString('fr-FR')} FCFA` },
            { label: 'Droits ouverts jusqu’au', value: formatDate(props.endsAt) },
          ]}
        />

        {props.rights.length > 0 ? (
          <>
            <Spacer size={16} />
            <Paragraph>Ce que cet abonnement ouvre : {props.rights.join(', ')}.</Paragraph>
          </>
        ) : null}

        <Spacer size={20} />
        <CtaButton href={props.loginUrl}>Me connecter</CtaButton>

        <Spacer size={20} />
        <Divider />
        <Spacer size={14} />
        <Small>
          {props.password
            ? 'Changez ce mot de passe après votre première connexion, et ne le communiquez à personne — y compris à une personne se présentant comme membre de notre équipe. Vous pouvez aussi vous connecter par code à six chiffres envoyé à cette adresse, sans mot de passe.'
            : 'Si vous n’êtes pas à l’origine de ce paiement, répondez à cet email : nous vérifierons avant que la période ne se renouvelle.'}
        </Small>
      </Panel>
    </EmailLayout>
  );
}
