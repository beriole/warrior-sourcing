import { SUPPLIER_VERIFICATION_LABELS, type SupplierVerificationLevel } from '@ws/contracts';
import { color, font, radius } from '../theme/tokens.js';

type Tone = 'gold' | 'imperial' | 'success' | 'night' | 'neutral' | 'estimate';

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  gold: { bg: '#FBF1DA', fg: color.goldInk, border: '#EBD9A8' },
  imperial: { bg: '#FBE7EA', fg: '#9E0C24', border: '#F3CBD2' },
  success: { bg: color.successSoft, fg: color.success, border: '#C6E5D4' },
  night: { bg: '#E6EBF5', fg: color.night, border: '#CFD9EC' },
  neutral: { bg: '#F1EDE4', fg: color.inkMuted, border: color.line },
  estimate: { bg: '#FBF1DA', fg: color.goldInk, border: '#EBD9A8' },
};

/** Badge court. Le texte porte l'information : la couleur seule ne dit jamais rien (§46). */
export function Badge({ children, tone = 'neutral' }: { children: string; tone?: Tone }) {
  const palette = TONES[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.sm,
        color: palette.fg,
        fontFamily: font.body,
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.4px',
        padding: '4px 9px',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

/** Badge fournisseur : reprend les quatre niveaux du cahier (§16), jamais un « vérifié » vague. */
export function VerificationBadge({ level }: { level: SupplierVerificationLevel }) {
  return (
    <Badge tone={level === 'PARTNER' ? 'gold' : 'success'}>{SUPPLIER_VERIFICATION_LABELS[level].label}</Badge>
  );
}
