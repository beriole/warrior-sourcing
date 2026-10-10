import type { Metadata } from 'next';
import { ProjectView } from '@/components/business-lab/project-view';

export const metadata: Metadata = {
  title: 'Projet — Business Lab — Warrior Sourcing',
};

/** Le paramètre est l'identifiant du projet commercial. */
export default async function ProjetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectView id={id} />;
}
