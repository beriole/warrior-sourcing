import { formatMoney, type Money } from '@ws/contracts';
import { color, font, type } from '../theme/tokens.js';
import { Badge } from './badge.js';

/**
 * Bloc financier : l'information dominante de l'email.
 * Chiffres tabulaires, graisse maximale, or sur fond sombre. Une estimation est toujours marquée.
 */
export function AmountBlock({
  label,
  value,
  note,
  estimate = false,
  tone = 'dark',
}: {
  label: string;
  value: Money;
  note?: string;
  estimate?: boolean;
  tone?: 'dark' | 'light';
}) {
  const onDark = tone === 'dark';

  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td>
            <span style={{ ...type.label, fontFamily: font.body, color: onDark ? color.onDarkMuted : color.inkMuted, textTransform: 'uppercase' }}>
              {label}
            </span>
          </td>
          {estimate && (
            <td align="right">
              <Badge tone="estimate">Estimation</Badge>
            </td>
          )}
        </tr>
        <tr>
          <td colSpan={estimate ? 2 : 1} style={{ paddingTop: '6px' }}>
            <span
              className="figures sm-amount"
              style={{
                ...type.amount,
                fontFamily: font.figures,
                color: onDark ? color.goldBright : color.ink,
                display: 'inline-block',
              }}
            >
              {formatMoney(value)}
            </span>
          </td>
        </tr>
        {note && (
          <tr>
            <td colSpan={estimate ? 2 : 1} style={{ paddingTop: '6px' }}>
              <span style={{ ...type.small, fontFamily: font.body, color: onDark ? color.onDarkMuted : color.inkMuted }}>{note}</span>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Chiffre secondaire, dans une grille de deux ou trois colonnes. */
export function Figure({ label, value, tone = 'dark' }: { label: string; value: string; tone?: 'dark' | 'light' }) {
  const onDark = tone === 'dark';
  return (
    <>
      <span style={{ ...type.micro, fontFamily: font.body, color: onDark ? color.onDarkMuted : color.inkMuted, display: 'block' }}>
        {label}
      </span>
      <span
        className="figures"
        style={{ ...type.amountSmall, fontFamily: font.figures, color: onDark ? color.onDark : color.ink, display: 'block', paddingTop: '2px' }}
      >
        {value}
      </span>
    </>
  );
}
