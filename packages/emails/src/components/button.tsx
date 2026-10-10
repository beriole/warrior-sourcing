import { color, font, gradientStyle, radius } from '../theme/tokens.js';

type Variant = 'primary' | 'gold' | 'outline';

const VARIANTS: Record<Variant, { background: string; backgroundImage?: string; color: string; border: string }> = {
  primary: { background: color.imperial, backgroundImage: gradientStyle('header').backgroundImage, color: color.white, border: color.imperialDeep },
  gold: { background: color.gold, backgroundImage: gradientStyle('gold').backgroundImage, color: color.charcoal, border: color.goldInk },
  outline: { background: 'transparent', color: color.onDark, border: 'rgba(255,255,255,0.35)' },
};

/**
 * CTA en tableau plutôt qu'en balise <button> : c'est la seule forme cliquable
 * partout, y compris dans Outlook. Le verbe est explicite (§45), jamais « Cliquez ici ».
 */
export function CtaButton({
  href,
  children,
  variant = 'primary',
  block = false,
}: {
  href: string;
  children: string;
  variant?: Variant;
  block?: boolean;
}) {
  const style = VARIANTS[variant];

  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: block ? '100%' : 'auto' }}>
      <tbody>
        <tr>
          <td
            align="center"
            style={{
              backgroundColor: style.background,
              backgroundImage: style.backgroundImage,
              border: `1px solid ${style.border}`,
              borderRadius: radius.pill,
            }}
          >
            <a
              className="sm-btn"
              href={href}
              style={{
                display: 'inline-block',
                padding: '14px 30px',
                fontFamily: font.body,
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                color: style.color,
                textDecoration: 'none',
                borderRadius: radius.pill,
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Lien secondaire sous un CTA : même action, poids visuel moindre. */
export function TextLink({ href, children, tone = 'dark' }: { href: string; children: string; tone?: 'dark' | 'light' }) {
  return (
    <a
      href={href}
      style={{
        fontFamily: font.body,
        fontSize: '13px',
        fontWeight: 600,
        color: tone === 'dark' ? color.imperial : color.goldBright,
        textDecoration: 'underline',
      }}
    >
      {children}
    </a>
  );
}
