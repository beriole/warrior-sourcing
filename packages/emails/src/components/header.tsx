import { color, font, gradientStyle, layout, type } from '../theme/tokens.js';
import { RouteStrip } from './route-strip.js';

/**
 * Bandeau d'en-tête : dégradé bordeaux → rouge impérial, filet doré, marque et trajet.
 * Le motif diagonal et le caractère 进口 sont décoratifs : leur disparition ne coûte aucune information.
 */
export function Header({
  eyebrow,
  kicker,
  brand = 'WARRIOR SOURCING',
}: {
  /** Nature du message, par exemple « Confirmation de paiement ». */
  eyebrow?: string;
  /** Ligne courte à droite, par exemple un numéro de commande. */
  kicker?: string;
  brand?: string;
}) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td
            className="sm-pad"
            style={{
              ...gradientStyle('header'),
              padding: `22px ${layout.gutter} 18px`,
              position: 'relative',
            }}
          >
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span
                      style={{
                        fontFamily: font.display,
                        fontSize: '17px',
                        fontWeight: 800,
                        letterSpacing: '2.2px',
                        color: color.white,
                        textTransform: 'uppercase',
                      }}
                    >
                      {brand.split(' ')[0]}
                    </span>
                    <span
                      style={{
                        fontFamily: font.display,
                        fontSize: '17px',
                        fontWeight: 800,
                        letterSpacing: '2.2px',
                        color: color.goldBright,
                        textTransform: 'uppercase',
                      }}
                    >
                      {' '}
                      {brand.split(' ').slice(1).join(' ')}
                    </span>
                  </td>
                  <td align="right" style={{ verticalAlign: 'middle' }}>
                    <span
                      className="sm-hide ws-glow"
                      aria-hidden="true"
                      style={{ fontFamily: font.display, fontSize: '15px', color: 'rgba(255,255,255,0.35)', letterSpacing: '3px' }}
                    >
                      进口
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ height: '14px', lineHeight: '14px', fontSize: 0 }}>&nbsp;</div>
            <RouteStrip tone="dark" />

            {(eyebrow ?? kicker) && (
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginTop: '14px' }}>
                <tbody>
                  <tr>
                    <td>
                      {eyebrow && (
                        <span
                          style={{
                            ...type.label,
                            fontFamily: font.body,
                            color: color.goldSoft,
                            textTransform: 'uppercase',
                          }}
                        >
                          {eyebrow}
                        </span>
                      )}
                    </td>
                    <td align="right">
                      {kicker && (
                        <span className="figures" style={{ ...type.label, fontFamily: font.body, color: 'rgba(255,255,255,0.72)' }}>
                          {kicker}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </td>
        </tr>
        {/* Filet doré : la signature premium sous le bandeau. */}
        <tr>
          <td height="4" style={{ height: '4px', lineHeight: '4px', fontSize: '1px', backgroundColor: color.gold }} className="ws-sweep">
            &nbsp;
          </td>
        </tr>
      </tbody>
    </table>
  );
}
