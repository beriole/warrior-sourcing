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
import { BaseSchema, greeting, LinkSchema, MoneyPropSchema } from '../props.js';
import { color, font, radius } from '../theme/tokens.js';

/**
 * Chasse fixe explicite : le thème n'en propose pas, et un mot de passe recopié à la
 * main a besoin que `l`, `1` et `I` ne se ressemblent pas.
 */
const MONOSPACE = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

/**
 * Formation achetée à l'unité : l'accès est ouvert.
 *
 * `password` est vide quand l'achat a été fait depuis un compte existant — l'email dit
 * alors « connectez-vous comme d'habitude » plutôt que d'inventer un mot de passe que
 * personne n'a demandé.
 */
export const CourseAccessGrantedSchema = BaseSchema.extend({
  courseTitle: z.string().default('Les bases de l’importation'),
  amount: MoneyPropSchema,
  lessonCount: z.number().int().nonnegative().catch(0).default(0),
  email: z.string().default('client@example.com'),
  /** Mot de passe engendré. Vide : le compte existait déjà, rien n'a été changé. */
  password: z.string().catch('').default(''),
  courseUrl: LinkSchema,
  loginUrl: LinkSchema,
});
export type CourseAccessGrantedProps = z.input<typeof CourseAccessGrantedSchema>;

export const courseAccessGrantedSubject = (props: z.output<typeof CourseAccessGrantedSchema>) =>
  props.password
    ? `${props.courseTitle} — votre accès et vos identifiants`
    : `${props.courseTitle} — votre accès est ouvert`;

export function CourseAccessGrantedEmail(props: z.output<typeof CourseAccessGrantedSchema>) {
  return (
    <EmailLayout
      preview={`Votre accès à « ${props.courseTitle} » est ouvert.`}
      eyebrow="Academy"
      reason="Vous recevez cet email parce qu’un paiement de formation a été confirmé pour cette adresse."
      brand={props.brand}
    >
      <Panel>
        <Label>Paiement confirmé</Label>
        <Spacer size={10} />
        <Title>Votre accès est ouvert</Title>
        <Spacer size={14} />
        <Paragraph>{greeting(props.firstName)}</Paragraph>
        <Spacer size={6} />
        <Subtitle>
          {props.password
            ? `Votre compte a été créé avec ce paiement, et « ${props.courseTitle} » vous est ouverte.`
            : `« ${props.courseTitle} » vous est ouverte. Connectez-vous avec vos identifiants habituels.`}
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
                conservé en base, donc il ne peut pas être renvoyé.
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
            { label: 'Formation', value: props.courseTitle },
            { label: 'Montant réglé', value: `${props.amount.amountMinor.toLocaleString('fr-FR')} FCFA` },
            ...(props.lessonCount > 0
              ? [{ label: 'Leçons', value: `${props.lessonCount}` }]
              : []),
          ]}
        />

        <Spacer size={20} />
        <CtaButton href={props.courseUrl}>Ouvrir la formation</CtaButton>

        <Spacer size={20} />
        <Divider />
        <Spacer size={14} />
        <Small>
          {props.password
            ? 'Changez ce mot de passe après votre première connexion, et ne le communiquez à personne. Vous pouvez aussi vous connecter par code à six chiffres envoyé à cette adresse, sans mot de passe.'
            : 'Votre accès à cette formation n’expire pas : elle reste dans votre bibliothèque.'}
        </Small>
      </Panel>
    </EmailLayout>
  );
}
