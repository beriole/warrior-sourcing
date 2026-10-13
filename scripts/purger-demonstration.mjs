/**
 * Retire de la base les données de démonstration.
 *
 *   node scripts/purger-demonstration.mjs             # n'affiche que ce qui partirait
 *   node scripts/purger-demonstration.mjs --appliquer # supprime
 *
 * Pourquoi un script et non quelques DELETE à la main : la suppression doit être
 * **reconnaissable**. Chaque ligne visée porte le préfixe « DÉMO », posé par les seeds et
 * par rien d'autre. Un `delete from course` effacerait aussi les formations réelles saisies
 * depuis le back-office ; ici, une formation que vous avez écrite ne peut pas être prise
 * pour une donnée d'essai.
 *
 * Ce qui n'est **jamais** touché :
 *
 * - `subscription_plan` — Gratuit, Pro, Business sont la structure de l'offre commerciale,
 *   pas un jeu d'essai. Leurs prix se modifient depuis le back-office.
 * - `payment` et `payment_event` — ce sont des mouvements d'argent réels. Un achat de
 *   démonstration disparaît, la trace de l'encaissement reste.
 * - tout compte autre que les deux comptes `demo-*@warrior-sourcing.cm` des seeds.
 *
 * Les suppressions en cascade font le reste : effacer une formation emporte ses chapitres,
 * leçons, documents, quiz et avis ; effacer un fournisseur emporte ses contacts, photos et
 * liens de boutique.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const pg = require('pg');

const appliquer = process.argv.includes('--appliquer');

const env = Object.fromEntries(
  readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const url = env.DIRECT_URL || env.DATABASE_URL;
if (!url) {
  console.error('Ni DIRECT_URL ni DATABASE_URL dans apps/api/.env.');
  process.exit(1);
}

/**
 * Ordre volontaire : les comptes en dernier.
 *
 * `payment.userId` porte une clé étrangère sans cascade. Si un compte de démonstration
 * avait encaissé quelque chose, sa suppression échouerait — et c'est ce qu'on veut : mieux
 * vaut une erreur qu'un paiement orphelin.
 */
const LOTS = [
  ['produits du catalogue', 'product', `name like 'DÉMO%'`],
  ['fournisseurs', 'supplier', `name like 'DÉMO%'`],
  ['prestations', 'service_offering', `name like 'DÉMO%'`],
  ['transitaires et leurs grilles', 'forwarder', `name like 'DÉMO%'`],
  ['ressources de la bibliothèque', 'library_resource', `title like 'DÉMO%'`],
  ['formations', 'course', `title like 'DÉMO%'`],
  ['formateurs', 'instructor', `name like 'DÉMO%'`],
  ['comptes de démonstration', 'user', `email in ('demo-client@warrior-sourcing.cm', 'demo-admin@warrior-sourcing.cm')`],
];

const client = new pg.Client({ connectionString: url });
await client.connect();

console.log(`Base : ${new URL(url).hostname}`);
console.log(appliquer ? 'Mode : suppression.\n' : 'Mode : inspection seule, rien ne sera supprimé.\n');

let total = 0;

if (appliquer) await client.query('begin');

try {
  for (const [libelle, table, condition] of LOTS) {
    const { rows } = await client.query(`select count(*)::int as n from "${table}" where ${condition}`);
    const n = rows[0].n;
    total += n;

    if (n === 0) {
      console.log(`      —  ${libelle}`);
      continue;
    }

    if (appliquer) await client.query(`delete from "${table}" where ${condition}`);
    console.log(`  ${String(n).padStart(5)}  ${libelle}${appliquer ? ' — supprimé' : ''}`);
  }

  if (appliquer) await client.query('commit');
} catch (error) {
  if (appliquer) await client.query('rollback');
  console.error(`\nÉchec, rien n'a été supprimé : ${error.message.split('\n')[0]}`);
  await client.end();
  process.exit(1);
}

// Ce qui reste : c'est cela qu'il faudra saisir depuis le back-office.
console.log('\nCe que la base contient après coup :');
for (const [libelle, table] of [
  ['offres d’abonnement', 'subscription_plan'],
  ['formations', 'course'],
  ['fournisseurs', 'supplier'],
  ['produits', 'product'],
  ['prestations', 'service_offering'],
  ['transitaires', 'forwarder'],
  ['paiements', 'payment'],
  ['comptes', 'user'],
]) {
  const { rows } = await client.query(`select count(*)::int as n from "${table}"`);
  console.log(`  ${String(rows[0].n).padStart(5)}  ${libelle}`);
}

await client.end();

console.log(
  appliquer
    ? `\n${total} ligne(s) de démonstration supprimée(s).`
    : `\n${total} ligne(s) partiraient. Relancez avec --appliquer.`,
);
