import { z } from 'zod';
import {
  Badge,
  CtaButton,
  DarkCard,
  Divider,
  EmailLayout,
  InfoRows,
  Label,
  LightCard,
  Panel,
  Paragraph,
  ProgressBar,
  Small,
  Spacer,
  Title,
} from '../components/index.js';
import { BaseSchema, greeting, LinkSchema } from '../props.js';
import { color, font, type } from '../theme/tokens.js';

export const CourseProgressSchema = BaseSchema.extend({
  courseTitle: z.string().default('Votre formation'),
  progressPercent: z.number().min(0).max(100).catch(0).default(0),
  nextLessonTitle: z.string().default('Prochaine leçon'),
  nextLessonDuration: z.string().default('—'),
  remainingLessons: z.number().int().nonnegative().catch(0).default(0),
  resources: z.array(z.string()).default([]),
  hasQuiz: z.boolean().default(false),
  resumeUrl: LinkSchema,
});
export type CourseProgressProps = z.input<typeof CourseProgressSchema>;

export const courseProgressSubject = (props: z.output<typeof CourseProgressSchema>) =>
  `${props.courseTitle} — reprendre à ${Math.round(props.progressPercent)} %`;

/** Academy (§26) : identité propre par l'accent bleu nuit, marque principale conservée. */
export function CourseProgressEmail(props: z.output<typeof CourseProgressSchema>) {
  return (
    <EmailLayout
      preview={`Votre formation vous attend : ${props.nextLessonTitle}.`}
      eyebrow="Academy"
      kicker={`${Math.round(props.progressPercent)} %`}
      reason="Vous recevez cet email parce que vous suivez une formation sur la plateforme."
      brand={props.brand}
    >
      <Panel>
        <div className="ws-rise">
          <Badge tone="night">Formation en cours</Badge>
          <Spacer size={14} />
          <Title>Votre formation vous attend</Title>
          <Spacer size={12} />
          <Paragraph>
            {greeting(props.firstName)} vous avez déjà parcouru une bonne partie du programme. La suite ne prend que
            quelques minutes.
          </Paragraph>
        </div>

        <Spacer size={20} />
        <div className="ws-rise-2">
          <DarkCard>
            <Label tone="gold">{props.courseTitle}</Label>
            <Spacer size={16} />
            <ProgressBar percent={props.progressPercent} label="Progression" />
            <Spacer size={18} />
            <Divider tone="gold" />
            <Spacer size={16} />
            <InfoRows
              tone="dark"
              rows={[
                { label: 'Prochaine leçon', value: props.nextLessonTitle, strong: true },
                { label: 'Durée', value: props.nextLessonDuration },
                { label: 'Leçons restantes', value: `${props.remainingLessons}` },
                ...(props.hasQuiz ? [{ label: 'Quiz', value: 'Disponible en fin de chapitre' }] : []),
              ]}
            />
          </DarkCard>
        </div>

        <Spacer size={20} />
        <CtaButton href={props.resumeUrl}>Continuer la formation</CtaButton>

        {props.resources.length > 0 && (
          <>
            <Spacer size={22} />
            <Label tone="imperial">Ressources disponibles</Label>
            <Spacer size={12} />
            <LightCard accent={color.night}>
              {props.resources.map((resource) => (
                <span
                  key={resource}
                  style={{ ...type.small, fontFamily: font.body, color: color.ink, display: 'block', padding: '3px 0' }}
                >
                  • {resource}
                </span>
              ))}
            </LightCard>
          </>
        )}

        <Spacer size={16} />
        <Small>Une formation terminée doit mener à une action réelle : un produit, un fournisseur, une commande.</Small>
      </Panel>
    </EmailLayout>
  );
}
