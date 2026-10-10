# Files de tâches (PLAT-07)

`JobsService` (exporté par `PlatformModule`, `apps/api/src/platform/`) planifie des tâches nommées avec une charge utile JSON. Avec `REDIS_URL`, elles passent par BullMQ et survivent aux redémarrages ; sans Redis (poste du propriétaire, tests, `NODE_ENV=test`), elles vivent en mémoire et disparaissent à l'arrêt.

Pour planifier une tâche depuis un autre module :

1. Injecter `JobsService` (importer `PlatformModule` dans le module appelant).
2. Déclarer le traitement au démarrage, une fois par nom : `jobs.register('payments:reconcile', async ({ paymentId }) => { … })` (dans `onModuleInit`).
3. Tâche différée : `await jobs.schedule('payments:reconcile', { paymentId }, { delayMs: 5 * 60_000, jobId: 'reconcile-' + paymentId })` — un `jobId` stable remplace la tâche au lieu de la doubler.
4. Tâche récurrente : `await jobs.scheduleRepeating('rates:refresh', {}, { cron: '0 6 * * *' })` ou `{ everyMs: 3_600_000 }` ; l'identifiant vaut le nom par défaut, replanifier met la récurrence à jour.
5. Annuler : `await jobs.cancel(jobId)`. Une exception dans le traitement marque l'exécution `FAILED` avec son message.

La charge utile doit rester un objet JSON simple (identifiants, pas d'entités Prisma). État et historique : `GET /v1/admin/jobs` (rôles `ADMIN`, `SUPER_ADMIN`).
