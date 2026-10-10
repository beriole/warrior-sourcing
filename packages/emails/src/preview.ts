import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EMAIL_KEYS, getEmail, type EmailKey } from './registry.js';
import { renderEmail } from './render.js';

export type PreviewEntry = {
  key: EmailKey;
  fixture: string;
  subject: string;
  file: string;
  textFile: string;
};

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Génère un site statique de prévisualisation : un fichier par couple template × jeu de données,
 * plus un index permettant de basculer entre largeur mobile et largeur bureau.
 * Aucun serveur n'est nécessaire : on ouvre index.html dans un navigateur.
 */
export async function buildPreviewSite(outDir: string): Promise<PreviewEntry[]> {
  await mkdir(outDir, { recursive: true });

  const entries: PreviewEntry[] = [];

  for (const key of EMAIL_KEYS) {
    for (const fixture of Object.keys(getEmail(key).fixtures)) {
      const data = getEmail(key).fixtures[fixture];
      const { subject, html, text } = await renderEmail(key, data, { pretty: true });

      const file = `${key}--${slug(fixture)}.html`;
      const textFile = `${key}--${slug(fixture)}.txt`;
      await writeFile(join(outDir, file), html, 'utf8');
      await writeFile(join(outDir, textFile), `Objet : ${subject}\n\n${text}`, 'utf8');

      entries.push({ key, fixture, subject, file, textFile });
    }
  }

  await writeFile(join(outDir, 'index.html'), indexPage(entries), 'utf8');
  return entries;
}

function indexPage(entries: PreviewEntry[]): string {
  const grouped = new Map<EmailKey, PreviewEntry[]>();
  for (const entry of entries) {
    grouped.set(entry.key, [...(grouped.get(entry.key) ?? []), entry]);
  }

  const nav = [...grouped.entries()]
    .map(([key, items]) => {
      const definition = getEmail(key);
      const links = items
        .map(
          (item) =>
            `<li><button type="button" data-file="${item.file}" data-text="${item.textFile}" data-subject="${escapeHtml(
              item.subject,
            )}">${escapeHtml(item.fixture)}</button></li>`,
        )
        .join('');
      return `<section>
        <h2>${escapeHtml(definition.name)}</h2>
        <p>${escapeHtml(definition.description)}</p>
        <ul>${links}</ul>
      </section>`;
    })
    .join('');

  const first = entries[0];

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Prévisualisation des emails — Warrior Sourcing</title>
    <style>
      :root { color-scheme: dark; --line: #2a2a33; --gold: #d4a537; }
      * { box-sizing: border-box; }
      body { margin: 0; display: grid; grid-template-columns: 300px 1fr; height: 100vh;
             font: 14px/1.5 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0c0c10; color: #f3efe8; }
      aside { overflow-y: auto; border-right: 1px solid var(--line); padding: 18px; }
      aside h1 { font-size: 15px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 4px; }
      aside h1 span { color: var(--gold); }
      aside section { margin-top: 20px; }
      aside h2 { font-size: 13px; margin: 0; }
      aside p { margin: 2px 0 8px; font-size: 12px; color: #a9a29a; }
      aside ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
      aside button { width: 100%; text-align: left; cursor: pointer; padding: 7px 10px; border-radius: 7px;
                     border: 1px solid var(--line); background: #17171e; color: inherit; font-size: 13px; }
      aside button:hover { border-color: var(--gold); }
      aside button[aria-current='true'] { background: #c8102e; border-color: #c8102e; }
      main { display: flex; flex-direction: column; min-width: 0; }
      header { padding: 12px 18px; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: center; }
      header strong { font-size: 13px; font-weight: 600; }
      header .spacer { flex: 1; }
      header button, header a { border: 1px solid var(--line); background: #17171e; color: inherit; border-radius: 999px;
                                padding: 6px 12px; font-size: 12px; cursor: pointer; text-decoration: none; }
      header button[aria-pressed='true'] { background: var(--gold); color: #141417; border-color: var(--gold); }
      .stage { flex: 1; overflow: auto; display: flex; justify-content: center; padding: 20px; background: #08080b; }
      iframe { width: 680px; max-width: 100%; height: 100%; min-height: 900px; border: 1px solid var(--line);
               border-radius: 10px; background: #fff; transition: width .2s ease; }
    </style>
  </head>
  <body>
    <aside>
      <h1>Warrior <span>Sourcing</span></h1>
      <p>Prévisualisation des emails</p>
      ${nav}
    </aside>
    <main>
      <header>
        <strong id="subject">${first ? escapeHtml(first.subject) : ''}</strong>
        <span class="spacer"></span>
        <button type="button" data-width="390">Mobile 390</button>
        <button type="button" data-width="680" aria-pressed="true">Bureau 680</button>
        <a id="text-link" href="${first?.textFile ?? '#'}" target="_blank" rel="noreferrer">Version texte</a>
      </header>
      <div class="stage"><iframe id="frame" title="Aperçu de l'email" src="${first?.file ?? ''}"></iframe></div>
    </main>
    <script>
      const frame = document.getElementById('frame');
      const subject = document.getElementById('subject');
      const textLink = document.getElementById('text-link');
      const buttons = [...document.querySelectorAll('aside button')];

      buttons.forEach((button, index) => {
        if (index === 0) button.setAttribute('aria-current', 'true');
        button.addEventListener('click', () => {
          buttons.forEach((other) => other.removeAttribute('aria-current'));
          button.setAttribute('aria-current', 'true');
          frame.src = button.dataset.file;
          subject.textContent = button.dataset.subject;
          textLink.href = button.dataset.text;
        });
      });

      document.querySelectorAll('header button[data-width]').forEach((button) => {
        button.addEventListener('click', () => {
          document.querySelectorAll('header button[data-width]').forEach((other) => other.setAttribute('aria-pressed', 'false'));
          button.setAttribute('aria-pressed', 'true');
          frame.style.width = button.dataset.width + 'px';
        });
      });
    </script>
  </body>
</html>
`;
}
