import type { Metadata } from 'next';
import { FavorisView } from '@/components/favoris/favoris-view';

export const metadata: Metadata = {
  title: 'Mes favoris — Warrior Sourcing',
};

export default function FavorisPage() {
  return <FavorisView />;
}
