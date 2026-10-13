/**
 * Télécharge les photographies des cartes (formations, produits, fournisseurs).
 *
 *   node scripts/telecharger-visuels.mjs
 *
 * Les fichiers vont dans `apps/web/public/images/`, puis sont recopiés dans
 * `apps/admin/public/images/`. La raison de la copie : les visuels sont désignés en base
 * par un chemin **relatif à la racine du site** (`/images/formations/…`), et un chemin
 * relatif se résout contre l'application qui l'affiche. Le back-office affiche les mêmes
 * fiches ; sans la copie, il montrerait des images cassées.
 *
 * Source : Pexels, licence libre — usage commercial autorisé, modification autorisée,
 * aucune attribution exigée. Le crédit est écrit dans `CREDITS.md` quand même : dans six
 * mois, personne ne se souviendra d'où vient un fichier.
 *
 * Deux règles tenues, les mêmes que pour les visuels de l'accueil :
 *
 * - **Aucune photo ne met en avant un visage reconnaissable.** La licence n'autorise pas
 *   à laisser croire qu'une personne photographiée soutient un produit. Les photos de
 *   négociation retenues ne montrent que des mains.
 * - **Aucune légende n'affirme un lieu.** Ces images illustrent un sujet ; aucune n'est
 *   présentée comme prise en Chine ou au Cameroun, parce que rien ne permet de l'affirmer.
 */
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = new URL('../', import.meta.url);
const WEB = fileURLToPath(new URL('apps/web/public/images/', racine));
const ADMIN = fileURLToPath(new URL('apps/admin/public/images/', racine));

/** `w`/`h` sont passés à Pexels : on télécharge déjà recadré, pas une image de 5 Mo. */
const pexels = (id, w, h) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;

/**
 * Trois photos ont été écartées après les avoir regardées : les premières trouvées pour
 * les écouteurs, la montre et les coques montraient des AirPods, une Apple Watch et des
 * coques à logo Apple. Illustrer un produit de sourcing annoncé à 38 CNY avec du matériel
 * Apple laisse croire qu'on peut l'acheter à ce prix — c'est faux, et c'est une marque
 * déposée. Les remplaçantes ne portent aucun logo.
 */
const COUVERTURE = [1200, 675]; // 16/9, la proportion des cartes de formation
const CARRE = [900, 900]; // les vignettes produit sont carrées

const VISUELS = [
  // ── Formations ────────────────────────────────────────────────────────────────────
  ['formations/bases-import.jpg', 20581299, COUVERTURE, 'Porte-conteneurs à quai sous portiques'],
  ['formations/sourcing.jpg', 4487364, COUVERTURE, 'Entrepôt clair, rayonnages métalliques chargés'],
  ['formations/payer.jpg', 4199524, COUVERTURE, 'Paiement par téléphone sur un terminal, mains seules'],
  ['formations/cout-rendu.jpg', 17065743, COUVERTURE, 'Calculatrice, lunettes et dossiers sur un bureau'],
  ['formations/negocier.jpg', 5520322, COUVERTURE, 'Poignée de main en gros plan, sans visage'],
  ['formations/douane.jpg', 6667676, COUVERTURE, 'Mains signant un document sur une planchette'],

  // ── Produits du catalogue ─────────────────────────────────────────────────────────
  ['produits/ecouteurs-tws.jpg', 33797659, CARRE, 'Écouteurs sans fil noirs sur fond jaune, sans marque'],
  ['produits/coque-telephone.jpg', 374140, CARRE, 'Coques de téléphone imprimées, motifs variés'],
  ['produits/montre-connectee.jpg', 30707908, CARRE, 'Montre connectée écran éteint sur fond bleu, sans logo'],
  ['produits/batterie-externe.jpg', 4072683, CARRE, 'Batterie externe blanche et câbles de charge'],
  ['produits/sac-a-main.jpg', 22434759, CARRE, 'Deux sacs à main en cuir sur fond blanc'],
  ['produits/perruque.jpg', 14730868, CARRE, 'Mèches de cheveux liées en bottes, vues de dessus'],
  ['produits/kit-led-auto.jpg', 20771125, CARRE, 'Phare de voiture en gros plan'],
  ['produits/machine-scellage.jpg', 4820840, CARRE, 'Scelleuse industrielle fermant un sachet'],
  ['produits/sachets-imprimes.jpg', 12024976, CARRE, 'Deux sachets debout, maquette d’emballage'],
  ['produits/mixeur.jpg', 12689256, CARRE, 'Mixeur de cuisine sur un plan de travail'],

  // ── Fournisseurs ──────────────────────────────────────────────────────────────────
  ['fournisseurs/atelier-accessoires.jpg', 34221993, COUVERTURE, 'Machines automatisées sur une ligne d’assemblage'],
  ['fournisseurs/negoce-textile.jpg', 12234109, COUVERTURE, 'Entrepôt industriel organisé, rayonnages métalliques'],
  ['fournisseurs/usine-electromenager.jpg', 34718930, COUVERTURE, 'Intérieur d’usine moderne, convoyeurs'],
];

let obtenus = 0;
const echecs = [];

for (const [chemin, id, [w, h], sujet] of VISUELS) {
  const cible = `${WEB}${chemin}`;
  mkdirSync(dirname(cible), { recursive: true });

  try {
    const reponse = await fetch(pexels(id, w, h), { signal: AbortSignal.timeout(60_000) });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const octets = Buffer.from(await reponse.arrayBuffer());
    // Une réponse de quelques centaines d'octets est une page d'erreur, pas une photo.
    if (octets.length < 5_000) throw new Error(`réponse trop courte (${octets.length} octets)`);

    writeFileSync(cible, octets);
    console.log(`  ${(octets.length / 1024).toFixed(0).padStart(4)} Ko  ${chemin} — ${sujet}`);
    obtenus += 1;
  } catch (error) {
    echecs.push(`${chemin} (photo ${id}) : ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Copie vers le back-office ───────────────────────────────────────────────────────
function recopier(depuis, vers) {
  mkdirSync(vers, { recursive: true });
  for (const entree of readdirSync(depuis)) {
    const source = `${depuis}${entree}`;
    if (statSync(source).isDirectory()) recopier(`${source}/`, `${vers}${entree}/`);
    else copyFileSync(source, `${vers}${entree}`);
  }
}
recopier(WEB, ADMIN);

console.log(`\n${obtenus} visuel(s) sur ${VISUELS.length}, recopiés vers le back-office.`);
if (echecs.length > 0) {
  console.log('\nÉchecs :');
  for (const e of echecs) console.log(`  ${e}`);
}
