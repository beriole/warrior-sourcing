import { z } from 'zod';
import {
  Badge,
  CtaButton,
  DarkCard,
  EmailLayout,
  InfoRows,
  Label,
  Panel,
  Paragraph,
  Small,
  Spacer,
  SupplierCard,
  Title,
} from '../components/index.js';
import { BaseSchema, DateSchema, formatDate, greeting, LinkSchema, SupplierProposalSchema } from '../props.js';
import { color, font, type } from '../theme/tokens.js';

export const SourcingResultSchema = BaseSchema.extend({
  requestReference: z.string().default('—'),
  productLabel: z.string().default('votre produit'),
  targetQuantity: z.string().default('—'),
  requestedAt: DateSchema,
  suppliers: z.array(SupplierProposalSchema).default([]),
  proposalsUrl: LinkSchema,
});
export type SourcingResultProps = z.input<typeof SourcingResultSchema>;

export const sourcingResultSubject = (props: z.output<typeof SourcingResultSchema>) => {
  const count = props.suppliers.length;
  return count > 0
    ? `${count} fournisseur${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''} pour ${props.productLabel}`
    : `Votre demande de sourcing avance · ${props.productLabel}`;
};

/** Résultat d'une demande « Trouvez ce produit pour moi » (§18, §19). */
export function SourcingResultEmail(props: z.output<typeof SourcingResultSchema>) {
  const count = props.suppliers.length;

  return (
    <EmailLayout
      preview={`${count} fournisseur${count > 1 ? 's' : ''} identifié${count > 1 ? 's' : ''} pour ${props.productLabel}.`}
      eyebrow="Sourcing"
      kicker={props.requestReference}
      reason="Vous recevez cet email parce que vous avez déposé une demande de sourcing."
      brand={props.brand}
    >
      <Panel>
        <div className="ws-rise">
          <Badge tone="imperial">{count > 0 ? `${count} proposition${count > 1 ? 's' : ''}` : 'Recherche en cours'}</Badge>
          <Spacer size={14} />
          <Title>
            {count > 0 ? (
              <>
                Nous avons trouvé des
                <br />
                <span style={{ color: color.imperial }}>fournisseurs pour vous</span>
              </>
            ) : (
              'Votre demande avance'
            )}
          </Title>
          <Spacer size={12} />
          <Paragraph>
            {greeting(props.firstName)} voici où en est votre demande déposée le {formatDate(props.requestedAt)}.
          </Paragraph>
        </div>

        <Spacer size={18} />
        <DarkCard>
          <Label tone="gold">Votre demande</Label>
          <Spacer size={8} />
          <span style={{ ...type.titleSmall, fontFamily: font.display, color: color.onDark, display: 'block' }}>
            {props.productLabel}
          </span>
          <Spacer size={14} />
          <InfoRows
            tone="dark"
            rows={[
              { label: 'Quantité visée', value: props.targetQuantity },
              { label: 'Référence', value: props.requestReference },
              { label: 'Fournisseurs identifiés', value: `${count}`, strong: true },
            ]}
          />
        </DarkCard>

        <Spacer size={22} />
        {count > 0 ? (
          <>
            <Label tone="imperial">Propositions comparables</Label>
            <Spacer size={12} />
            {props.suppliers.map((supplier, index) => (
              <div key={`${supplier.name}-${index}`} className={index === 0 ? 'ws-rise-2' : 'ws-rise-3'} style={{ paddingBottom: '10px' }}>
                <SupplierCard supplier={supplier} />
              </div>
            ))}
            <Spacer size={10} />
            <CtaButton href={props.proposalsUrl}>Voir les propositions</CtaButton>
            <Spacer size={12} />
            <Small>
              Les prix indiqués sont ceux annoncés par les fournisseurs avant négociation, échantillon et
              inspection. Le niveau de vérification précise ce qui a réellement été contrôlé.
            </Small>
          </>
        ) : (
          <>
            <Paragraph>
              Notre équipe compare encore plusieurs usines. Vous recevrez les propositions dès qu'elles seront
              vérifiées.
            </Paragraph>
            <Spacer size={16} />
            <CtaButton href={props.proposalsUrl}>Suivre ma demande</CtaButton>
          </>
        )}
      </Panel>
    </EmailLayout>
  );
}
