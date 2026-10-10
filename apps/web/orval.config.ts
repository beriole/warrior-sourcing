import { defineConfig } from 'orval';

/**
 * Génère le client HTTP et les hooks TanStack Query à partir du contrat OpenAPI de l'API.
 *
 * Le contrat est un fichier versionné (`apps/api/openapi.json`), pas une API qui tourne :
 * la génération marche hors ligne et une modification du contrat se voit dans la revue de code.
 * Régénérer : `pnpm --filter @ws/api openapi:dump && pnpm --filter @ws/web generate:api`.
 */
export default defineConfig({
  api: {
    input: '../api/openapi.json',
    output: {
      target: 'src/api/generated.ts',
      schemas: 'src/api/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        // Le transport vit hors du dossier généré, que `clean` efface à chaque exécution.
        mutator: { path: 'src/lib/api-fetcher.ts', name: 'apiRequest' },
        query: { useQuery: true, signal: true },
        // Le transport renvoie déjà le corps analysé : pas d'enveloppe supplémentaire.
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
