import { Body, Container, Head, Html, Preview } from '@react-email/components';
import type { ReactNode } from 'react';
import { globalStyles } from '../theme/styles.js';
import { color, layout, radius } from '../theme/tokens.js';
import { Footer } from './footer.js';
import { Header } from './header.js';

export type BrandContext = {
  appUrl: string;
  preferencesUrl: string;
  supportEmail: string;
};

/**
 * Enveloppe commune à tous les emails : fond charbon, carte centrée de 640 px,
 * en-tête à dégradé, contenu, pied de page. Chaque template ne décrit que son contenu.
 */
export function EmailLayout({
  preview,
  eyebrow,
  kicker,
  reason,
  brand,
  children,
}: {
  /** Texte d'aperçu affiché dans la liste des messages, avant l'ouverture. */
  preview: string;
  eyebrow?: string;
  kicker?: string;
  /** Pourquoi cet email a été envoyé : exigé dans le pied de page. */
  reason: string;
  brand: BrandContext;
  children: ReactNode;
}) {
  return (
    <Html lang="fr" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style
          // Styles globaux : confort et mouvement. Tout l'essentiel reste en inline.
          dangerouslySetInnerHTML={{ __html: globalStyles }}
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="dm-bg"
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: color.charcoal,
          // Halo discret derrière la carte : profondeur, sans image.
          backgroundImage: `radial-gradient(60% 40% at 50% 0%, rgba(200,16,46,0.28) 0%, rgba(12,12,16,0) 70%)`,
        }}
      >
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%', backgroundColor: 'transparent' }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: '28px 12px 36px' }}>
                <Container
                  className="sm-full"
                  style={{
                    width: `${layout.width}px`,
                    maxWidth: '100%',
                    borderRadius: radius.lg,
                    overflow: 'hidden',
                    border: `1px solid ${color.lineDark}`,
                  }}
                >
                  <Header eyebrow={eyebrow} kicker={kicker} />
                  {children}
                  <Footer
                    reason={reason}
                    appUrl={brand.appUrl}
                    preferencesUrl={brand.preferencesUrl}
                    supportEmail={brand.supportEmail}
                  />
                </Container>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}
