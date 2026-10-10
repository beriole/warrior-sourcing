/**
 * Prépare `apps/api/.env` pour la production.
 *
 * Ne renseigne que ce qui peut l'être **sans rien demander à personne** : deux secrets
 * aléatoires et deux réglages. Tout ce qui appartient à un compte — mot de passe Supabase,
 * mot de passe courriel — est laissé tel quel et signalé.
 *
 * Le fichier est réécrit ligne à ligne : les commentaires, l'ordre et les variables
 * inconnues sont conservés. Une sauvegarde horodatée est posée à côté avant toute écriture.
 */
import { randomBytes } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const chemin = new URL('../apps/api/.env', import.meta.url);
const original = readFileSync(chemin, 'utf8');

const sauvegarde = new URL(`../apps/api/.env.sauvegarde-${Date.now()}`, import.meta.url);
copyFileSync(chemin, sauvegarde);

/**
 * Valeurs qu'on pose soi-même.
 *
 * `seulementSiModele` : on ne remplace que si la valeur actuelle est un texte de modèle.
 * Écraser un secret déjà choisi déconnecterait tout le monde sans prévenir.
 */
const A_POSER = [
  {
    nom: 'AUTH_SECRET',
    valeur: () => randomBytes(48).toString('base64'),
    seulementSiModele: true,
    motif: 'signe les cookies de session : un secret de démonstration les rend forgeables',
  },
  {
    nom: 'CRON_SECRET',
    valeur: () => randomBytes(32).toString('base64url'),
    seulementSiModele: true,
    motif: 'authentifie la tâche planifiée qui réconcilie les paiements',
  },
  {
    nom: 'AUTH_COOKIE_SAMESITE',
    valeur: () => 'none',
    seulementSiModele: true,
    motif: 'le site et l’API seront sur deux domaines : sans « none », la session n’est jamais envoyée',
  },
  {
    nom: 'OPENROUTER_MODEL',
    valeur: () => 'anthropic/claude-haiku-5.5',
    seulementSiModele: true,
    motif: 'modèle vérifié comme disponible chez OpenRouter',
  },
];

const estUnModele = (valeur) =>
  !valeur ||
  /\[YOUR-|\[VOTRE-|MOT_DE_PASSE|a-remplacer|votre_mot_de_passe|^$/i.test(valeur);

let lignes = original.split(/\r?\n/);

function valeurActuelle(nom) {
  // La dernière définition active gagne, comme chez dotenv.
  let trouvee = null;
  for (const ligne of lignes) {
    const t = ligne.trim();
    if (t.startsWith('#') || !t.includes('=')) continue;
    if (t.slice(0, t.indexOf('=')).trim() === nom) trouvee = t.slice(t.indexOf('=') + 1).trim();
  }
  return trouvee;
}

const poses = [];
const conserves = [];

for (const { nom, valeur, seulementSiModele, motif } of A_POSER) {
  const actuelle = valeurActuelle(nom);

  if (seulementSiModele && actuelle !== null && !estUnModele(actuelle)) {
    conserves.push(nom);
    continue;
  }

  const nouvelle = valeur();
  let remplacee = false;

  lignes = lignes.map((ligne) => {
    const t = ligne.trim();
    if (t.startsWith('#') || !t.includes('=')) return ligne;
    if (t.slice(0, t.indexOf('=')).trim() !== nom) return ligne;
    remplacee = true;
    return `${nom}=${nouvelle}`;
  });

  if (!remplacee) {
    lignes.push('', `# ${motif}`, `${nom}=${nouvelle}`);
  }

  poses.push({ nom, longueur: nouvelle.length, motif });
}

writeFileSync(chemin, lignes.join('\n'), 'utf8');

console.log(`Sauvegarde : ${sauvegarde.pathname.split('/').pop()}\n`);

if (poses.length > 0) {
  console.log('Posé :');
  for (const p of poses) console.log(`  ${p.nom} (${p.longueur} caractères) — ${p.motif}`);
}
if (conserves.length > 0) {
  console.log(`\nConservé tel quel, une vraie valeur y était déjà : ${conserves.join(', ')}`);
}

console.log('\nCe qui reste à renseigner par vous, et que personne d’autre ne peut deviner :');
for (const [nom, quoi] of [
  ['DATABASE_URL / DIRECT_URL', 'le mot de passe de la base Supabase, à la place de [YOUR-PASSWORD]'],
  ['EMAIL_PASSWORD', 'le mot de passe applicatif du compte d’envoi, ou une clé Resend'],
  ['WEB_ORIGIN / ADMIN_ORIGIN / APP_URL / API_URL', 'les adresses définitives, connues après le premier déploiement'],
]) {
  const actuelle = valeurActuelle(nom.split(' ')[0]);
  const etat = estUnModele(actuelle) ? 'à remplir' : 'renseignée (à vérifier)';
  console.log(`  ${nom} — ${quoi} [${etat}]`);
}
