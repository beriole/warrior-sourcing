import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { GardeConnexion } from '@/components/garde-connexion';

/**
 * Coque des écrans de l'application : barre latérale sur bureau, barre du bas sur mobile.
 *
 * La garde de session est posée ici plutôt que page par page. Elle ne protège que les
 * écrans qui portent des informations personnelles — la liste est dans
 * `garde-connexion.tsx`. Le catalogue, l'Academy, les fournisseurs et le calculateur
 * restent consultables sans compte : on ne demande pas de s'inscrire pour regarder.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <GardeConnexion>{children}</GardeConnexion>
    </AppShell>
  );
}
