/**
 * Pose une variable d'environnement sur le projet Vercel lié au dossier courant.
 *
 *   node scripts/vercel-url.mjs NEXT_PUBLIC_API_URL https://…
 *
 * Réservé aux **adresses**, pas aux secrets : les valeurs passent par la ligne de commande
 * et seraient visibles dans l'historique du shell. Pour un secret, `vercel-env.mjs` lit
 * `.env` et écrit sur l'entrée standard.
 *
 * `--type config` plutôt que le défaut « secret » : une adresse publique doit rester
 * lisible dans le tableau de bord et récupérable par `vercel env pull`. La masquer
 * n'apporte rien et rend le diagnostic pénible.
 */
import { execFileSync } from 'node:child_process';

const [, , nom, valeur] = process.argv;

if (!nom || !valeur) {
  console.error('Usage : node scripts/vercel-url.mjs <NOM> <valeur>');
  process.exit(1);
}

if (!/^https?:\/\//.test(valeur)) {
  console.error('Ce script ne pose que des adresses (http:// ou https://).');
  process.exit(1);
}

const VERCEL = process.platform === 'win32' ? 'vercel.cmd' : 'vercel';

for (const environnement of ['production', 'preview']) {
  execFileSync(VERCEL, ['env', 'add', nom, environnement, '--force', '--type', 'config'], {
    input: valeur,
    stdio: ['pipe', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
  });
}

console.log(`${nom} = ${valeur}`);
