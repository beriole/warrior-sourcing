/**
 * DONNÉES DE DÉMONSTRATION du catalogue (lot CAT).
 *
 * Remplit la base avec une dizaine de produits fictifs pour que les écrans
 * « Opportunités » soient navigables en développement. Aucune de ces lignes n'est un
 * relevé réel : chaque source le dit, et rien ici ne doit servir à décider d'un achat.
 *
 * Exécution (la compilation place le script dans `dist`, déjà ignoré par git) :
 *   pnpm --filter @ws/api exec tsc --outDir dist
 *   pnpm --filter @ws/api exec node dist/prisma/seed-catalog.js
 *
 * Le jeu de données lui-même vit dans `src/catalog/demo-data.ts` : il est ainsi compilé,
 * typé et vérifié comme le reste du code du lot.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedCatalogDemoData } from '../src/catalog/demo-data.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL manquant : impossible de remplir la base.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const count = await seedCatalogDemoData(prisma);
    console.log(`${count} produits de démonstration insérés ou mis à jour.`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
