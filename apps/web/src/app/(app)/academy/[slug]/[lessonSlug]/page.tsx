import type { Metadata } from 'next';
import { LessonView } from '@/components/academy/lesson-view';

export const metadata: Metadata = {
  title: 'Leçon — Academy — Warrior Sourcing',
  description: 'Lecteur de leçon : vidéo, documents, notes personnelles, quiz et avancement.',
};

/** Les deux paramètres sont les libellés d'URL de la formation et de la leçon. */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  return <LessonView courseSlug={slug} lessonSlug={lessonSlug} />;
}
