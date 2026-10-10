import type { Metadata } from 'next';
import { LibraryView } from '@/components/academy/library-view';

export const metadata: Metadata = {
  title: 'Bibliothèque — Academy — Warrior Sourcing',
  description:
    'PDF, guides, checklists, modèles à remplir et fiches pratiques de l’Academy, avec recherche et filtres par thème.',
};

export default function LibraryPage() {
  return <LibraryView />;
}
