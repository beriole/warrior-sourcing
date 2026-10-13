/**
 * Pose l'échelle des forfaits d'abonnement : 5 000, 10 000, 15 000, 20 000, 25 000 FCFA.
 *
 *   node scripts/forfaits.mjs             # affiche ce qui changerait
 *   node scripts/forfaits.mjs --appliquer # écrit
 *
 * Reconnaît une offre à son identifiant d'URL (`slug`) : relancer le script met à jour,
 * ne duplique pas. L'offre gratuite n'est pas touchée.
 *
 * ## Ce que ce script ne peut pas décider à votre place
 *
 * La plateforme ne connaît que **quatre droits** : coordonnées des fournisseurs, formations
 * incluses, support prioritaire, simulations illimitées. Cinq paliers payants ne peuvent
 * donc pas se distinguer par les droits seuls — les deux derniers ouvrent les mêmes, et ne
 * diffèrent que par la remise sur les prestations.
 *
 * C'est un vrai défaut commercial, pas un oubli de ce fichier : à 25 000 FCFA on paie
 * 5 000 de plus que Business pour cinq points de remise. Si Business Plus doit apporter
 * autre chose — un volume d'inspections, un accompagnement, un quota —, il faut d'abord
 * créer le droit correspondant dans `SUBSCRIPTION_RIGHTS`, puis le brancher. Tant que ce
 * n'est pas fait, les deux derniers paliers se ressemblent, et le dire vaut mieux que
 * d'écrire un avantage qui n'existe pas (§54).
 *
 * Tout ceci se modifie ensuite depuis le back-office, *Offres → Nouvelle offre*, sans
 * déploiement : prix, droits, remise, avantages et ordre d'affichage.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const pg = require('pg');

const appliquer = process.argv.includes('--appliquer');

/**
 * Les avantages sont des phrases vérifiables : chacune décrit une chose que l'application
 * fait réellement. Aucun chiffre d'audience, aucune promesse de résultat.
 */
const FORFAITS = [
  {
    slug: 'decouverte',
    name: 'Découverte',
    tagline: 'Pour une première importation, sans s’engager loin.',
    priceXaf: 5000,
    rights: ['SUPPLIER_CONTACTS'],
    serviceDiscountPercent: 5,
    highlights: [
      'Coordonnées directes des fournisseurs vérifiés',
      '5 % de remise sur toutes les prestations',
      'Tout ce que contient l’offre gratuite',
    ],
    position: 1,
  },
  {
    slug: 'pro',
    name: 'Pro',
    tagline: 'Pour qui importe régulièrement et veut gagner du temps.',
    priceXaf: 10000,
    rights: ['SUPPLIER_CONTACTS', 'UNLIMITED_SAVED_CALCULATIONS'],
    serviceDiscountPercent: 10,
    highlights: [
      'Coordonnées directes des fournisseurs vérifiés',
      'Simulations enregistrées et retrouvées à tout moment',
      '10 % de remise sur toutes les prestations',
    ],
    position: 2,
  },
  {
    slug: 'pro-plus',
    name: 'Pro Plus',
    tagline: 'Pour apprendre en même temps qu’on importe.',
    priceXaf: 15000,
    rights: ['SUPPLIER_CONTACTS', 'UNLIMITED_SAVED_CALCULATIONS', 'ACADEMY_INCLUDED'],
    serviceDiscountPercent: 15,
    highlights: [
      'Tout ce que contient l’offre Pro',
      'Formations de l’Academy incluses',
      '15 % de remise sur toutes les prestations',
    ],
    position: 3,
  },
  {
    slug: 'business',
    name: 'Business',
    tagline: 'Pour une activité d’importation installée.',
    priceXaf: 20000,
    rights: ['SUPPLIER_CONTACTS', 'UNLIMITED_SAVED_CALCULATIONS', 'ACADEMY_INCLUDED', 'PRIORITY_SUPPORT'],
    serviceDiscountPercent: 20,
    highlights: [
      'Tout ce que contient l’offre Pro Plus',
      'Vos messages traités en priorité',
      '20 % de remise sur toutes les prestations',
    ],
    position: 4,
  },
  {
    slug: 'business-plus',
    name: 'Business Plus',
    tagline: 'Pour un volume d’achat soutenu.',
    priceXaf: 25000,
    rights: ['SUPPLIER_CONTACTS', 'UNLIMITED_SAVED_CALCULATIONS', 'ACADEMY_INCLUDED', 'PRIORITY_SUPPORT'],
    serviceDiscountPercent: 25,
    // Un seul avantage par rapport à Business, et il est écrit tel quel. Annoncer autre
    // chose demanderait de le construire d'abord.
    highlights: [
      'Tout ce que contient l’offre Business',
      '25 % de remise sur toutes les prestations, le taux le plus élevé',
    ],
    position: 5,
  },
];

const env = Object.fromEntries(
  readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const client = new pg.Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL });
await client.connect();

console.log(`Base : ${new URL(env.DIRECT_URL || env.DATABASE_URL).hostname}`);
console.log(appliquer ? 'Mode : écriture.\n' : 'Mode : inspection seule.\n');

// L'offre gratuite garde sa place en tête, quoi qu'il arrive.
if (appliquer) {
  await client.query(`update "subscription_plan" set position = 0, "updatedAt" = now() where slug = 'gratuit'`);
}

for (const f of FORFAITS) {
  const { rows } = await client.query(
    `select "priceXaf", "serviceDiscountPercent" from "subscription_plan" where slug = $1`,
    [f.slug],
  );
  const avant = rows[0];

  console.log(
    `  ${avant ? 'mise à jour' : 'création   '}  ${f.name.padEnd(14)} ${String(f.priceXaf).padStart(6)} FCFA` +
      (avant && avant.priceXaf !== f.priceXaf ? `  (était ${avant.priceXaf})` : '') +
      `  ${f.rights.length} droit(s), −${f.serviceDiscountPercent} % prestations`,
  );

  if (!appliquer) continue;

  if (avant) {
    await client.query(
      `update "subscription_plan"
          set name = $2, tagline = $3, "priceXaf" = $4,
              rights = $5::"SubscriptionRight"[], "serviceDiscountPercent" = $6,
              highlights = $7, position = $8, active = true, "updatedAt" = now()
        where slug = $1`,
      [f.slug, f.name, f.tagline, f.priceXaf, f.rights, f.serviceDiscountPercent, f.highlights, f.position],
    );
  } else {
    await client.query(
      `insert into "subscription_plan"
         (id, slug, name, tagline, "priceXaf", period, rights, "serviceDiscountPercent",
          highlights, position, active, "createdAt", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, $3, $4, 'MONTHLY', $5::"SubscriptionRight"[], $6,
               $7, $8, true, now(), now())`,
      [f.slug, f.name, f.tagline, f.priceXaf, f.rights, f.serviceDiscountPercent, f.highlights, f.position],
    );
  }
}

const { rows: finales } = await client.query(
  `select name, "priceXaf", position, active from "subscription_plan" order by position, "priceXaf"`,
);
console.log('\nOffres en base :');
for (const o of finales) {
  console.log(`  ${o.active ? ' ' : '×'} ${String(o.priceXaf).padStart(6)} FCFA  ${o.name}`);
}

await client.end();

console.log(
  appliquer
    ? '\nPosé. Prix, droits, remise et avantages se modifient ensuite depuis le back-office,' +
        '\n*Offres → Nouvelle offre*, sans déploiement.'
    : '\nRien n’a été écrit. Relancez avec --appliquer.',
);
