import { z } from 'zod';
import {
  AmountBlock,
  Badge,
  CtaButton,
  DarkCard,
  EmailLayout,
  InfoRows,
  Label,
  LightCard,
  Panel,
  Paragraph,
  Small,
  Spacer,
  Subtitle,
  Title,
} from '../components/index.js';
import { BaseSchema, DateSchema, formatDate, greeting, LinkSchema, MoneyPropSchema } from '../props.js';
import { color, font, type } from '../theme/tokens.js';

const OrderLineSchema = z.object({
  label: z.string().default('Article'),
  quantity: z.number().int().positive().catch(1).default(1),
  unitPrice: MoneyPropSchema,
});

export const OrderConfirmedSchema = BaseSchema.extend({
  orderReference: z.string().default('—'),
  createdAt: DateSchema,
  lines: z.array(OrderLineSchema).default([]),
  total: MoneyPropSchema,
  /** Ville de réception choisie au checkout. */
  city: z.string().default('—'),
  deliveryMode: z.string().default('Retrait en entrepôt'),
  estimatedArrival: z.string().default('Communiquée après confirmation du fournisseur'),
  orderUrl: LinkSchema,
});
export type OrderConfirmedProps = z.input<typeof OrderConfirmedSchema>;

export const orderConfirmedSubject = (props: z.output<typeof OrderConfirmedSchema>) =>
  `Commande ${props.orderReference} confirmée`;

/** Confirmation de commande : récapitulatif complet et étape suivante explicite. */
export function OrderConfirmedEmail(props: z.output<typeof OrderConfirmedSchema>) {
  return (
    <EmailLayout
      preview={`Commande ${props.orderReference} enregistrée. Voici le détail et la suite.`}
      eyebrow="Commande confirmée"
      kicker={props.orderReference}
      reason="Vous recevez cet email parce qu'une commande a été enregistrée sur votre compte."
      brand={props.brand}
    >
      <Panel>
        <div className="ws-rise">
          <Badge tone="success">Commande enregistrée ✓</Badge>
          <Spacer size={14} />
          <Title>Votre commande est confirmée</Title>
          <Spacer size={12} />
          <Paragraph>{greeting(props.firstName)}</Paragraph>
          <Spacer size={6} />
          <Subtitle>
            Votre commande du {formatDate(props.createdAt)} est enregistrée. Nous passons maintenant à la
            confirmation auprès du fournisseur, puis à la production.
          </Subtitle>
        </div>

        <Spacer size={22} />
        <Label tone="imperial">Détail de la commande</Label>
        <Spacer size={12} />

        {props.lines.length > 0 ? (
          props.lines.map((line, index) => (
            <div key={`${line.label}-${index}`} style={{ paddingBottom: '10px' }}>
              <LightCard>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td className="sm-stack">
                        <span style={{ ...type.small, fontFamily: font.body, fontWeight: 700, color: color.ink, display: 'block' }}>
                          {line.label}
                        </span>
                        <span className="figures" style={{ ...type.micro, fontFamily: font.body, color: color.inkMuted }}>
                          Quantité : {line.quantity}
                        </span>
                      </td>
                      <td className="sm-stack" align="right">
                        <AmountBlock
                          tone="light"
                          label="Prix unitaire"
                          value={line.unitPrice}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </LightCard>
            </div>
          ))
        ) : (
          <LightCard>
            <Small>Le détail des articles sera visible dans votre espace.</Small>
          </LightCard>
        )}

        <Spacer size={14} />
        <DarkCard>
          <AmountBlock label="Total réglé" value={props.total} />
          <Spacer size={16} />
          <InfoRows
            tone="dark"
            rows={[
              { label: 'Ville de réception', value: props.city },
              { label: 'Mode de réception', value: props.deliveryMode },
              { label: 'Arrivée estimée', value: props.estimatedArrival },
            ]}
          />
        </DarkCard>

        <Spacer size={20} />
        <CtaButton href={props.orderUrl}>Voir ma commande</CtaButton>
        <Spacer size={12} />
        <Small>Les délais annoncés sont des estimations : ils dépendent du fournisseur et du transport.</Small>
      </Panel>
    </EmailLayout>
  );
}
