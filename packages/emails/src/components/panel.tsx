import type { CSSProperties, ReactNode } from 'react';
import { color, gradientStyle, layout, radius } from '../theme/tokens.js';

/** Bloc de contenu sur surface crème : la zone de lecture principale. */
export function Panel({
  children,
  style,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  padded?: boolean;
}) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td
            className={`sm-pad sm-pad-y dm-surface ${className}`}
            style={{
              backgroundColor: color.cream,
              padding: padded ? `${layout.gutter} ${layout.gutter}` : 0,
              ...style,
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Carte sombre posée dans le contenu : chiffres, suivi, éléments à forte présence. */
export function DarkCard({
  children,
  style,
  className = '',
  tone = 'night',
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  tone?: 'night' | 'charcoal';
}) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td
            className={className}
            style={{
              ...(tone === 'night' ? gradientStyle('night') : { backgroundColor: color.charcoalRaised }),
              borderRadius: radius.lg,
              padding: '22px',
              border: `1px solid ${color.lineDark}`,
              ...style,
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Carte claire bordée : fournisseurs, leçons, informations groupées. */
export function LightCard({
  children,
  style,
  className = '',
  accent,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** Filet coloré à gauche, pour signaler la catégorie sans dépendre d'une image. */
  accent?: string;
}) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td
            className={`dm-surface dm-border ${className}`}
            style={{
              backgroundColor: color.white,
              border: `1px solid ${color.line}`,
              borderLeft: accent ? `3px solid ${accent}` : `1px solid ${color.line}`,
              borderRadius: radius.md,
              padding: '16px 18px',
              ...style,
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Espace vertical mesuré, sans marges fantaisistes d'un client à l'autre. */
export function Spacer({ size = 16 }: { size?: number }) {
  return (
    <div style={{ height: `${size}px`, lineHeight: `${size}px`, fontSize: 0 }} aria-hidden="true">
      &nbsp;
    </div>
  );
}

/** Séparateur : filet fin, ou dégradé doré pour marquer un changement de section. */
export function Divider({ tone = 'line' }: { tone?: 'line' | 'gold' }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td
            height={tone === 'gold' ? 3 : 1}
            style={{
              height: tone === 'gold' ? '3px' : '1px',
              lineHeight: '1px',
              fontSize: '1px',
              borderRadius: '2px',
              ...(tone === 'gold' ? gradientStyle('gold') : { backgroundColor: color.line }),
            }}
          >
            &nbsp;
          </td>
        </tr>
      </tbody>
    </table>
  );
}
