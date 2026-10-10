/**
 * JEU DE DONNÉES DE DÉMONSTRATION — orchestrateur (PLAT-03).
 *
 * Enchaîne les seeds existants (catalogue, fournisseurs, academy, prestations) puis crée deux comptes de démonstration :
 *   - demo-client@warrior-sourcing.cm : un client avec un profil d'importateur rempli ;
 *   - demo-admin@warrior-sourcing.cm  : un membre de l'équipe avec le rôle ADMIN.
 *
 * ⚠ Tout ce que ce script écrit est FICTIF et marqué comme tel (préfixe « DÉMO — »). Ces comptes
 * n'ont ni mot de passe ni téléphone : on s'y connecte par le code envoyé à leur adresse email,
 * qui n'existe pas. En développement, le code est lisible dans `apps/api/.mail`.
 *
 * Le script est idempotent : le relancer met les comptes à jour sans créer de doublon, et chaque
 * seed appelé gère lui-même sa propre idempotence.
 *
 * Exécution : pnpm --filter @ws/api db:seed
 * (compile prisma/*.ts dans `.seed` avec tsc, puis lance ce fichier avec Node.)
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/** Préfixe commun à toutes les données de démonstration du projet. */
const DEMO_PREFIX = 'DÉMO — ';

type DemoAccount = {
  id: string;
  email: string;
  name: string;
  role: 'CLIENT' | 'ADMIN';
  profile: {
    level: 'BEGINNER' | 'FEW_ORDERS' | 'REGULAR' | 'TRADER' | 'COMPANY';
    goals: ('LEARN' | 'FIND_PRODUCTS' | 'FIND_SUPPLIERS' | 'ORDER' | 'REDUCE_COSTS' | 'GROW_BUSINESS')[];
    budgetRange: 'UNDER_100K' | 'FROM_100K_TO_300K' | 'FROM_300K_TO_1M' | 'FROM_1M_TO_5M' | 'OVER_5M';
    interests: ('PHONES' | 'ACCESSORIES' | 'FASHION' | 'BEAUTY' | 'HOME' | 'ELECTRONICS')[];
    city: string;
  } | null;
};

/** Identifiants stables : relancer le script retrouve les mêmes lignes. */
const ACCOUNTS: DemoAccount[] = [
  {
    id: 'demo-user-client',
    email: 'demo-client@warrior-sourcing.cm',
    name: `${DEMO_PREFIX}Client de démonstration`,
    role: 'CLIENT',
    profile: {
      level: 'FEW_ORDERS',
      goals: ['FIND_PRODUCTS', 'FIND_SUPPLIERS', 'ORDER'],
      budgetRange: 'FROM_300K_TO_1M',
      interests: ['PHONES', 'ACCESSORIES', 'HOME'],
      city: 'Douala',
    },
  },
  {
    id: 'demo-user-admin',
    email: 'demo-admin@warrior-sourcing.cm',
    name: `${DEMO_PREFIX}Administrateur de démonstration`,
    role: 'ADMIN',
    profile: null,
  },
];

/** Seeds existants, lancés dans l'ordre en sous-processus : chacun ouvre et ferme sa propre connexion. */
const STEPS = [
  'seed-catalog.js',
  'seed-suppliers.js',
  'seed-academy.js',
  'seed-services.js',
  'seed-billing.js',
  'seed-cargo.js',
] as const;

function runExistingSeeds(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const step of STEPS) {
    console.log(`\n▶ ${step}`);
    execFileSync(process.execPath, ['-r', 'dotenv/config', join(here, step)], { stdio: 'inherit' });
  }
}

async function seedDemoAccounts(prisma: PrismaClient): Promise<void> {
  for (const account of ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        id: account.id,
        email: account.email,
        name: account.name,
        emailVerified: true,
        role: account.role,
      },
      update: { name: account.name, role: account.role, emailVerified: true },
      select: { id: true },
    });

    if (account.profile) {
      await prisma.importerProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...account.profile },
        update: account.profile,
      });
    }

    console.log(`Compte de démonstration prêt : ${account.email} (${account.role})`);
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL manquant : impossible de remplir la base.');

  runExistingSeeds();

  console.log('\n▶ comptes de démonstration');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await seedDemoAccounts(prisma);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\nJeu de données de démonstration en place. Toutes ces lignes sont fictives (préfixe « DÉMO — »).');
}

await main();
