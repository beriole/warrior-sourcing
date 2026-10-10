import { color, font, gradientStyle, radius, type } from '../theme/tokens.js';

/**
 * Barre de progression en deux cellules de tableau : la largeur porte l'information,
 * et le pourcentage est écrit à côté pour les clients qui aplatissent les couleurs.
 */
export function ProgressBar({
  percent,
  label,
  tone = 'gold',
}: {
  percent: number;
  label?: string;
  tone?: 'gold' | 'imperial';
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const rest = 100 - value;

  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        {label && (
          <tr>
            <td style={{ paddingBottom: '8px' }}>
              <span style={{ ...type.small, fontFamily: font.body, color: color.onDarkMuted }}>{label}</span>
              <span
                className="figures"
                style={{ ...type.small, fontFamily: font.figures, fontWeight: 700, color: color.goldBright, float: 'right' }}
              >
                {value} %
              </span>
            </td>
          </tr>
        )}
        <tr>
          <td>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%', borderRadius: radius.pill }}>
              <tbody>
                <tr>
                  {value > 0 && (
                    <td
                      width={`${value}%`}
                      height="10"
                      style={{
                        width: `${value}%`,
                        height: '10px',
                        fontSize: '1px',
                        lineHeight: '10px',
                        borderRadius: radius.pill,
                        ...(tone === 'gold' ? gradientStyle('gold') : gradientStyle('route')),
                      }}
                    >
                      &nbsp;
                    </td>
                  )}
                  {rest > 0 && (
                    <td
                      width={`${rest}%`}
                      height="10"
                      style={{
                        width: `${rest}%`,
                        height: '10px',
                        fontSize: '1px',
                        lineHeight: '10px',
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: radius.pill,
                      }}
                    >
                      &nbsp;
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
