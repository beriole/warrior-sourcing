import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { JobStatus, JobSummary } from '@ws/contracts';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import {
  assertRepeatOptions,
  JobsService,
  type JobHandler,
  type JobPayload,
  type RepeatOptions,
  type ScheduledJob,
  type ScheduleOptions,
} from './jobs.service.js';

/** Une seule file pour toute l'application : le nom de la tâche sert d'aiguillage. */
const QUEUE_NAME = 'warrior-sourcing';

/** Historique conservé dans Redis pour la liste d'administration. */
const KEEP_FINISHED = 100;

/**
 * File BullMQ sur Redis : les tâches survivent aux redémarrages et plusieurs instances
 * de l'API peuvent se partager le travail. Activée quand `REDIS_URL` est défini.
 */
@Injectable()
export class BullMqJobsService extends JobsService implements OnModuleInit, OnModuleDestroy {
  readonly backend = 'REDIS' as const;

  private readonly logger = new Logger('Tâches');
  private readonly handlers = new Map<string, JobHandler>();
  private readonly connection: Redis;
  private readonly queue: Queue<JobPayload>;
  private worker: Worker<JobPayload> | null = null;

  constructor(redisUrl: string) {
    super();
    // BullMQ exige des commandes bloquantes sans limite de tentatives.
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
    this.connection.on('error', (error: Error) => this.logger.error(`Redis : ${error.message}`));
    this.queue = new Queue<JobPayload>(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: { count: KEEP_FINISHED },
        removeOnFail: { count: KEEP_FINISHED },
        attempts: 1,
      },
    });
  }

  onModuleInit(): void {
    this.worker = new Worker<JobPayload>(QUEUE_NAME, (job) => this.process(job), { connection: this.connection });
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Tâche « ${job?.name ?? '?'} » (${job?.id ?? '?'}) en échec : ${error.message}`);
    });
    this.worker.on('error', (error) => this.logger.error(`File : ${error.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit().catch(() => undefined);
  }

  register<P extends JobPayload>(name: string, handler: JobHandler<P>): void {
    this.handlers.set(name, handler as JobHandler);
  }

  async schedule(name: string, payload: JobPayload, options: ScheduleOptions = {}): Promise<ScheduledJob> {
    const id = options.jobId ?? randomUUID();
    if (options.jobId) {
      // Même identifiant : on remplace la tâche en attente au lieu de la doubler.
      await this.queue.remove(options.jobId).catch(() => undefined);
    }
    const job = await this.queue.add(name, payload, { jobId: id, delay: Math.max(0, options.delayMs ?? 0) });
    return { id: job.id ?? id };
  }

  async scheduleRepeating(name: string, payload: JobPayload, options: RepeatOptions): Promise<ScheduledJob> {
    assertRepeatOptions(options);
    const id = options.jobId ?? name;
    await this.queue.upsertJobScheduler(
      id,
      typeof options.everyMs === 'number' ? { every: options.everyMs } : { pattern: options.cron as string },
      { name, data: payload },
    );
    return { id };
  }

  async cancel(jobId: string): Promise<boolean> {
    const removedScheduler = await this.queue.removeJobScheduler(jobId);
    const removedJob = await this.queue.remove(jobId);
    return removedScheduler || removedJob === 1;
  }

  async list(): Promise<JobSummary[]> {
    const [jobs, schedulers] = await Promise.all([
      this.queue.getJobs(['delayed', 'waiting', 'prioritized', 'active', 'completed', 'failed']),
      this.queue.getJobSchedulers(),
    ]);

    const repeating: JobSummary[] = schedulers.map((scheduler) => ({
      id: scheduler.key,
      name: scheduler.name,
      kind: 'REPEATING',
      status: 'SCHEDULED',
      payload: scheduler.template?.data ?? null,
      schedule: scheduler.pattern ?? (scheduler.every ? `${scheduler.every}ms` : null),
      nextRunAt: scheduler.next ? new Date(scheduler.next).toISOString() : null,
      lastRunAt: null,
      lastError: null,
      runs: scheduler.iterationCount ?? 0,
      createdAt: new Date(scheduler.startDate ?? Date.now()).toISOString(),
    }));

    const delayed = await Promise.all(
      jobs.map(async (job): Promise<JobSummary> => {
        const state = await job.getState();
        return {
          id: job.id ?? '',
          name: job.name,
          kind: job.repeatJobKey ? 'REPEATING' : 'DELAYED',
          status: toStatus(state),
          payload: job.data,
          schedule: null,
          nextRunAt: state === 'delayed' ? new Date(job.timestamp + (job.delay ?? 0)).toISOString() : null,
          lastRunAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
          lastError: job.failedReason || null,
          runs: job.attemptsMade,
          createdAt: new Date(job.timestamp).toISOString(),
        };
      }),
    );

    return [...repeating, ...delayed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private async process(job: Job<JobPayload>): Promise<void> {
    const handler = this.handlers.get(job.name);
    if (!handler) throw new Error(`Aucun traitement déclaré pour la tâche « ${job.name} ».`);
    await handler(job.data, { jobId: job.id ?? '', name: job.name });
  }
}

function toStatus(state: string): JobStatus {
  switch (state) {
    case 'active':
      return 'RUNNING';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    default:
      return 'SCHEDULED';
  }
}
