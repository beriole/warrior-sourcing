import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Dossier plutôt que fichier unique : chaque domaine a son fichier, les équipes ne se gênent pas.
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    /*
     * `DIRECT_URL` d'abord, `DATABASE_URL` ensuite.
     *
     * Ce fichier ne configure que l'outil en ligne de commande — migrations, génération,
     * studio. L'application, elle, lit `DATABASE_URL` par son propre adaptateur
     * (`PrismaService`). Les deux chemins sont donc indépendants, et c'est ce qui permet
     * de les faire pointer ailleurs.
     *
     * Pourquoi ils doivent pointer ailleurs : Supabase sert l'application par PgBouncer en
     * mode transaction (port 6543), où chaque requête peut tomber sur une connexion
     * différente. Parfait pour une application, impossible pour une migration, qui pose
     * des verrous et crée des types sur une session qu'elle doit garder ouverte.
     *
     * Prisma 7 a retiré `directUrl` du schéma et de cette configuration : le choix se fait
     * donc ici, à la lecture. En local, où les deux URL sont identiques, rien ne change.
     */
    url:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres',
  },
});
