import { z } from 'zod';

/**
 * Valeur facultative dont la chaîne vide vaut « non configurée ».
 *
 * Un fichier `.env` contient souvent des clés laissées vides en attendant d'être obtenues :
 * `FAPSHI_WEBHOOK_SECRET=`. L'API doit démarrer dans cet état et désactiver la fonction
 * concernée, pas refuser de se lancer.
 */
const optionalValue = (schema: z.ZodType<string> = z.string().min(1)) =>
  z
    .union([z.literal(''), schema])
    .optional()
    .transform((value) => (value ? value : undefined));

/** Variables d'environnement validées au démarrage : l'API refuse de démarrer si une valeur manque. */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: optionalValue(z.url()),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  ADMIN_ORIGIN: z.url().default('http://localhost:3001'),

  // ── Authentification ──
  /** URL publique de l'API : base des liens d'authentification. */
  API_URL: z.url().default('http://localhost:4000'),
  /** Secret de signature des sessions. Valeur aléatoire obligatoire en production. */
  AUTH_SECRET: z.string().min(32).default('dev-secret-a-remplacer-absolument-en-production'),

  // ── Notifications email ──
  /** Lien de base inséré dans les emails. */
  APP_URL: z.url().default('http://localhost:3000'),
  /** Absent en développement : les emails sont alors écrits dans MAIL_OUTBOX_DIR. */
  RESEND_API_KEY: optionalValue(),

  /**
   * Envoi SMTP, utilisé quand aucune clé Resend n'est configurée.
   * Avec Gmail, le mot de passe est un mot de passe d'application, jamais celui du compte.
   */
  SMTP_HOST: optionalValue(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: optionalValue(),
  /** Mot de passe d'application. `PASS_EMAIL` est accepté comme alias. */
  PASS_EMAIL: optionalValue(),
  EMAIL_PASSWORD: optionalValue(),
  /** Adresse du compte d'envoi, reprise comme identifiant SMTP par défaut. */
  EMAIL: optionalValue(z.email()),

  MAIL_FROM: z.string().min(3).default('berioletsague@gmail.com'),
  MAIL_REPLY_TO: optionalValue(z.email()),
  MAIL_SUPPORT_ADDRESS: z.email().default('support@warrior-sourcing.cm'),
  /** Destinataire des envois de test déclenchés depuis /v1/dev/emails. */
  MAIL_TEST_RECIPIENT: z.email().default('berioletsague@gmail.com'),
  MAIL_OUTBOX_DIR: z.string().default('.mail'),

  /**
   * Portée du cookie de session : `lax` ou `none`.
   *
   * Ce réglage décide si l'authentification fonctionne une fois déployée. En local, le
   * site et l'API partagent `localhost` : le cookie est envoyé avec `lax`, et tout marche.
   * En production, si le site est sur un domaine et l'API sur un autre — ce qui est le cas
   * dès que le site part sur Vercel et l'API ailleurs — le navigateur ne joint le cookie
   * qu'avec `SameSite=None; Secure`. Avec `lax`, chaque requête part sans session et
   * l'utilisateur est déconnecté en permanence, **sans aucune erreur visible**.
   *
   * `none` impose `Secure`, donc HTTPS : c'est le navigateur qui l'exige, pas nous.
   */
  AUTH_COOKIE_SAMESITE: z.enum(['lax', 'none']).default('lax'),

  // ── Paiement Fapshi (lot PAY) — voir docs/integrations/fapshi.md ──
  FAPSHI_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  FAPSHI_BASE_URL: optionalValue(z.url()),
  FAPSHI_API_USER: optionalValue(),
  FAPSHI_API_KEY: optionalValue(),
  FAPSHI_WEBHOOK_SECRET: optionalValue(),
  FAPSHI_BASE_URL_SANDBOX: optionalValue(z.url()),
  FAPSHI_API_USER_SANDBOX: optionalValue(),
  FAPSHI_API_KEY_SANDBOX: optionalValue(),
  /**
   * Relecture périodique de l'état des paiements encore ouverts, en millisecondes.
   * 0 — la valeur par défaut — désactive la tâche. Le module applique en plus un
   * plancher, pour ne pas épuiser la limite de débit de l'agrégateur.
   *
   * Elle doit figurer **ici** et pas seulement dans `.env` : la validation ne laisse
   * passer que les clés qu'elle connaît, et ce sont elles seules que Nest réinjecte
   * dans l'environnement du processus. Une variable absente de ce schéma est lue
   * comme absente, quoi qu'en dise le fichier.
   */
  PAYMENTS_RECONCILE_INTERVAL_MS: z.coerce.number().int().min(0).default(0),

  /**
   * Secret des tâches planifiées (`GET /v1/payments/reconciliation-planifiee`).
   *
   * Sans serveur, la réconciliation des paiements ne peut plus être un `setInterval` : le
   * processus ne vit pas entre deux requêtes. Le déclencheur vient donc de l'extérieur —
   * un cron Vercel — et ce secret est ce qui distingue le cron d'un inconnu.
   *
   * Absent, la route refuse tout le monde. C'est le bon défaut : une route qui relit des
   * paiements chez l'agrégateur ne doit pas être ouverte parce qu'une variable manque.
   */
  CRON_SECRET: optionalValue(),

  // ── Fonctions IA (lot AI) — passerelle unique, voir src/ai/ ──
  /**
   * Clé OpenRouter. **Absente, les fonctions IA se désactivent** au lieu d'échouer : une
   * plateforme dont le catalogue tombe parce qu'une clé d'assistant manque serait absurde.
   *
   * Elle doit figurer ici et pas seulement dans `.env` : la validation ne laisse passer
   * que les clés qu'elle connaît, et ce sont elles seules que Nest réinjecte dans
   * l'environnement. Une variable absente de ce schéma est lue comme absente, quoi qu'en
   * dise le fichier — c'est exactement ce qui se passait pour celle-ci.
   */
  OPENROUTER_API_KEY: optionalValue(),
  OPENROUTER_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  /**
   * Modèle employé. Nommé dans la configuration et non dans le code : c'est tout l'intérêt
   * d'une passerelle — changer de modèle ne doit pas demander un déploiement.
   */
  OPENROUTER_MODEL: z.string().default('anthropic/claude-haiku-5.5'),

  // ── Fichiers (lot PLAT) ──
  /** Format cloudinary://<api_key>:<api_secret>@<cloud_name> */
  CLOUDINARY_URL: optionalValue(z.string().startsWith('cloudinary://')),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
