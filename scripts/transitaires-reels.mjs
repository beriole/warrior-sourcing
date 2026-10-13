/**
 * Transitaires **réels** de la route Chine → Cameroun.
 *
 *   node scripts/transitaires-reels.mjs             # affiche ce qui serait écrit
 *   node scripts/transitaires-reels.mjs --appliquer # écrit dans la base
 *
 * Ce fichier n'est pas un jeu d'essai : ce sont des entreprises qui existent, relevées le
 * 13 octobre 2026. Chaque ligne porte sa source. Le script est idempotent : il reconnaît
 * une fiche à son nom, met à jour ce qu'il sait, et ne touche pas aux grilles que
 * l'administration aurait saisies elle-même.
 *
 * ## Ce que la recherche a donné, et ce qu'elle n'a pas donné
 *
 * Six transitaires camerounais ou opérant vers le Cameroun ont été identifiés avec des
 * coordonnées vérifiables. **Aucun ne publie de grille tarifaire sur son site.** Yemba
 * Express annonce une proforma gratuite avant chaque envoi ; Baillam Shop renvoie à un
 * devis ; JFI Express a une page « Nos tarifs » qui ne mène nulle part.
 *
 * Les seuls prix au kilo trouvés viennent d'annonces sur TikTok et Facebook. Ils sont
 * repris ici **avec leur source et leur date**, et pas autrement : ce sont des annonces
 * promotionnelles, non confirmées par l'entreprise, et elles peuvent avoir changé le
 * lendemain. Un tarif sans source n'a rien à faire dans cette base (§54).
 *
 * Un transitaire sans grille n'est pas un transitaire inutile : sa fiche sert à l'assistant
 * d'adresse et au choix du prestataire. Le calculateur, lui, bascule de lui-même sur une
 * fourchette marquée « estimation » quand aucun tarif n'est saisi.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const pg = require('pg');

const appliquer = process.argv.includes('--appliquer');
const RELEVE = '2026-10-13';

/**
 * `tarifs: []` veut dire « aucun tarif publié », et c'est une information, pas un trou :
 * l'interface écrit « sur devis » plutôt que d'afficher un chiffre que personne n'a donné.
 */
const TRANSITAIRES = [
  {
    name: 'JFI Express — Joe Cargo',
    cities: ['Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Buéa'],
    modes: ['AIR'],
    contactPhone: '+237 674 23 85 44',
    contactEmail: 'contact@jfi-express.com',
    notes: [
      'Site : https://jfi-express.com — relevé le ' + RELEVE + '.',
      'Agence de Douala : Rue Pau, quartier Makepe (+237 695 874 512).',
      'Représentations : Yaoundé (Messa, station OLA), Bafoussam, Bamenda, Buéa.',
      'Services annoncés : fret aérien, porte-à-porte, entreposage, emballage, formalités',
      'douanières, assurance. Origines annoncées : Chine, Turquie, Inde, Dubaï.',
      'Aucun tarif publié : la page « Nos tarifs » du site ne mène nulle part.',
    ].join(' '),
    warehouseName: 'Boutique de groupage de Guangzhou',
    warehouseAddressLatin: 'Shop A31, New Honghui Trading Mall, Guangzhou 510000, Chine',
    warehouseInstructions:
      'Adresse relevée sur le site du transitaire le ' +
      RELEVE +
      ', en caractères latins seulement. ' +
      'À FAIRE CONFIRMER par écrit auprès de JFI Express, avec la version en caractères chinois, ' +
      'avant d’y envoyer quoi que ce soit : c’est la version chinoise que lit le transporteur local.',
    tarifs: [],
  },
  {
    name: 'Yemba Express',
    cities: ['Douala', 'Yaoundé'],
    modes: ['AIR', 'SEA'],
    contactPhone: '+237 697 17 00 00',
    contactEmail: 'contact@yemba.com',
    notes: [
      'Site : https://yemba.com — relevé le ' + RELEVE + '. WhatsApp sur le même numéro.',
      'Dépôt de Douala : Makepe Total Petit Marché. Yaoundé : Mini Prix Bastos.',
      'Origines : Guangzhou, Shenzhen, Yiwu. Aérien 7 à 10 jours ouvrés ;',
      'maritime groupage 25 à 35 jours, minimum 0,5 m³.',
      'Propose aussi l’achat assisté sur 1688 et Alibaba, avec paiement en RMB et',
      'contrôle qualité avant expédition. Livraison au-delà de Douala et Yaoundé',
      '(Bafoussam, Garoua, Maroua, Bamenda, Bertoua, Kribi) au frais du client.',
      'Aucun tarif publié : une proforma gratuite est annoncée avant chaque envoi.',
    ].join(' '),
    tarifs: [],
  },
  {
    name: 'Baillam Shop',
    cities: ['Douala', 'Yaoundé'],
    modes: ['AIR', 'SEA'],
    contactPhone: '+237 675 446 875',
    contactEmail: 'contact@baillamshop.com',
    notes: [
      'Site : https://baillamshop.com/transitaire — relevé le ' + RELEVE + '.',
      'Ports de départ annoncés : Shenzhen, Guangzhou, Shanghai.',
      'Maritime FCL et groupage LCL 30 à 45 jours ; aérien 7 à 15 jours.',
      'Dessert aussi le Gabon, le Congo, la Côte d’Ivoire, le Sénégal, le Mali,',
      'le Burkina Faso, le Tchad, la Guinée équatoriale, la RD Congo, la Guinée,',
      'le Togo, le Bénin, le Niger, la Centrafrique et Madagascar.',
      'Aucun tarif publié ni adresse d’agence : le site renvoie à un devis gratuit.',
    ].join(' '),
    tarifs: [],
  },
  {
    name: 'Comfort Cargo',
    cities: ['Douala', 'Yaoundé'],
    modes: ['AIR'],
    notes: [
      'Site : https://comfortcargocm.com — inaccessible depuis l’extérieur le ' + RELEVE,
      '(réponse 403). Agences à Douala et Yaoundé, paiement en espèces annoncé.',
      'Fiche à compléter : coordonnées et tarifs à obtenir directement auprès de l’entreprise.',
    ].join(' '),
    tarifs: [],
  },
  {
    name: 'Djemba Cargo',
    cities: ['Douala', 'Yaoundé'],
    modes: ['AIR'],
    notes: [
      'Présence commerciale sur TikTok, relevée le ' + RELEVE + '. Aucun site officiel trouvé.',
      'Annonce une livraison en 6 jours ouvrés et le transport gratuit des téléphones',
      'et ordinateurs. Grille annoncée par catégorie : 6 900 FCFA/kg pour les habits,',
      '7 200 FCFA/kg pour les colis de 1 à 31 kg, 8 500 FCFA/kg pour les liquides,',
      'batteries et poudres. Coordonnées à obtenir en message privé : à compléter.',
    ].join(' '),
    tarifs: [
      {
        mode: 'AIR',
        unit: 'KG',
        unitPriceXaf: 7200,
        transitDays: 6,
        source:
          'Annonce TikTok relevée le ' +
          RELEVE +
          ' : 7 200 FCFA/kg pour un colis de 1 à 31 kg ' +
          '(habits 6 900, liquides/batteries/poudres 8 500). Promotion non confirmée par le transitaire.',
      },
    ],
  },
  {
    name: 'Richyfy Cargo',
    cities: ['Douala'],
    modes: ['SEA'],
    notes: [
      'Page Facebook : https://www.facebook.com/richyfycargo/ — relevée le ' + RELEVE + '.',
      'Annonce du groupage maritime Chine → Cameroun. Coordonnées à compléter.',
    ].join(' '),
    tarifs: [
      {
        mode: 'SEA',
        unit: 'CBM',
        unitPriceXaf: 275000,
        transitDays: 35,
        source:
          'Annonce Facebook relevée le ' +
          RELEVE +
          ' : « dès 275 000 FCFA le CBM ». Prix d’appel, non confirmé par le transitaire. ' +
          'Délai de 35 jours repris de la moyenne du groupage maritime, non annoncé par l’entreprise.',
      },
    ],
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

let ecrits = 0;
let tarifsEcrits = 0;

for (const t of TRANSITAIRES) {
  const { rows } = await client.query(`select id from "forwarder" where name = $1`, [t.name]);
  const existe = rows.length > 0;

  console.log(`  ${existe ? 'déjà présent' : 'à créer    '}  ${t.name}`);
  console.log(`                ${t.cities.join(', ')} — ${t.modes.join(', ')}`);
  console.log(
    `                ${t.tarifs.length === 0 ? 'aucun tarif publié : sur devis' : `${t.tarifs.length} tarif(s) sourcé(s)`}`,
  );

  if (!appliquer) continue;

  let id = rows[0]?.id;

  if (!existe) {
    const insere = await client.query(
      `insert into "forwarder"
         (id, name, "contactPhone", "contactEmail", cities, modes, active, notes,
          "warehouseName", "warehouseAddressLatin", "warehouseInstructions", "createdAt", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, $3, $4, $5::"ShippingMode"[], true, $6, $7, $8, $9, now(), now())
       returning id`,
      [
        t.name,
        t.contactPhone ?? null,
        t.contactEmail ?? null,
        t.cities,
        t.modes,
        t.notes,
        t.warehouseName ?? null,
        t.warehouseAddressLatin ?? null,
        t.warehouseInstructions ?? null,
      ],
    );
    id = insere.rows[0].id;
    ecrits += 1;
  } else {
    // Les coordonnées et les notes suivent la dernière vérification ; l'adresse d'entrepôt,
    // elle, n'est jamais réécrite : si quelqu'un l'a confirmée auprès du transitaire, son
    // travail vaut mieux que ce relevé.
    await client.query(
      `update "forwarder"
          set "contactPhone" = coalesce($2, "contactPhone"),
              "contactEmail" = coalesce($3, "contactEmail"),
              cities = $4, modes = $5::"ShippingMode"[], notes = $6, "updatedAt" = now()
        where id = $1`,
      [id, t.contactPhone ?? null, t.contactEmail ?? null, t.cities, t.modes, t.notes],
    );
    ecrits += 1;
  }

  for (const tarif of t.tarifs) {
    const { rows: deja } = await client.query(
      `select id from "freight_rate" where "forwarderId" = $1 and mode = $2::"ShippingMode" and source = $3`,
      [id, tarif.mode, tarif.source],
    );
    if (deja.length > 0) continue;

    await client.query(
      `insert into "freight_rate"
         (id, "forwarderId", mode, unit, "unitPriceXaf", "minimumChargeXaf", "weightBreakKg",
          "transitDays", currency, "effectiveFrom", source, active, "createdAt")
       values (gen_random_uuid()::text, $1, $2::"ShippingMode", $3::"FreightRateUnit", $4, 0, 0,
               $5, 'XAF', $6, $7, true, now())`,
      [id, tarif.mode, tarif.unit, tarif.unitPriceXaf, tarif.transitDays, new Date(RELEVE), tarif.source],
    );
    tarifsEcrits += 1;
  }
}

await client.end();

console.log(
  appliquer
    ? `\n${ecrits} transitaire(s) écrit(s), ${tarifsEcrits} tarif(s) ajouté(s).`
    : '\nRien n’a été écrit. Relancez avec --appliquer.',
);

console.log(
  '\nCe qu’aucune recherche ne remplacera : demandez à chacun sa grille par écrit, et' +
    '\nsaisissez-la depuis le back-office. Les quatre premières fiches n’ont volontairement' +
    '\naucun tarif — « sur devis » est la vérité, un chiffre inventé ne le serait pas.',
);
