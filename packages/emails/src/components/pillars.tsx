import { color, font, radius, type } from '../theme/tokens.js';

const PILLARS = [
  { title: 'APPRENDRE', text: 'Formations et guides', glyph: '📚' },
  { title: 'SOURCER', text: 'Fournisseurs contrôlés', glyph: '🏭' },
  { title: 'IMPORTER', text: 'Paiement et suivi', glyph: '🚢' },
  { title: 'VENDRE', text: 'Marge et capital', glyph: '📈' },
] as const;

/**
 * Les quatre piliers du produit (§3), en grille 2 × 2 sur desktop,
 * empilée sur mobile grâce à `sm-stack`.
 */
export function PillarGrid() {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        {[0, 2].map((offset) => (
          <tr key={offset}>
            {PILLARS.slice(offset, offset + 2).map((pillar, index) => (
              <td
                key={pillar.title}
                className="sm-stack sm-stack-gap"
                width="50%"
                style={{
                  width: '50%',
                  verticalAlign: 'top',
                  paddingRight: index === 0 ? '6px' : 0,
                  paddingLeft: index === 1 ? '6px' : 0,
                  paddingBottom: '12px',
                }}
              >
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td
                        className="dm-surface dm-border"
                        style={{
                          backgroundColor: color.white,
                          border: `1px solid ${color.line}`,
                          borderTop: `3px solid ${offset === 0 ? color.imperial : color.gold}`,
                          borderRadius: radius.md,
                          padding: '14px 16px',
                        }}
                      >
                        <span style={{ fontSize: '18px', lineHeight: '22px' }} aria-hidden="true">
                          {pillar.glyph}
                        </span>
                        <span
                          className="dm-text"
                          style={{
                            ...type.label,
                            fontFamily: font.display,
                            color: color.ink,
                            display: 'block',
                            paddingTop: '6px',
                            letterSpacing: '1.6px',
                          }}
                        >
                          {pillar.title}
                        </span>
                        <span
                          className="dm-muted"
                          style={{ ...type.micro, fontFamily: font.body, color: color.inkMuted, display: 'block', paddingTop: '3px' }}
                        >
                          {pillar.text}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
