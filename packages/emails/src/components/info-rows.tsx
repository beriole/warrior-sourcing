import { color, font, type } from '../theme/tokens.js';

export type InfoRow = { label: string; value: string; strong?: boolean };

/**
 * Tableau d'informations clé / valeur. Sur mobile, les colonnes s'empilent :
 * aucune valeur n'est jamais tronquée (§14).
 */
export function InfoRows({ rows, tone = 'light' }: { rows: InfoRow[]; tone?: 'light' | 'dark' }) {
  const onDark = tone === 'dark';

  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.label}>
            <td
              className="sm-stack"
              style={{
                padding: index === 0 ? '0 0 9px' : '9px 0',
                borderTop: index === 0 ? 'none' : `1px solid ${onDark ? color.lineDark : color.line}`,
                verticalAlign: 'top',
              }}
            >
              <span style={{ ...type.small, fontFamily: font.body, color: onDark ? color.onDarkMuted : color.inkMuted }}>{row.label}</span>
            </td>
            <td
              className="sm-stack sm-left"
              align="right"
              style={{
                padding: index === 0 ? '0 0 9px' : '9px 0',
                borderTop: index === 0 ? 'none' : `1px solid ${onDark ? color.lineDark : color.line}`,
                verticalAlign: 'top',
              }}
            >
              <span
                className="figures"
                style={{
                  ...type.small,
                  fontFamily: font.body,
                  fontWeight: row.strong ? 700 : 500,
                  color: onDark ? color.onDark : color.ink,
                }}
              >
                {row.value}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
