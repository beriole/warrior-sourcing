import type { JobsBackend, JobSummary } from '@ws/contracts';

/** Charge utile d'une tâche : un objet sérialisable en JSON, jamais une instance de classe. */
export type JobPayload = Record<string, unknown>;

/** Traitement associé à un nom de tâche. Une exception marque l'exécution comme échouée. */
export type JobHandler<P extends JobPayload = JobPayload> = (
  payload: P,
  context: { jobId: string; name: string },
) => Promise<void> | void;

export type ScheduleOptions = {
  /** Délai avant exécution, en millisecondes (0 : dès que possible). */
  delayMs?: number;
  /** Identifiant stable : replanifier avec le même identifiant remplace la tâche au lieu de la doubler. */
  jobId?: string;
};

export type RepeatOptions = {
  /** Intervalle en millisecondes. Exclusif avec `cron`. */
  everyMs?: number;
  /** Expression cron à cinq ou six champs. Exclusive avec `everyMs`. */
  cron?: string;
  /** Identifiant stable de la récurrence ; par défaut, le nom de la tâche. */
  jobId?: string;
};

export type ScheduledJob = { id: string };

/**
 * File de tâches (PLAT-07).
 *
 * Un module déclare ses traitements avec `register`, puis planifie des tâches différées ou
 * récurrentes par leur nom. Deux implémentations : BullMQ sur Redis quand `REDIS_URL` est
 * défini (les tâches survivent à un redémarrage), et une file en mémoire sinon (développement
 * sans Redis, tests). Le choix se fait au démarrage, dans `PlatformModule`.
 */
export abstract class JobsService {
  abstract readonly backend: JobsBackend;

  /** Déclare le traitement d'un nom de tâche. Un seul traitement par nom : le dernier déclaré gagne. */
  abstract register<P extends JobPayload>(name: string, handler: JobHandler<P>): void;

  /** Planifie une exécution unique. */
  abstract schedule(name: string, payload: JobPayload, options?: ScheduleOptions): Promise<ScheduledJob>;

  /** Planifie une exécution récurrente. Replanifier avec le même identifiant met la récurrence à jour. */
  abstract scheduleRepeating(name: string, payload: JobPayload, options: RepeatOptions): Promise<ScheduledJob>;

  /** Annule une tâche ou une récurrence. Vrai si quelque chose a été annulé. */
  abstract cancel(jobId: string): Promise<boolean>;

  /** Tâches connues et leur dernier état, pour le tableau de bord d'administration. */
  abstract list(): Promise<JobSummary[]>;
}

/** Vérifie une demande de récurrence, quel que soit le moteur. */
export function assertRepeatOptions(options: RepeatOptions): void {
  const hasEvery = typeof options.everyMs === 'number';
  const hasCron = typeof options.cron === 'string' && options.cron.trim() !== '';
  if (hasEvery === hasCron) {
    throw new Error('Une tâche récurrente demande soit un intervalle (everyMs), soit une expression cron, pas les deux.');
  }
  if (hasEvery && (!Number.isInteger(options.everyMs) || (options.everyMs as number) <= 0)) {
    throw new Error('L’intervalle d’une tâche récurrente doit être un entier positif en millisecondes.');
  }
}
