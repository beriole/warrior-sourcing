import { z } from 'zod';
import {
  Badge,
  CtaButton,
  EmailLayout,
  InfoRows,
  Label,
  Panel,
  Paragraph,
  Small,
  Spacer,
  Title,
} from '../components/index.js';
import { BaseSchema, greeting, LinkSchema } from '../props.js';

export const AdminNoticeSchema = BaseSchema.extend({
  title: z.string().default('Information importante'),
  /** Corps du message, un paragraphe par entrée. */
  paragraphs: z.array(z.string()).default([]),
  severity: z.enum(['info', 'action', 'warning']).catch('info').default('info'),
  details: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  ctaLabel: z.string().optional(),
  ctaUrl: LinkSchema.optional(),
});
export type AdminNoticeProps = z.input<typeof AdminNoticeSchema>;

export const adminNoticeSubject = (props: z.output<typeof AdminNoticeSchema>) => props.title;

const SEVERITY = {
  info: { tone: 'night', label: 'Information' },
  action: { tone: 'gold', label: 'Action requise' },
  warning: { tone: 'imperial', label: 'À vérifier' },
} as const;

/**
 * Message administratif : conditions, compte, abonnement, incident.
 * Volontairement sobre — c'est le seul template sans effet visuel fort.
 */
export function AdminNoticeEmail(props: z.output<typeof AdminNoticeSchema>) {
  const severity = SEVERITY[props.severity];

  return (
    <EmailLayout
      preview={props.paragraphs[0] ?? props.title}
      eyebrow="Message administratif"
      reason="Vous recevez cet email parce qu'il concerne votre compte ou votre utilisation de la plateforme."
      brand={props.brand}
    >
      <Panel>
        <Badge tone={severity.tone}>{severity.label}</Badge>
        <Spacer size={14} />
        <Title>{props.title}</Title>
        <Spacer size={14} />
        <Paragraph>{greeting(props.firstName)}</Paragraph>

        {props.paragraphs.map((paragraph, index) => (
          <div key={index}>
            <Spacer size={10} />
            <Paragraph>{paragraph}</Paragraph>
          </div>
        ))}

        {props.details.length > 0 && (
          <>
            <Spacer size={20} />
            <Label tone="imperial">Détails</Label>
            <Spacer size={12} />
            <InfoRows rows={props.details} />
          </>
        )}

        {props.ctaLabel && props.ctaUrl && (
          <>
            <Spacer size={22} />
            <CtaButton href={props.ctaUrl}>{props.ctaLabel}</CtaButton>
          </>
        )}

        <Spacer size={18} />
        <Small>Si ce message vous semble inattendu, répondez-y : nous vérifierons avec vous.</Small>
      </Panel>
    </EmailLayout>
  );
}
