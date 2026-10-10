import { color, font, type } from '../theme/tokens.js';

export type TimelineStep = {
  label: string;
  /** Date ou précision affichée à droite. */
  meta?: string;
  state: 'done' | 'current' | 'upcoming';
};

const MARKS = {
  done: { glyph: '✓', bg: color.success, fg: color.white, border: color.success },
  current: { glyph: '●', bg: color.imperial, fg: color.white, border: color.imperial },
  upcoming: { glyph: '○', bg: 'transparent', fg: color.onDarkMuted, border: color.lineDark },
} as const;

/**
 * Suivi vertical. L'état est porté par un symbole ET par le texte : un email affiché
 * sans couleurs reste compréhensible. L'étape en cours est la seule animée.
 */
export function Timeline({ steps, tone = 'dark' }: { steps: TimelineStep[]; tone?: 'dark' | 'light' }) {
  const onDark = tone === 'dark';
  const lineColor = onDark ? color.lineDark : color.line;

  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        {steps.map((step, index) => {
          const mark = MARKS[step.state];
          const isLast = index === steps.length - 1;

          return (
            <tr key={`${step.label}-${index}`}>
              <td width="34" style={{ width: '34px', verticalAlign: 'top', paddingBottom: isLast ? 0 : '4px' }}>
                <table role="presentation" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      {/* La pastille est un span : les coins arrondis sur une cellule sont ignorés par plusieurs clients. */}
                      <td align="center" width="22" style={{ width: '22px' }}>
                        <span
                          className={step.state === 'current' ? 'ws-pulse' : undefined}
                          style={{
                            display: 'inline-block',
                            width: '22px',
                            height: '22px',
                            backgroundColor: mark.bg,
                            border: `1px solid ${mark.border}`,
                            borderRadius: '11px',
                            color: mark.fg,
                            fontFamily: font.body,
                            fontSize: '11px',
                            lineHeight: '20px',
                            textAlign: 'center',
                          }}
                        >
                          {mark.glyph}
                        </span>
                      </td>
                    </tr>
                    {!isLast && (
                      <tr>
                        <td align="center" style={{ padding: '2px 0' }}>
                          <table role="presentation" cellPadding={0} cellSpacing={0}>
                            <tbody>
                              <tr>
                                <td
                                  width="2"
                                  height="16"
                                  style={{
                                    width: '2px',
                                    height: '16px',
                                    fontSize: '1px',
                                    lineHeight: '2px',
                                    backgroundColor: step.state === 'done' ? color.success : lineColor,
                                  }}
                                >
                                  &nbsp;
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
              <td style={{ verticalAlign: 'top', paddingTop: '1px' }}>
                <span
                  style={{
                    fontFamily: font.body,
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontWeight: step.state === 'current' ? 700 : 500,
                    color: step.state === 'upcoming' ? (onDark ? color.onDarkMuted : color.inkMuted) : onDark ? color.onDark : color.ink,
                  }}
                >
                  {step.label}
                </span>
                {step.state === 'current' && (
                  <span
                    style={{
                      ...type.micro,
                      fontFamily: font.body,
                      color: color.goldBright,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      paddingLeft: '8px',
                    }}
                  >
                    Étape actuelle
                  </span>
                )}
              </td>
              <td align="right" style={{ verticalAlign: 'top', paddingTop: '2px', whiteSpace: 'nowrap' }}>
                {step.meta && (
                  <span className="figures" style={{ ...type.micro, fontFamily: font.body, color: onDark ? color.onDarkMuted : color.inkMuted }}>
                    {step.meta}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
