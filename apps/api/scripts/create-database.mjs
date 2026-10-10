/**
 * Crée la base indiquée dans DATABASE_URL si elle n'existe pas encore.
 * Évite d'avoir à ouvrir pgAdmin ou psql sur une machine Windows.
 *
 *   pnpm db:create
 */
import 'dotenv/config';
import { Client } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL est absent. Copiez .env.example vers .env et renseignez votre mot de passe.');
  process.exit(1);
}

const target = new URL(url);
const databaseName = decodeURIComponent(target.pathname.slice(1));
if (!databaseName) {
  console.error('DATABASE_URL ne contient pas de nom de base.');
  process.exit(1);
}

// On se connecte à la base « postgres », toujours présente, pour créer la nôtre.
const admin = new URL(url);
admin.pathname = '/postgres';

const client = new Client({ connectionString: admin.toString() });

try {
  await client.connect();
} catch (error) {
  console.error(`Connexion à PostgreSQL impossible sur ${target.host}.`);
  console.error(error.message);
  console.error('Vérifiez que le service PostgreSQL est démarré et que le mot de passe de .env est correct.');
  process.exit(1);
}

const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);

if (rowCount > 0) {
  console.log(`La base « ${databaseName} » existe déjà.`);
} else {
  // Le nom vient de notre propre configuration : on l'échappe malgré tout.
  await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
  console.log(`Base « ${databaseName} » créée.`);
}

await client.end();
