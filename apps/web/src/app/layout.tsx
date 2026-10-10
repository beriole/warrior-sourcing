import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { ScriptRevelation } from '@ws/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { Inter, Sora } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const sora = Sora({ variable: '--font-sora', subsets: ['latin'], weight: ['600', '700', '800'], display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return { title: t('title'), description: t('description') };
}

export const viewport: Viewport = {
  themeColor: '#141417',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  // `suppressHydrationWarning` sur <html> uniquement : le script de révélation pose
  // `data-ws-js` sur cet élément avant l'hydratation, pour que rien ne clignote au
  // premier affichage. React compare tous les attributs des éléments qu'il a rendus et
  // signalait donc une divergence sur chaque page. L'exception ne porte que sur cet
  // élément : elle ne masque aucune divergence dans le contenu.
  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${sora.variable} antialiased`}>
      <body className="min-h-dvh">
        <ScriptRevelation />
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
