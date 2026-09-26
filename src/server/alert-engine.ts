import { and, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { alertDispatches, cronRuns, equipments, organizations, users } from "@/db/schema";
import { alertLevelFor, renderAlertEmail, type AlertItem } from "@/lib/alerts";
import { addDays, daysUntil, todayIso } from "@/lib/dates";
import { EmailError, type EmailSender } from "@/lib/email";
import { withRetry } from "@/lib/retry";

export const EXPIRATION_JOB = "check-expirations";
/** Nombre maximal de jours rattrapés si le cron n'a pas tourné. */
const MAX_CATCH_UP_DAYS = 7;

export interface ExpirationRunOptions {
  sender: EmailSender;
  appUrl: string;
  now?: Date;
  retries?: number;
  retryBaseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

export interface ExpirationRunSummary {
  runId: string;
  runDate: string;
  since: string;
  status: "success" | "partial" | "failed";
  organizationsWithAlerts: number;
  organizationsProcessed: number;
  alreadySent: number;
  emailsSent: number;
  emailsFailed: number;
  recipients: number;
  equipmentAlerts: number;
}

const defaultLog = (message: string, data?: Record<string, unknown>) =>
  console.info(JSON.stringify({ job: EXPIRATION_JOB, message, ...data }));

/** Premier jour à couvrir : lendemain de la dernière exécution aboutie (borné). */
async function computeSince(today: string): Promise<string> {
  const [last] = await db
    .select({ day: sql<string>`(${cronRuns.startedAt} at time zone 'UTC')::date::text` })
    .from(cronRuns)
    .where(
      and(eq(cronRuns.job, EXPIRATION_JOB), inArray(cronRuns.status, ["success", "partial"])),
    )
    .orderBy(desc(cronRuns.startedAt))
    .limit(1);
  if (!last) return today;
  const candidate = addDays(last.day, 1);
  const floor = addDays(today, -MAX_CATCH_UP_DAYS);
  if (daysUntil(candidate, today) > 0) return today; // candidate > today
  return candidate < floor ? floor : candidate;
}

/**
 * Moteur d'alertes quotidien (§3.D).
 *  1. Sélectionne les équipements à J-30, J-7, J-0 ou échus (toutes organisations).
 *  2. Regroupe par org_id et envoie UN e-mail récapitulatif par organisation
 *     aux utilisateurs admin/technician.
 *  3. Chaque envoi est tracé dans alert_dispatches (unique par org et par jour) :
 *     une nouvelle exécution le même jour ne renvoie pas les e-mails déjà
 *     partis et reprend uniquement les envois en échec.
 *  4. Les erreurs transitoires sont retentées avec temporisation exponentielle.
 *  5. L'exécution est consignée dans cron_runs et dans les logs.
 */
export async function runExpirationCheck(opts: ExpirationRunOptions): Promise<ExpirationRunSummary> {
  const log = opts.log ?? defaultLog;
  const now = opts.now ?? new Date();
  const today = todayIso(now);

  const since = await computeSince(today);
  const [run] = await db
    .insert(cronRuns)
    .values({ job: EXPIRATION_JOB, startedAt: now })
    .returning({ id: cronRuns.id });

  const summary: ExpirationRunSummary = {
    runId: run.id,
    runDate: today,
    since,
    status: "success",
    organizationsWithAlerts: 0,
    organizationsProcessed: 0,
    alreadySent: 0,
    emailsSent: 0,
    emailsFailed: 0,
    recipients: 0,
    equipmentAlerts: 0,
  };
  log("start", { runId: run.id, runDate: today, since });

  try {
    const candidates = await db
      .select({
        equipmentId: equipments.id,
        orgId: equipments.orgId,
        orgName: organizations.name,
        internalId: equipments.internalId,
        name: equipments.name,
        location: equipments.location,
        nextCalibrationDate: equipments.nextCalibrationDate,
      })
      .from(equipments)
      .innerJoin(organizations, eq(organizations.id, equipments.orgId))
      .where(lte(equipments.nextCalibrationDate, addDays(today, 30)));

    // Organisations dont un envoi précédent a échoué : on rattrape depuis ce jour-là.
    const failed = await db
      .select({ orgId: alertDispatches.orgId, day: sql<string>`min(${alertDispatches.runDate})::text` })
      .from(alertDispatches)
      .where(
        and(
          eq(alertDispatches.status, "failed"),
          gte(alertDispatches.runDate, addDays(today, -MAX_CATCH_UP_DAYS)),
          lt(alertDispatches.runDate, today),
        ),
      )
      .groupBy(alertDispatches.orgId);
    const sinceByOrg = new Map(failed.map((f) => [f.orgId, f.day < since ? f.day : since]));

    const byOrg = new Map<string, { orgName: string; items: AlertItem[] }>();
    for (const c of candidates) {
      if (!c.orgId) continue;
      const level = alertLevelFor(c.nextCalibrationDate, today, sinceByOrg.get(c.orgId) ?? since);
      if (!level) continue;
      const group = byOrg.get(c.orgId) ?? { orgName: c.orgName, items: [] };
      group.items.push({
        equipmentId: c.equipmentId,
        internalId: c.internalId,
        name: c.name,
        location: c.location,
        nextCalibrationDate: c.nextCalibrationDate,
        level,
        daysLeft: daysUntil(c.nextCalibrationDate, today),
      });
      byOrg.set(c.orgId, group);
    }
    summary.organizationsWithAlerts = byOrg.size;

    for (const [orgId, group] of byOrg) {
      const outcome = await dispatchForOrg(orgId, group.orgName, group.items, today, opts, log);
      summary.organizationsProcessed++;
      summary.equipmentAlerts += group.items.length;
      if (outcome.kind === "already_sent") summary.alreadySent++;
      if (outcome.kind === "sent") {
        summary.emailsSent++;
        summary.recipients += outcome.recipients;
      }
      if (outcome.kind === "failed") summary.emailsFailed++;
    }

    summary.status = summary.emailsFailed > 0 ? "partial" : "success";
    await db
      .update(cronRuns)
      .set({
        status: summary.status,
        finishedAt: new Date(),
        organizationsProcessed: summary.organizationsProcessed,
        emailsSent: summary.emailsSent,
        emailsFailed: summary.emailsFailed,
      })
      .where(eq(cronRuns.id, run.id));
    log("finish", { ...summary });
    return summary;
  } catch (e) {
    summary.status = "failed";
    const message = e instanceof Error ? e.message : String(e);
    await db
      .update(cronRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        organizationsProcessed: summary.organizationsProcessed,
        emailsSent: summary.emailsSent,
        emailsFailed: summary.emailsFailed,
        error: message,
      })
      .where(eq(cronRuns.id, run.id));
    log("error", { ...summary, error: message });
    throw e;
  }
}

type DispatchOutcome =
  | { kind: "already_sent" }
  | { kind: "no_recipients" }
  | { kind: "sent"; recipients: number }
  | { kind: "failed"; error: string };

async function dispatchForOrg(
  orgId: string,
  orgName: string,
  items: AlertItem[],
  today: string,
  opts: ExpirationRunOptions,
  log: NonNullable<ExpirationRunOptions["log"]>,
): Promise<DispatchOutcome> {
  // Réserve (ou retrouve) la ligne d'envoi du jour pour cette organisation.
  await db
    .insert(alertDispatches)
    .values({ orgId, runDate: today, status: "pending", equipmentCount: items.length })
    .onConflictDoNothing({ target: [alertDispatches.orgId, alertDispatches.runDate] });
  const [dispatch] = await db
    .select()
    .from(alertDispatches)
    .where(and(eq(alertDispatches.orgId, orgId), eq(alertDispatches.runDate, today)))
    .limit(1);
  if (dispatch.status === "sent") {
    log("skip_already_sent", { orgId });
    return { kind: "already_sent" };
  }

  const recipients = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.orgId, orgId), inArray(users.role, ["admin", "technician"])));
  if (recipients.length === 0) {
    await db
      .update(alertDispatches)
      .set({ status: "sent", recipients: 0, equipmentCount: items.length, updatedAt: new Date() })
      .where(eq(alertDispatches.id, dispatch.id));
    log("no_recipients", { orgId });
    return { kind: "no_recipients" };
  }

  const email = renderAlertEmail({ orgName, appUrl: opts.appUrl, items });
  let attempts = dispatch.attempts;
  try {
    const { attempts: used } = await withRetry(
      () =>
        opts.sender.send({
          to: recipients.map((r) => r.email),
          ...email,
          idempotencyKey: `alerts/${orgId}/${today}`,
        }),
      {
        retries: opts.retries ?? 3,
        baseDelayMs: opts.retryBaseDelayMs ?? 2000,
        sleep: opts.sleep,
        shouldRetry: (e) => !(e instanceof EmailError) || e.retryable,
        onRetry: (e, attempt) =>
          log("retry", { orgId, attempt, error: e instanceof Error ? e.message : String(e) }),
      },
    );
    attempts += used;
    await db
      .update(alertDispatches)
      .set({
        status: "sent",
        attempts,
        recipients: recipients.length,
        equipmentCount: items.length,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(alertDispatches.id, dispatch.id));
    // Les échecs des jours précédents sont couverts par cet envoi (rattrapage).
    await db
      .update(alertDispatches)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(
        and(
          eq(alertDispatches.orgId, orgId),
          eq(alertDispatches.status, "failed"),
          lt(alertDispatches.runDate, today),
        ),
      );
    log("sent", { orgId, recipients: recipients.length, equipments: items.length, attempts });
    return { kind: "sent", recipients: recipients.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    attempts += (e as { attempts?: number })?.attempts ?? 1;
    await db
      .update(alertDispatches)
      .set({ status: "failed", attempts, lastError: message, updatedAt: new Date() })
      .where(eq(alertDispatches.id, dispatch.id));
    log("send_failed", { orgId, attempts, error: message });
    return { kind: "failed", error: message };
  }
}
