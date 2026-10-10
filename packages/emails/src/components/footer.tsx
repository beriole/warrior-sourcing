import { color, font, layout, type } from '../theme/tokens.js';

/**
 * Pied de page : rappel de marque, raison de l'envoi, réglage des notifications (§33).
 * Le lien de désabonnement ne concerne jamais les emails de sécurité ou de transaction.
 */
export function Footer({
  reason,
  appUrl,
  preferencesUrl,
  supportEmail,
}: {
  reason: string;
  appUrl: string;
  preferencesUrl: string;
  supportEmail: string;
}) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td height="3" style={{ height: '3px', lineHeight: '3px', fontSize: '1px', backgroundColor: color.gold }}>
            &nbsp;
          </td>
        </tr>
        <tr>
          <td className="sm-pad" style={{ backgroundColor: color.charcoal, padding: `26px ${layout.gutter}` }}>
            <span
              style={{
                fontFamily: font.display,
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '2px',
                color: color.white,
                textTransform: 'uppercase',
              }}
            >
              WARRIOR <span style={{ color: color.goldBright }}>SOURCING</span>
            </span>
            <span style={{ ...type.micro, fontFamily: font.body, color: color.onDarkMuted, display: 'block', paddingTop: '6px' }}>
              Importez de Chine. Plus simplement. Plus intelligemment.
            </span>

            <div style={{ height: '16px', lineHeight: '16px', fontSize: 0 }}>&nbsp;</div>

            <span style={{ ...type.micro, fontFamily: font.body, color: color.onDarkMuted, display: 'block' }}>{reason}</span>

            <div style={{ height: '12px', lineHeight: '12px', fontSize: 0 }}>&nbsp;</div>

            <span style={{ ...type.micro, fontFamily: font.body, color: color.onDarkMuted }}>
              <a href={appUrl} style={{ color: color.goldBright, textDecoration: 'none' }}>
                Ouvrir la plateforme
              </a>
              {'  ·  '}
              <a href={preferencesUrl} style={{ color: color.goldBright, textDecoration: 'none' }}>
                Gérer mes notifications
              </a>
              {'  ·  '}
              <a href={`mailto:${supportEmail}`} style={{ color: color.goldBright, textDecoration: 'none' }}>
                Support
              </a>
            </span>

            <div style={{ height: '14px', lineHeight: '14px', fontSize: 0 }}>&nbsp;</div>

            <span style={{ ...type.micro, fontFamily: font.body, color: 'rgba(255,255,255,0.35)', display: 'block' }}>
              Les montants, délais et disponibilités communiqués sont des estimations et ne constituent pas une garantie.
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
