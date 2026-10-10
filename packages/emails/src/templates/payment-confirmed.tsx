import { PAYMENT_METHOD_LABELS, PaymentMethodSchema } from '@ws/contracts';
import { z } from 'zod';
import {
  AmountBlock,
  Badge,
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
  Timeline,
  Title,
} from '../components/index.js';
import { BaseSchema, DateSchema, formatDate, greeting, LinkSchema, MoneyPropSchema } from '../props.js';
import { color } from '../theme/tokens.js';

export const PaymentConfirmedSchema = BaseSchema.extend({
  orderReference: z.string().default('—'),
  transactionReference: z.string().default('—'),
  amount: MoneyPropSchema,
  method: PaymentMethodSchema.catch('MTN_MOMO').default('MTN_MOMO'),
  paidAt: DateSchema,
  productLabel: z.string().default('Votre commande'),
  quantity: z.number().int().positive().optional(),
  trackingUrl: LinkSchema,
  receiptUrl: LinkSchema,
  nextStep: z.string().default('Nous confirmons la commande auprès du fournisseur.'),
});
export type PaymentConfirmedProps = z.input<typeof PaymentConfirmedSchema>;

export const paymentConfirmedSubject = (props: z.output<typeof PaymentConfirmedSchema>) =>
  `Paiement confirmé · Commande ${props.orderReference}`;

/** Confirmation de paiement : le montant domine, la suite est annoncée tout de suite (§24). */
export function PaymentConfirmedEmail(props: z.output<typeof PaymentConfirmedSchema>) {
  return (
    <EmailLayout
      preview={`Paiement reçu pour la commande ${props.orderReference}. Voici la suite des opérations.`}
      eyebrow="Paiement confirmé"
      kicker={props.orderReference}
      reason="Vous recevez cet email parce qu'un paiement a été enregistré sur votre compte."
      brand={props.brand}
    >
      <Panel>
        <div className="ws-rise">
          <table role="presentation" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td style={{ paddingRight: '10px' }}>
                  <Badge tone="success">Paiement confirmé ✓</Badge>
                </td>
                <td>
                  <Badge tone="neutral">{PAYMENT_METHOD_LABELS[props.method]}</Badge>
                </td>
              </tr>
            </tbody>
          </table>
          <Spacer size={14} />
          <Title>Votre paiement est bien arrivé</Title>
          <Spacer size={12} />
          <Paragraph>
            {greeting(props.firstName)} nous avons bien reçu votre paiement pour « {props.productLabel} ».
          </Paragraph>
        </div>

        <Spacer size={20} />
        <div className="ws-rise-2">
          <DarkCard>
            <AmountBlock label="Montant réglé" value={props.amount} note={`Reçu le ${formatDate(props.paidAt, true)}`} />
            <Spacer size={18} />
            <Divider tone="gold" />
            <Spacer size={16} />
            <InfoRows
              tone="dark"
              rows={[
                { label: 'Commande', value: props.orderReference, strong: true },
                { label: 'Référence transaction', value: props.transactionReference },
                { label: 'Moyen de paiement', value: PAYMENT_METHOD_LABELS[props.method] },
                ...(props.quantity ? [{ label: 'Quantité', value: `${props.quantity}` }] : []),
              ]}
            />
          </DarkCard>
        </div>

        <Spacer size={22} />
        <Label tone="imperial">Où en est votre commande</Label>
        <Spacer size={14} />
        <Timeline
          tone="light"
          steps={[
            { label: 'Paiement reçu', state: 'done', meta: formatDate(props.paidAt) },
            { label: 'Commande confirmée', state: 'current' },
            { label: 'Préparation chez le fournisseur', state: 'upcoming' },
            { label: 'Transport vers le Cameroun', state: 'upcoming' },
            { label: 'Réception', state: 'upcoming' },
          ]}
        />

        <Spacer size={20} />
        <Small style={{ color: color.ink }}>Prochaine étape : {props.nextStep}</Small>
        <Spacer size={18} />
        <CtaButton href={props.trackingUrl}>Suivre ma commande</CtaButton>
        <Spacer size={14} />
        <Small>
          Votre reçu est disponible dans votre espace :{' '}
          <a href={props.receiptUrl} style={{ color: color.imperial, fontWeight: 600 }}>
            télécharger le reçu
          </a>
          .
        </Small>
      </Panel>
    </EmailLayout>
  );
}
