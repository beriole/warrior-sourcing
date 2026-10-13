/**
 * Pose les adresses publiques dans `apps/api/.env` **et** sur les trois projets Vercel.
 *
 *   node scripts/poser-urls.mjs             # affiche ce qui serait posé
 *   node scripts/poser-urls.mjs --appliquer # écrit le .env et pousse sur Vercel
 *
 * Pourquoi un script dédié alors que `vercel-env.mjs` existe : ces valeurs ne sont pas des
 * secrets, et les traiter comme tels coûte cher. Une adresse masquée dans le tableau de bord
 * ne se vérifie plus d'un coup d'œil — or c'est précisément la variable qu'il faut vérifier
 * quand « rien ne passe » : une liste blanche CORS inexacte fait échouer chaque requête
 * **dans le navigateur**, sans laisser la moindre trace côté serveur.
 *
 * `WEB_ORIGIN` et `ADMIN_ORIGIN` acceptent plusieurs adresses séparées par des virgules.
 * Ce n'est pas du luxe : Vercel attribue deux adresses au même déploiement
 * (`projet.vercel.app` et `projet-equipe.vercel.app`), et le visiteur qui arrive par la
 * seconde serait refusé si seule la première était autorisée.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const API = 'https://warrior-sourcing-api.vercel.app';
const WEB = 'https://warrior-sourcing-web.vercel.app';
const ADMIN = 'https://warrior-sourcing-admin.vercel.app';

/** Les deux adresses que Vercel attribue à chaque projet. */
const equipe = (url) => `${url},${url.replace('.vercel.app', '-warrior-tech.vercel.app')}`;

const A_POSER = {
  API_URL: API,
  APP_URL: WEB,
  WEB_ORIGIN: equipe(WEB),
  ADMIN_ORIGIN: equipe(ADMIN),
  NEXT_PUBLIC_API_URL: API,
};

/** Quelle variable va sur quel projet. */
const PROJETS = {
  api: ['API_URL', 'APP_URL', 'WEB_ORIGIN', 'ADMIN_ORIGIN'],
  web: ['NEXT_PUBLIC_API_URL'],
  admin: ['NEXT_PUBLIC_API_URL'],
};

const appliquer = process.argv.includes('--appliquer');
const VERCEL = process.platform === 'win32' ? 'vercel.cmd' : 'vercel';
const chemin = new URL('../apps/api/.env', import.meta.url);

// ── 1. Le fichier .env, pour que le prochain `vercel-env.mjs` parte juste ───────────────
const lignes = readFileSync(chemin, 'utf8').split(/\r?\n/);
const vues = new Set();

const misesAJour = lignes.map((ligne) => {
  const t = ligne.trim();
  if (t.startsWith('#') || !t.includes('=')) return ligne;

  const nom = t.slice(0, t.indexOf('=')).trim();
  if (!Object.hasOwn(A_POSER, nom)) return ligne;

  const ancienne = t.slice(t.indexOf('=') + 1).trim();
  if (ancienne !== A_POSER[nom]) {
    console.log(`  ${nom}`);
    console.log(`    avant : ${ancienne || '(vide)'}`);
    console.log(`    après : ${A_POSER[nom]}`);
  }
  vues.add(nom);
  return `${nom}=${A_POSER[nom]}`;
});

const absentes = Object.keys(A_POSER).filter((nom) => !vues.has(nom));
for (const nom of absentes) {
  console.log(`  ${nom} — absente du .env, ajoutée : ${A_POSER[nom]}`);
  misesAJour.push(`${nom}=${A_POSER[nom]}`);
}

if (appliquer) {
  copyFileSync(chemin, new URL(`../apps/api/.env.sauvegarde-${Date.now()}`, import.meta.url));
  writeFileSync(chemin, misesAJour.join('\n'), 'utf8');
  console.log('\napps/api/.env mis à jour (sauvegarde horodatée posée à côté).');
}

// ── 2. Les projets Vercel ──────────────────────────────────────────────────────────────
for (const [projet, noms] of Object.entries(PROJETS)) {
  console.log(`\n${projet} :`);
  for (const nom of noms) {
    console.log(`  ${nom} = ${A_POSER[nom]}`);
    if (!appliquer) continue;

    for (const environnement of ['production', 'preview']) {
      execFileSync(VERCEL, ['env', 'add', nom, environnement, '--force', '--type', 'config'], {
        input: A_POSER[nom],
        stdio: ['pipe', 'ignore', 'inherit'],
        shell: process.platform === 'win32',
        cwd: new URL(`../apps/${projet}`, import.meta.url),
      });
    }
  }
}

console.log(
  appliquer
    ? '\nPosé. Il faut redéployer les trois projets : une variable ne change rien sans nouvelle construction.'
    : '\nRien n’a été écrit. Relancez avec --appliquer.',
);
