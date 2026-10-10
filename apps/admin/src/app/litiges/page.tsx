import type { Metadata } from 'next';
import { LitigesView } from '@/components/litiges/litiges-view';

export const metadata: Metadata = {
  title: 'Litiges — Back-office Warrior Sourcing',
};

/** Workflow complet des litiges, sans raccourci d'étape (ADM-08, §39). */
export default function LitigesPage() {
  return <LitigesView />;
}
