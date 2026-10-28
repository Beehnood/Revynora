import {
  Inject,
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import nodemailer from "nodemailer";
import { DatabaseService } from "../../database/database.service";
import { GetLearningAccess } from "../../learning-access/application/learning-access";
@Injectable()
export class ReminderWorker implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;
  private redis?: Redis;
  private timer?: ReturnType<typeof setInterval>;
  private scanning = false;
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(GetLearningAccess) private readonly access: GetLearningAccess,
  ) {}
  async onModuleInit() {
    if (process.env.WORKER_ENABLED === "false") return;
    this.redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6380", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.redis.on("error", () => {});
    const connection = {
      ...(process.env.REDIS_URL?.startsWith("rediss:") ? { tls: {} } : {}),
      host: this.redis.options.host,
      port: this.redis.options.port,
      password: this.redis.options.password,
      username: this.redis.options.username,
      db: this.redis.options.db,
      maxRetriesPerRequest: null,
    };
    const name = process.env.QUEUE_NAME ?? "revynora-reminders";
    this.queue = new Queue(name, { connection });
    this.queue.on("error", () => {});
    this.worker = new Worker(
      name,
      async (job) => {
        await this.deliver(String(job.data.id));
      },
      { connection, concurrency: 2 },
    );
    this.worker.on("error", () => {});
    this.timer = setInterval(() => {
      void this.scan();
    }, 15000);
    this.timer.unref();
    void this.scan();
  }
  async scan() {
    if (this.scanning || !this.queue) return;
    this.scanning = true;
    try {
      const rows = await this.db.client.reminderDelivery.findMany({
        where: { status: "PENDING" },
        orderBy: { dueAt: "asc" },
        take: 1000,
      });
      for (const row of rows)
        await this.queue.add(
          "reminder",
          { id: row.id },
          {
            jobId: "reminder-" + row.id,
            delay: Math.max(0, +row.dueAt - Date.now()),
            attempts: 5,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: { age: 86400 },
            removeOnFail: { age: 604800 },
          },
        );
      const emails = await this.db.client.emailMessage.findMany({
        where: { status: "QUEUED", kind: { not: "REMINDER" } },
        take: 50,
      });
      for (const email of emails) await this.send(email.id);
    } catch {
      /* PostgreSQL outbox remains pending; next scan retries. */
    } finally {
      this.scanning = false;
    }
  }
  async deliver(id: string) {
    const row = await this.db.client.reminderDelivery.findUnique({
      where: { id },
    });
    if (!row || row.status !== "PENDING") return;
    if (row.dueAt > new Date()) throw new Error("Reminder not due yet");
    const item = await this.db.client.studyPlanItem.findUnique({
      where: { id: row.itemId },
      include: { plan: true },
    });
    if (!item) {
      await this.db.client.reminderDelivery.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      return;
    }
    await this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${item.plan.userId} FOR UPDATE`;
      const delivery = await tx.reminderDelivery.findUnique({ where: { id } });
      if (delivery?.status !== "PENDING") return;
      const user = await tx.user.findUnique({
        where: { id: item.plan.userId },
      });
      const fresh = await tx.studyPlanItem.findUnique({
        where: { id: item.id },
      });
      const rights = await this.access.execute(item.plan.userId);
      if (
        !user ||
        user.disabledAt ||
        !user.remindersEnabled ||
        !rights.planning ||
        rights.reminders === false ||
        !fresh ||
        fresh.version !== row.version ||
        fresh.status !== "PLANNED" ||
        fresh.startsAt <= new Date()
      ) {
        await tx.reminderDelivery.update({
          where: { id },
          data: { status: "CANCELLED" },
        });
        return;
      }
      const email = await tx.emailMessage.upsert({
        where: { idempotencyKey: "reminder_" + id },
        create: {
          userId: user.id,
          kind: "REMINDER",
          subject: "Votre séance de révision approche",
          body: `${fresh.title} · ${fresh.startsAt.toLocaleString("fr-FR", { timeZone: user.timeZone })} (${user.timeZone})`,
          idempotencyKey: "reminder_" + id,
        },
        update: {},
      });
      if ((process.env.MAIL_PROVIDER ?? "local") === "local") {
        await tx.emailMessage.update({
          where: { id: email.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            attempts: { increment: 1 },
          },
        });
        await tx.reminderDelivery.update({
          where: { id },
          data: { status: "SENT" },
        });
      }
    });
    const email = await this.db.client.emailMessage.findUnique({
      where: { idempotencyKey: "reminder_" + id },
    });
    if (email?.status === "QUEUED") {
      await this.send(email.id);
      const sent = await this.db.client.emailMessage.findUnique({
        where: { id: email.id },
      });
      await this.db.client.reminderDelivery.update({
        where: { id },
        data: { status: sent?.status === "SENT" ? "SENT" : "CANCELLED" },
      });
    }
  }
  async send(id: string) {
    try {
      await this.db.client.$transaction(
        async (tx) => {
          const initial = await tx.emailMessage.findUnique({ where: { id } });
          if (!initial) return;
          await tx.$queryRaw`SELECT id FROM "User" WHERE id=${initial.userId} FOR UPDATE`;
          const email = await tx.emailMessage.findUnique({
            where: { id },
            include: { user: true },
          });
          if (!email || email.status !== "QUEUED") return;
          if (email.kind === "REMINDER") {
            const delivery = await tx.reminderDelivery.findUnique({
              where: { id: email.idempotencyKey.slice("reminder_".length) },
            });
            const item = delivery
              ? await tx.studyPlanItem.findUnique({
                  where: { id: delivery.itemId },
                })
              : null;
            if (
              !email.user.remindersEnabled ||
              email.user.disabledAt ||
              !(await this.access.execute(email.userId)).planning ||
              !delivery ||
              delivery.status !== "PENDING" ||
              !item ||
              item.version !== delivery.version ||
              item.status !== "PLANNED" ||
              item.startsAt <= new Date()
            ) {
              await tx.emailMessage.update({
                where: { id },
                data: { status: "CANCELLED" },
              });
              return;
            }
          }
          const provider = process.env.MAIL_PROVIDER ?? "local";
          if (provider === "smtp") {
            if (!process.env.SMTP_HOST || !process.env.MAIL_FROM)
              throw new Error("SMTP configuration missing");
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT ?? 587),
              secure: process.env.SMTP_SECURE === "true",
              connectionTimeout: 5000,
              greetingTimeout: 5000,
              socketTimeout: 5000,
              auth: process.env.SMTP_USER
                ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                  }
                : undefined,
            });
            await transporter.sendMail({
              from: process.env.MAIL_FROM,
              to: email.user.email,
              subject: email.subject,
              text: email.body,
              messageId: "<" + email.id + "@revynora.local>",
            });
          } else if (provider !== "local")
            throw new Error("Invalid MAIL_PROVIDER");
          await tx.emailMessage.update({
            where: { id },
            data: {
              status: "SENT",
              provider,
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
        },
        { timeout: 15000 },
      );
    } catch (error) {
      const email = await this.db.client.emailMessage.findUnique({
        where: { id },
      });
      if (email?.status === "QUEUED")
        await this.db.client.emailMessage.update({
          where: { id },
          data: {
            attempts: { increment: 1 },
            ...(email.attempts >= 4 ? { status: "FAILED" } : {}),
          },
        });
      throw error;
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
    this.redis?.disconnect();
  }
}
