/**
 * DONNÉES DE DÉMONSTRATION de l'Academy (lot ACA).
 *
 * Remplit la base avec quatre formations fictives (gratuite, payante, incluse dans
 * l'abonnement), leurs chapitres, leçons, documents, quiz, avis, et une bibliothèque de
 * ressources, pour que les écrans « Academy » soient navigables en développement.
 * Aucune de ces lignes n'est un contenu réel : chaque titre porte le préfixe « DÉMO — ».
 *
 * Exécution : pnpm --filter @ws/api db:seed (appelé par prisma/seed.ts).
 *
 * Le jeu de données lui-même vit dans `src/academy/demo-data.ts` : il est ainsi compilé,
 * typé et vérifié comme le reste du code du lot.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedAcademyDemoData } from '../src/academy/demo-data.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL manquant : impossible de remplir la base.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const counts = await seedAcademyDemoData(prisma);
    console.log(
      `${counts.courses} formations, ${counts.lessons} leçons et ${counts.resources} ressources de démonstration insérées ou mises à jour.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
