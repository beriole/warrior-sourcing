import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Les paquets du monorepo (@ws/ui, @ws/contracts) sont transpilés automatiquement.
  // Réduit le JS envoyé sur mobile : n'embarque que les icônes réellement importées.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default withNextIntl(nextConfig);
