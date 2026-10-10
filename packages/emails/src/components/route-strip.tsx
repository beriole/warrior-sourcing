import { color, font, type } from '../theme/tokens.js';

/**
 * Trajet Chine → Cameroun en tableau : la ligne lumineuse est un fond dégradé,
 * les villes restent lisibles même sans CSS avancé. Aucune image, donc rien à bloquer.
 */
export function RouteStrip({
  from = 'GUANGZHOU',
  to = 'DOUALA',
  tone = 'dark',
  glyph = '📦',
}: {
  from?: string;
  to?: string;
  tone?: 'dark' | 'light';
  glyph?: string;
}) {
  const label = tone === 'dark' ? color.onDark : color.ink;
  const muted = tone === 'dark' ? color.onDarkMuted : color.inkMuted;

  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td style={{ whiteSpace: 'nowrap', paddingRight: '10px' }}>
            <span style={{ ...type.label, fontFamily: font.body, color: label, letterSpacing: '1.2px' }}>{from}</span>
          </td>
          <td width="100%" style={{ verticalAlign: 'middle' }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td
                    className="ws-sweep"
                    height="3"
                    width="58%"
                    style={{
                      width: '58%',
                      height: '3px',
                      lineHeight: '3px',
                      fontSize: '1px',
                      backgroundColor: color.gold,
                      borderRadius: '2px',
                    }}
                  >
                    &nbsp;
                  </td>
                  <td style={{ padding: '0 6px', fontSize: '13px', lineHeight: '13px' }}>{glyph}</td>
                  <td
                    height="3"
                    width="42%"
                    style={{
                      width: '42%',
                      height: '3px',
                      lineHeight: '3px',
                      fontSize: '1px',
                      backgroundColor: tone === 'dark' ? color.lineDark : color.line,
                      borderRadius: '2px',
                    }}
                  >
                    &nbsp;
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
          <td style={{ whiteSpace: 'nowrap', paddingLeft: '10px' }}>
            <span style={{ ...type.label, fontFamily: font.body, color: muted, letterSpacing: '1.2px' }}>{to}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
