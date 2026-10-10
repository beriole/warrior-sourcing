import type { SupplierVerificationLevel } from '@ws/contracts';
import { color, font, type } from '../theme/tokens.js';
import { VerificationBadge } from './badge.js';
import { TextLink } from './button.js';
import { LightCard } from './panel.js';

export type SupplierProposal = {
  name: string;
  city: string;
  level: SupplierVerificationLevel;
  moq: string;
  price: string;
  leadTime: string;
  href: string;
};

/** Carte fournisseur d'une proposition de sourcing (§15, §19). */
export function SupplierCard({ supplier }: { supplier: SupplierProposal }) {
  return (
    <LightCard accent={color.imperial}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            <td className="sm-stack">
              <span style={{ ...type.titleSmall, fontSize: '16px', fontFamily: font.display, color: color.ink, display: 'block' }}>
                {supplier.name}
              </span>
              <span style={{ ...type.micro, fontFamily: font.body, color: color.inkMuted, display: 'block', paddingTop: '2px' }}>
                {supplier.city}
              </span>
            </td>
            <td className="sm-stack sm-stack-gap" align="right" style={{ paddingTop: '2px' }}>
              <VerificationBadge level={supplier.level} />
            </td>
          </tr>
        </tbody>
      </table>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginTop: '12px' }}>
        <tbody>
          <tr>
            {[
              { label: 'Prix indicatif', value: supplier.price },
              { label: 'MOQ', value: supplier.moq },
              { label: 'Délai', value: supplier.leadTime },
            ].map((cell) => (
              <td key={cell.label} className="sm-stack sm-stack-gap" style={{ verticalAlign: 'top', paddingRight: '10px' }}>
                <span style={{ ...type.micro, fontFamily: font.body, color: color.inkMuted, display: 'block' }}>{cell.label}</span>
                <span
                  className="figures"
                  style={{ ...type.small, fontFamily: font.figures, fontWeight: 700, color: color.ink, display: 'block' }}
                >
                  {cell.value}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div style={{ paddingTop: '12px' }}>
        <TextLink href={supplier.href}>Voir la proposition</TextLink>
      </div>
    </LightCard>
  );
}
