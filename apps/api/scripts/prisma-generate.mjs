import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Génère le client Prisma après avoir vidé sa cible.
 *
 * Deux générations lancées en même temps (install, prebuild, tâche Turbo) laissaient un
 * dossier à moitié écrit, que Prisma refusait ensuite d'écraser. Repartir d'un dossier vide
 * rend l'opération sûre quel que soit l'ordre d'exécution.
 *
 * Sous Windows, un éditeur ou un serveur de types garde parfois un fichier généré ouvert :
 * la suppression échoue alors en EPERM ou ENOTEMPTY. On réessaie quelques fois, puis on
 * passe outre — Prisma réécrit ses fichiers par-dessus, et un verrou passager ne doit pas
 * faire échouer une compilation.
 */
const root = fileURLToPath(new URL('..', import.meta.url));

try {
  rmSync(new URL('../src/generated/prisma', import.meta.url), {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
} catch (erreur) {
  console.warn(`Dossier généré non supprimé (${erreur.code}) : Prisma va le réécrire.`);
}
execFileSync('pnpm', ['exec', 'prisma', 'generate'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
