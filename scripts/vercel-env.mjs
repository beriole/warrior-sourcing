/**
 * Pousse les variables d'environnement vers un projet Vercel, depuis `apps/api/.env`.
 *
 *   node scripts/vercel-env.mjs api        # variables du serveur
 *   node scripts/vercel-env.mjs web        # variables du site
 *   node scripts/vercel-env.mjs admin      # variables du back-office
 *
 * Ajoutez `--dry` pour voir ce qui serait poussé sans rien pousser.
 *
 * Deux garde-fous :
 *
 * - **Aucune valeur n'est affichée.** Le script annonce le nom de la variable et la
 *   longueur de sa valeur, jamais la valeur. Un journal de déploiement se retrouve vite
 *   dans un ticket ou une capture d'écran.
 * - **Liste blanche.** Seules les variables nommées ici partent. Votre `.env` local
 *   contient des réglages de développement qui n'ont rien à faire en production, et une
 *   liste noire laisserait passer la prochaine variable qu'on y ajoutera.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [, , cible, ...options] = process.argv;
const simulation = options.includes('--dry');

/** Ce dont chaque projet a besoin, et rien de plus. */
const LISTES = {
  api: [
    'DATABASE_URL',
    'DIRECT_URL',
    'WEB_ORIGIN',
    'ADMIN_ORIGIN',
    'APP_URL',
    'API_URL',
    'AUTH_SECRET',
    'AUTH_COOKIE_SAMESITE',
    'MAIL_FROM',
    'MAIL_SUPPORT_ADDRESS',
    'RESEND_API_KEY',
    'SMTP_HOST',
    'SMTP_PORT',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'EMAIL_SENDER_NAME',
    'FAPSHI_ENV',
    'FAPSHI_BASE_URL',
    'FAPSHI_API_USER',
    'FAPSHI_API_KEY',
    'FAPSHI_WEBHOOK_SECRET',
    'CLOUDINARY_URL',
    'OPENROUTER_API_KEY',
    'OPENROUTER_MODEL',
    'CRON_SECRET',
  ],
  // Le site et le back-office n'ont besoin que de l'adresse publique de l'API. Tout ce qui
  // porte le préfixe NEXT_PUBLIC_ est inscrit dans le JavaScript envoyé au navigateur :
  // n'y mettre jamais autre chose qu'une adresse publique.
  web: ['NEXT_PUBLIC_API_URL'],
  admin: ['NEXT_PUBLIC_API_URL'],
};

if (!cible || !(cible in LISTES)) {
  console.error('Usage : node scripts/vercel-env.mjs <api|web|admin> [--dry]');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

// Déduit l'adresse publique de l'API pour le site et le back-office.
env.NEXT_PUBLIC_API_URL ??= env.API_URL;

const manquantes = [];
let poussees = 0;

for (const nom of LISTES[cible]) {
  const valeur = env[nom];
  if (!valeur) {
    manquantes.push(nom);
    continue;
  }

  if (/\[YOUR-|\[VOTRE-|MOT_DE_PASSE|a-remplacer/i.test(valeur)) {
    console.log(`  ⚠ ${nom} : contient encore un texte de modèle, non poussée.`);
    manquantes.push(nom);
    continue;
  }

  console.log(`  ${simulation ? '(simulation) ' : ''}${nom} — ${valeur.length} caractères`);
  if (simulation) continue;

  for (const environnement of ['production', 'preview']) {
    execFileSync('vercel', ['env', 'add', nom, environnement, '--force'], {
      input: valeur,
      stdio: ['pipe', 'ignore', 'inherit'],
    });
  }
  poussees += 1;
}

console.log(
  simulation
    ? '\nSimulation terminée : rien n’a été poussé.'
    : `\n${poussees} variable(s) poussée(s) en production et en préproduction.`,
);

if (manquantes.length > 0) {
  console.log(`\nÀ renseigner avant de déployer : ${manquantes.join(', ')}`);
}
