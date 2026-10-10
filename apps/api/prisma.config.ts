import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Dossier plutôt que fichier unique : chaque domaine a son fichier, les équipes ne se gênent pas.
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
