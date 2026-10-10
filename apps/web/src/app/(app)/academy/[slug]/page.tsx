import type { Metadata } from 'next';
import { CourseDetailView } from '@/components/academy/course-detail-view';

export const metadata: Metadata = {
  title: 'Formation — Academy — Warrior Sourcing',
  description:
    'Programme, durée, formateur, avis et conditions d’accès d’une formation de l’Academy.',
};

/** Le paramètre est le libellé d'URL de la formation. */
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CourseDetailView slug={slug} />;
}
