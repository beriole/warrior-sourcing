import { z } from 'zod';
import {
  AmountBlock,
  Badge,
  CtaButton,
  DarkCard,
  EmailLayout,
  Figure,
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

export const DeliveryCompletedSchema = BaseSchema.extend({
  orderReference: z.string().default('—'),
  productLabel: z.string().default('Votre marchandise'),
  quantity: z.number().int().positive().catch(1).default(1),
  deliveredAt: DateSchema,
  pickupPoint: z.string().default('Entrepôt Douala'),
  /** Capital engagé, pour amorcer le suivi de rentabilité. */
  investedAmount: MoneyPropSchema,
  unitLandedCost: MoneyPropSchema,
  businessLabUrl: LinkSchema,
  inspectionReportUrl: LinkSchema.optional(),
});
export type DeliveryCompletedProps = z.input<typeof DeliveryCompletedSchema>;

export const deliveryCompletedSubject = (props: z.output<typeof DeliveryCompletedSchema>) =>
  `Marchandise reçue · Commande ${props.orderReference}`;

/** Réception : on referme la boucle logistique et on ouvre la boucle commerciale (§27, §50). */
export function DeliveryCompletedEmail(props: z.output<typeof DeliveryCompletedSchema>) {
  return (
    <EmailLayout
      preview="Votre marchandise est arrivée. Place à la vente."
      eyebrow="Réception confirmée"
      kicker={props.orderReference}
      reason="Vous recevez cet email parce qu'une de vos commandes vient d'être livrée."
      brand={props.brand}
    >
      <Panel>
        <div className="ws-rise">
          <Badge tone="success">Marchandise reçue ✓</Badge>
          <Spacer size={14} />
          <Title>Votre marchandise est arrivée</Title>
          <Spacer size={12} />
          <Paragraph>{greeting(props.firstName)}</Paragraph>
          <Spacer size={6} />
          <Subtitle>
            {props.productLabel} vous a été remis le {formatDate(props.deliveredAt)} à {props.pickupPoint}. Il est
            temps de suivre vos ventes pour savoir où vous en êtes réellement.
          </Subtitle>
        </div>

        <Spacer size={22} />
        <DarkCard>
          <AmountBlock label="Capital engagé" value={props.investedAmount} note="À récupérer par vos ventes" />
          <Spacer size={20} />
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td className="sm-stack sm-stack-gap" width="50%" style={{ width: '50%', verticalAlign: 'top' }}>
                  <Figure label="Quantité reçue" value={`${props.quantity}`} />
                </td>
                <td className="sm-stack" width="50%" style={{ width: '50%', verticalAlign: 'top' }}>
                  <Figure label="Coût rendu par unité" value={`${props.unitLandedCost.amountMinor.toLocaleString('fr-FR')} FCFA`} />
                </td>
              </tr>
            </tbody>
          </table>
        </DarkCard>

        <Spacer size={20} />
        <Label tone="imperial">Suite recommandée</Label>
        <Spacer size={12} />
        <InfoRows
          rows={[
            { label: 'Étape 1', value: 'Créer votre projet commercial', strong: true },
            { label: 'Étape 2', value: 'Saisir vos ventes au fur et à mesure' },
            { label: 'Étape 3', value: 'Suivre la récupération de votre capital' },
          ]}
        />

        <Spacer size={20} />
        <CtaButton href={props.businessLabUrl}>Enregistrer mes ventes</CtaButton>

        {props.inspectionReportUrl && (
          <>
            <Spacer size={14} />
            <Small>
              Le rapport d'inspection de cette commande reste consultable :{' '}
              <a href={props.inspectionReportUrl} style={{ fontWeight: 600 }}>
                ouvrir le rapport
              </a>
              .
            </Small>
          </>
        )}
      </Panel>
    </EmailLayout>
  );
}
