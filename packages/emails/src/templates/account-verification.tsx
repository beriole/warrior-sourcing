import { z } from 'zod';
import { CtaButton, DarkCard, EmailLayout, Label, Panel, Paragraph, Small, Spacer, Subtitle, Title } from '../components/index.js';
import { BaseSchema, greeting, LinkSchema } from '../props.js';
import { color, font, radius } from '../theme/tokens.js';

export const AccountVerificationSchema = BaseSchema.extend({
  code: z.string().default('------'),
  expiresInMinutes: z.number().int().positive().catch(10).default(10),
  verifyUrl: LinkSchema,
});
export type AccountVerificationProps = z.input<typeof AccountVerificationSchema>;

export const accountVerificationSubject = (props: z.output<typeof AccountVerificationSchema>) =>
  `${props.code} — votre code de confirmation`;

/** Confirmation d'inscription. Email de sécurité : pas de promotion, pas de désabonnement. */
export function AccountVerificationEmail(props: z.output<typeof AccountVerificationSchema>) {
  return (
    <EmailLayout
      preview={`Votre code de confirmation expire dans ${props.expiresInMinutes} minutes.`}
      eyebrow="Confirmation d'inscription"
      reason="Vous recevez cet email pour confirmer la création de votre compte."
      brand={props.brand}
    >
      <Panel>
        <Label>Sécurité du compte</Label>
        <Spacer size={10} />
        <Title>Confirmez votre inscription</Title>
        <Spacer size={14} />
        <Paragraph>{greeting(props.firstName)}</Paragraph>
        <Spacer size={6} />
        <Subtitle>Saisissez ce code pour activer votre compte. Il est valable {props.expiresInMinutes} minutes.</Subtitle>

        <Spacer size={22} />
        <DarkCard tone="charcoal">
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td align="center">
                  <span
                    className="figures"
                    style={{
                      display: 'inline-block',
                      fontFamily: font.figures,
                      fontSize: '34px',
                      lineHeight: '42px',
                      fontWeight: 800,
                      letterSpacing: '10px',
                      color: color.goldBright,
                      backgroundColor: 'rgba(212,165,55,0.08)',
                      border: `1px solid rgba(212,165,55,0.35)`,
                      borderRadius: radius.md,
                      padding: '12px 10px 12px 20px',
                    }}
                  >
                    {props.code}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </DarkCard>

        <Spacer size={20} />
        <CtaButton href={props.verifyUrl}>Confirmer mon compte</CtaButton>

        <Spacer size={20} />
        <Small>
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : aucun compte ne sera activé sans ce
          code. Ne le communiquez à personne, y compris à une personne se présentant comme membre de notre équipe.
        </Small>
      </Panel>
    </EmailLayout>
  );
}
