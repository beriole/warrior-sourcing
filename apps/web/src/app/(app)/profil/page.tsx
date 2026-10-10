import type { Metadata } from 'next';
import { ProfilView } from '@/components/profil/profil-view';

export const metadata: Metadata = {
  title: 'Mon profil — Warrior Sourcing',
};

export default function ProfilPage() {
  return <ProfilView />;
}
