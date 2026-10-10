import { SHIPMENT_STAGE_LABELS, SHIPMENT_STAGES, ShipmentStageSchema, type ShipmentStage } from '@ws/contracts';
import { z } from 'zod';
import {
  Badge,
  CtaButton,
  DarkCard,
  Divider,
  EmailLayout,
  InfoRows,
  Label,
  Panel,
  Paragraph,
  RouteStrip,
  Skyline,
  Small,
  Spacer,
  Timeline,
  Title,
  type TimelineStep,
} from '../components/index.js';
import { BaseSchema, DateSchema, formatDate, greeting, LinkSchema } from '../props.js';
import { color, font, type } from '../theme/tokens.js';

export const ShipmentUpdateSchema = BaseSchema.extend({
  orderReference: z.string().default('—'),
  stage: ShipmentStageSchema.catch('IN_TRANSIT').default('IN_TRANSIT'),
  /** Description de l'événement réel, telle qu'enregistrée par l'agent. */
  eventDescription: z.string().default('Votre commande a changé d’étape.'),
  eventAt: DateSchema,
  trackingCode: z.string().default('—'),
  currentLocation: z.string().default('Guangzhou'),
  destination: z.string().default('Douala'),
  trackingUrl: LinkSchema,
});
export type ShipmentUpdateProps = z.input<typeof ShipmentUpdateSchema>;

export const shipmentUpdateSubject = (props: z.output<typeof ShipmentUpdateSchema>) =>
  `${SHIPMENT_STAGE_LABELS[props.stage]} · Commande ${props.orderReference}`;

/**
 * Suivi logistique (§25). La timeline est construite à partir des étapes réelles du cahier,
 * resserrée autour de l'étape en cours pour rester lisible sur un téléphone.
 */
function buildSteps(stage: ShipmentStage): TimelineStep[] {
  const index = SHIPMENT_STAGES.indexOf(stage);
  const start = Math.max(0, Math.min(index - 1, SHIPMENT_STAGES.length - 5));
  const window = SHIPMENT_STAGES.slice(start, start + 5);

  return window.map((item) => {
    const position = SHIPMENT_STAGES.indexOf(item);
    return {
      label: SHIPMENT_STAGE_LABELS[item],
      state: position < index ? 'done' : position === index ? 'current' : 'upcoming',
    };
  });
}

export function ShipmentUpdateEmail(props: z.output<typeof ShipmentUpdateSchema>) {
  const index = SHIPMENT_STAGES.indexOf(props.stage);
  const nextStage = SHIPMENT_STAGES[index + 1];

  return (
    <EmailLayout
      preview={`${SHIPMENT_STAGE_LABELS[props.stage]} — ${props.eventDescription}`}
      eyebrow="Suivi logistique"
      kicker={props.orderReference}
      reason="Vous recevez cet email parce que le statut d'une de vos commandes a changé."
      brand={props.brand}
    >
      <Panel>
        <div className="ws-rise">
          <Badge tone="night">{`Étape ${index + 1} sur ${SHIPMENT_STAGES.length}`}</Badge>
          <Spacer size={14} />
          <Title>{SHIPMENT_STAGE_LABELS[props.stage]}</Title>
          <Spacer size={12} />
          <Paragraph>{greeting(props.firstName)}</Paragraph>
          <Spacer size={6} />
          <Paragraph>{props.eventDescription}</Paragraph>
        </div>

        <Spacer size={20} />
        <div className="ws-rise-2">
          <DarkCard>
            <RouteStrip from={`🇨🇳 ${props.currentLocation.toUpperCase()}`} to={`🇨🇲 ${props.destination.toUpperCase()}`} glyph="✈️" />
            <Spacer size={16} />
            <Skyline height={34} />
            <Spacer size={18} />

            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td className="sm-stack sm-stack-gap" width="50%" style={{ width: '50%', verticalAlign: 'top', paddingRight: '10px' }}>
                    <Label tone="gold">Étape actuelle</Label>
                    <Spacer size={6} />
                    <span style={{ ...type.titleSmall, fontFamily: font.display, color: color.onDark, display: 'block' }}>
                      {SHIPMENT_STAGE_LABELS[props.stage]}
                    </span>
                  </td>
                  <td className="sm-stack" width="50%" style={{ width: '50%', verticalAlign: 'top' }}>
                    <Label tone="muted">Prochaine étape</Label>
                    <Spacer size={6} />
                    <span style={{ ...type.titleSmall, fontFamily: font.display, color: color.onDarkMuted, display: 'block' }}>
                      {nextStage ? SHIPMENT_STAGE_LABELS[nextStage] : 'Commande terminée'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <Spacer size={18} />
            <Divider tone="gold" />
            <Spacer size={16} />
            <InfoRows
              tone="dark"
              rows={[
                { label: 'Dernier événement', value: formatDate(props.eventAt, true), strong: true },
                { label: 'Numéro de suivi', value: props.trackingCode },
                { label: 'Commande', value: props.orderReference },
              ]}
            />
          </DarkCard>
        </div>

        <Spacer size={22} />
        <Label tone="imperial">Parcours de votre marchandise</Label>
        <Spacer size={14} />
        <Timeline tone="light" steps={buildSteps(props.stage)} />

        <Spacer size={20} />
        <CtaButton href={props.trackingUrl}>Voir le suivi détaillé</CtaButton>
        <Spacer size={12} />
        <Small>
          Les étapes affichées correspondent à des événements réellement enregistrés par nos équipes, pas à une
          position GPS.
        </Small>
      </Panel>
    </EmailLayout>
  );
}
