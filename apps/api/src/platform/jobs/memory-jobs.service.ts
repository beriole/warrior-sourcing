import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { JobStatus, JobSummary } from '@ws/contracts';
import { CronExpressionParser } from 'cron-parser';
import {
  assertRepeatOptions,
  JobsService,
  type JobHandler,
  type JobPayload,
  type RepeatOptions,
  type ScheduledJob,
  type ScheduleOptions,
} from './jobs.service.js';

type MemoryJob = {
  id: string;
  name: string;
  kind: 'DELAYED' | 'REPEATING';
  payload: JobPayload;
  schedule: string | null;
  status: JobStatus;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastError: string | null;
  runs: number;
  createdAt: Date;
  timer: NodeJS.Timeout | null;
  /** Calcule la prochaine échéance d'une récurrence, `null` pour une tâche unique. */
  next: ((from: Date) => Date) | null;
};

/** Combien de tâches terminées restent visibles dans la liste d'administration. */
const FINISHED_HISTORY = 100;

/** Borne de `setTimeout` (2^31 - 1 ms) : au-delà, Node déclencherait immédiatement. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * File en mémoire : rien n'est persisté, tout disparaît au redémarrage.
 * C'est l'implémentation du développement sans Redis et des tests.
 */
@Injectable()
export class MemoryJobsService extends JobsService implements OnModuleDestroy {
  readonly backend = 'MEMORY' as const;

  private readonly logger = new Logger('Tâches');
  private readonly handlers = new Map<string, JobHandler>();
  private readonly jobs = new Map<string, MemoryJob>();

  register<P extends JobPayload>(name: string, handler: JobHandler<P>): void {
    this.handlers.set(name, handler as JobHandler);
  }

  async schedule(name: string, payload: JobPayload, options: ScheduleOptions = {}): Promise<ScheduledJob> {
    const id = options.jobId ?? randomUUID();
    this.remove(id);

    const delayMs = Math.max(0, options.delayMs ?? 0);
    const job = this.create({
      id,
      name,
      kind: 'DELAYED',
      payload,
      schedule: null,
      nextRunAt: new Date(Date.now() + delayMs),
      next: null,
    });
    this.arm(job);
    return { id };
  }

  async scheduleRepeating(name: string, payload: JobPayload, options: RepeatOptions): Promise<ScheduledJob> {
    assertRepeatOptions(options);
    const id = options.jobId ?? name;
    this.remove(id);

    const next =
      typeof options.everyMs === 'number'
        ? (from: Date) => new Date(from.getTime() + (options.everyMs as number))
        : (from: Date) => CronExpressionParser.parse(options.cron as string, { currentDate: from }).next().toDate();

    const now = new Date();
    const job = this.create({
      id,
      name,
      kind: 'REPEATING',
      payload,
      schedule: typeof options.everyMs === 'number' ? `${options.everyMs}ms` : (options.cron as string),
      nextRunAt: next(now),
      next,
    });
    this.arm(job);
    return { id };
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || !job.timer) return false;
    clearTimeout(job.timer);
    job.timer = null;
    job.status = 'CANCELLED';
    job.nextRunAt = null;
    return true;
  }

  async list(): Promise<JobSummary[]> {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((job) => ({
        id: job.id,
        name: job.name,
        kind: job.kind,
        status: job.status,
        payload: job.payload,
        schedule: job.schedule,
        nextRunAt: job.nextRunAt?.toISOString() ?? null,
        lastRunAt: job.lastRunAt?.toISOString() ?? null,
        lastError: job.lastError,
        runs: job.runs,
        createdAt: job.createdAt.toISOString(),
      }));
  }

  onModuleDestroy(): void {
    for (const job of this.jobs.values()) {
      if (job.timer) clearTimeout(job.timer);
      job.timer = null;
    }
    this.jobs.clear();
  }

  private create(
    input: Pick<MemoryJob, 'id' | 'name' | 'kind' | 'payload' | 'schedule' | 'nextRunAt' | 'next'>,
  ): MemoryJob {
    const job: MemoryJob = {
      ...input,
      status: 'SCHEDULED',
      lastRunAt: null,
      lastError: null,
      runs: 0,
      createdAt: new Date(),
      timer: null,
    };
    this.jobs.set(job.id, job);
    this.trimHistory();
    return job;
  }

  private remove(id: string): void {
    const previous = this.jobs.get(id);
    if (previous?.timer) clearTimeout(previous.timer);
    this.jobs.delete(id);
  }

  /** Programme la prochaine exécution. Le minuteur ne retient pas le processus (`unref`). */
  private arm(job: MemoryJob): void {
    if (!job.nextRunAt) return;
    const delay = Math.min(MAX_TIMER_MS, Math.max(0, job.nextRunAt.getTime() - Date.now()));
    // Une récurrence garde le résultat de sa dernière exécution ; seule la première attente est « planifiée ».
    if (job.runs === 0) job.status = 'SCHEDULED';
    job.timer = setTimeout(() => void this.run(job), delay);
    job.timer.unref();
  }

  private async run(job: MemoryJob): Promise<void> {
    job.timer = null;
    const handler = this.handlers.get(job.name);
    job.status = 'RUNNING';
    job.lastRunAt = new Date();
    job.runs += 1;

    try {
      if (!handler) throw new Error(`Aucun traitement déclaré pour la tâche « ${job.name} ».`);
      await handler(job.payload, { jobId: job.id, name: job.name });
      job.status = 'COMPLETED';
      job.lastError = null;
    } catch (error) {
      job.status = 'FAILED';
      job.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tâche « ${job.name} » (${job.id}) en échec : ${job.lastError}`);
    }

    if (job.next && this.jobs.get(job.id) === job) {
      job.nextRunAt = job.next(new Date());
      this.arm(job);
    } else {
      job.nextRunAt = null;
    }
  }

  /** Évite une croissance sans fin : seules les dernières tâches terminées sont conservées. */
  private trimHistory(): void {
    const finished = [...this.jobs.values()]
      .filter((job) => job.timer === null && job.status !== 'RUNNING' && job.status !== 'SCHEDULED')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const job of finished.slice(0, Math.max(0, finished.length - FINISHED_HISTORY))) {
      this.jobs.delete(job.id);
    }
  }
}
