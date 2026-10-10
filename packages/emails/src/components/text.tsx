import type { CSSProperties, ReactNode } from 'react';
import { color, font, type } from '../theme/tokens.js';

type TextProps = { children: ReactNode; style?: CSSProperties; className?: string; align?: 'left' | 'center' };

const base = { margin: 0, padding: 0 } as const;

/** Petit label en capitales : annonce la nature du message avant même le titre. */
export function Label({ children, style, className, tone = 'gold' }: TextProps & { tone?: 'gold' | 'imperial' | 'muted' }) {
  const tones = { gold: color.gold, imperial: color.imperial, muted: color.onDarkMuted };
  return (
    <p
      className={className}
      style={{ ...base, ...type.label, fontFamily: font.body, textTransform: 'uppercase', color: tones[tone], ...style }}
    >
      {children}
    </p>
  );
}

export function Title({ children, style, className = '', align = 'left' }: TextProps) {
  return (
    <h1
      className={`sm-title ${className}`}
      style={{ ...base, ...type.title, fontFamily: font.display, color: color.ink, textAlign: align, ...style }}
    >
      {children}
    </h1>
  );
}

export function Subtitle({ children, style, className, align = 'left' }: TextProps) {
  return (
    <p className={className} style={{ ...base, ...type.subtitle, fontFamily: font.body, color: color.inkMuted, textAlign: align, ...style }}>
      {children}
    </p>
  );
}

export function Heading({ children, style, className }: TextProps) {
  return (
    <h2 className={className} style={{ ...base, ...type.titleSmall, fontFamily: font.display, color: color.ink, ...style }}>
      {children}
    </h2>
  );
}

export function Paragraph({ children, style, className, align = 'left' }: TextProps) {
  return (
    <p className={className} style={{ ...base, ...type.body, fontFamily: font.body, color: color.ink, textAlign: align, ...style }}>
      {children}
    </p>
  );
}

export function Small({ children, style, className, align = 'left' }: TextProps) {
  return (
    <p className={className} style={{ ...base, ...type.small, fontFamily: font.body, color: color.inkMuted, textAlign: align, ...style }}>
      {children}
    </p>
  );
}

export function Micro({ children, style, className, align = 'left' }: TextProps) {
  return (
    <p className={className} style={{ ...base, ...type.micro, fontFamily: font.body, color: color.onDarkMuted, textAlign: align, ...style }}>
      {children}
    </p>
  );
}
