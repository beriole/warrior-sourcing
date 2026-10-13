/**
 * Pose les chemins des photographies sur les lignes déjà en base.
 *
 *   node scripts/poser-visuels-en-base.mjs             # affiche ce qui changerait
 *   node scripts/poser-visuels-en-base.mjs --appliquer # écrit
 *
 * Les jeux de démonstration (`src/academy/demo-data.ts`, `src/catalog/demo-data.ts`,
 * `prisma/seed-suppliers.ts`) désignent désormais de vraies photos. Mais relancer un seed
 * sur la base de production réécrirait aussi les textes, les prix et les chapitres — y
 * compris ce que l'administration aurait corrigé entre-temps. Ce script ne touche qu'aux
 * visuels, et seulement là où la valeur actuelle est encore un rectangle engendré
 * (`data:image/svg+xml`) ou une adresse en `exemple.invalid`.
 *
 * Une ligne déjà pourvue d'une vraie image n'est jamais écrasée.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const pg = require('pg');

const appliquer = process.argv.includes('--appliquer');

const COUVERTURES = {
  'demo-aca-bases-import': '/images/formations/bases-import.jpg',
  'demo-aca-sourcing-1688': '/images/formations/sourcing.jpg',
  'demo-aca-payer-sans-se-faire-avoir': '/images/formations/payer.jpg',
  'demo-aca-cout-rendu-et-tresorerie': '/images/formations/cout-rendu.jpg',
  'demo-aca-negocier-fournisseur': '/images/formations/negocier.jpg',
  'demo-aca-douane-cameroun': '/images/formations/douane.jpg',
};

const PRODUITS = {
  'ecouteurs-sans-fil-tws': '/images/produits/ecouteurs-tws.jpg',
  'coque-telephone-silicone': '/images/produits/coque-telephone.jpg',
  'montre-connectee-sport': '/images/produits/montre-connectee.jpg',
  'batterie-externe-10000': '/images/produits/batterie-externe.jpg',
  'sac-a-main-synthetique': '/images/produits/sac-a-main.jpg',
  'perruque-cheveux-synthetiques': '/images/produits/perruque.jpg',
  'kit-led-auto': '/images/produits/kit-led-auto.jpg',
  'machine-scellage-sachets': '/images/produits/machine-scellage.jpg',
  'sachets-emballage-imprimes': '/images/produits/sachets-imprimes.jpg',
  'mixeur-cuisine-multifonction': '/images/produits/mixeur.jpg',
};

/** Reconnu à son nom : les fiches de démonstration portent toutes le même libellé. */
const FOURNISSEURS = [
  ['Atelier d’accessoires', '/images/fournisseurs/atelier-accessoires.jpg', 'PRODUCTION_LINE'],
  ['Négoce textile', '/images/fournisseurs/negoce-textile.jpg', 'FACTORY'],
  ['Usine de petit électroménager', '/images/fournisseurs/usine-electromenager.jpg', 'FACTORY'],
];

const LEGENDE = 'Illustration — aucune visite n’a été faite chez ce fournisseur de démonstration.';

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

let touches = 0;

// ── Formations ──────────────────────────────────────────────────────────────────────
console.log('Formations :');
for (const [slug, url] of Object.entries(COUVERTURES)) {
  const { rows } = await client.query(`select title, "coverUrl" from "course" where slug = $1`, [slug]);
  if (rows.length === 0) {
    console.log(`      absente  ${slug}`);
    continue;
  }

  const actuelle = rows[0].coverUrl ?? '';
  const aRemplacer = actuelle === '' || actuelle.startsWith('data:');
  console.log(`  ${aRemplacer ? '→' : 'ok'}  ${rows[0].title} ${aRemplacer ? `— ${url}` : '(image déjà posée, laissée)'}`);

  if (aRemplacer && appliquer) {
    await client.query(`update "course" set "coverUrl" = $2, "updatedAt" = now() where slug = $1`, [slug, url]);
    touches += 1;
  }
}

// ── Produits ────────────────────────────────────────────────────────────────────────
console.log('\nProduits :');
for (const [slug, url] of Object.entries(PRODUITS)) {
  const { rows } = await client.query(`select id, name from "product" where slug = $1`, [slug]);
  if (rows.length === 0) {
    console.log(`      absent   ${slug}`);
    continue;
  }

  const { id, name } = rows[0];
  const { rows: images } = await client.query(
    `select count(*)::int as n from "product_image"
      where "productId" = $1 and url not like 'data:%' and url not like '%exemple.invalid%'`,
    [id],
  );

  if (images[0].n > 0) {
    console.log(`  ok  ${name} (image déjà posée, laissée)`);
    continue;
  }

  console.log(`  →   ${name} — ${url}`);
  if (!appliquer) continue;

  await client.query(`delete from "product_image" where "productId" = $1`, [id]);
  await client.query(
    `insert into "product_image" (id, "productId", url, alt, position)
     values (gen_random_uuid()::text, $1, $2, $3, 0)`,
    [id, url, `Photographie d’illustration : ${name.replace('DÉMO — ', '')}`],
  );
  touches += 1;
}

// ── Fournisseurs ────────────────────────────────────────────────────────────────────
console.log('\nFournisseurs :');
for (const [motif, url, genre] of FOURNISSEURS) {
  const { rows } = await client.query(`select id, name from "supplier" where name like $1`, [`%${motif}%`]);
  if (rows.length === 0) {
    console.log(`      absent   ${motif}`);
    continue;
  }

  const { id, name } = rows[0];
  const { rows: photos } = await client.query(
    `select count(*)::int as n from "supplier_photo"
      where "supplierId" = $1 and url not like '%exemple.invalid%'`,
    [id],
  );

  if (photos[0].n > 0) {
    console.log(`  ok  ${name} (photo déjà posée, laissée)`);
    continue;
  }

  console.log(`  →   ${name} — ${url}`);
  if (!appliquer) continue;

  await client.query(`delete from "supplier_photo" where "supplierId" = $1 and url like '%exemple.invalid%'`, [id]);
  // `takenAt` est obligatoire au schéma, et pour une illustration il ne veut rien dire.
  // On y met la date de pose, pas une date de prise de vue inventée — et la légende dit
  // en toutes lettres qu'aucune visite n'a eu lieu, pour qu'on ne lise pas cette date
  // comme la preuve d'un passage sur place.
  await client.query(
    `insert into "supplier_photo" (id, "supplierId", kind, url, caption, "takenAt", "takenBy", "createdAt")
     values (gen_random_uuid()::text, $1, $2::"SupplierPhotoKind", $3, $4, now(), $5, now())`,
    [id, genre, url, LEGENDE, 'Illustration (démonstration)'],
  );
  touches += 1;
}

await client.end();

console.log(
  appliquer
    ? `\n${touches} visuel(s) posé(s).`
    : '\nRien n’a été écrit. Relancez avec --appliquer.',
);
