import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { ParametresView } from '@/components/parametres/parametres-view';

export const metadata: Metadata = {
  title: 'Paramètres — Warrior Sourcing',
};

/** La langue courante est lue côté serveur : c'est le cookie qui fait foi, pas l'écran. */
export default async function ParametresPage() {
  return <ParametresView locale={await getLocale()} />;
}
