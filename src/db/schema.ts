import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Schéma conforme au cahier des charges (§2). Ajouts techniques, signalés
 * par un commentaire « ajout » :
 *  - users.password_hash : nécessaire à l'authentification par mot de passe ;
 *  - index / contraintes d'unicité pour les requêtes filtrées par org_id ;
 *  - cron_runs / alert_dispatches : journalisation et reprise du moteur
 *    d'alertes (critère « Zéro oubli d'alerte »).
 */

export * from "./enums";
import type { Locale } from "@/i18n/config";
import type { EquipmentStatus, PlanTier, RecordResult, RecordType, UserRole } from "./enums";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  // ajout : langue des e-mails d'alerte de l'organisation (fr | en | es)
  locale: varchar("locale", { length: 5 }).$type<Locale>().notNull().default("fr"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    fullName: varchar("full_name", { length: 255 }),
    role: varchar("role", { length: 50 }).$type<UserRole>().default("technician"),
    // ajout : hash bcrypt du mot de passe
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("users_org_id_idx").on(t.orgId)],
);

export const equipments = pgTable(
  "equipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    internalId: varchar("internal_id", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    brand: varchar("brand", { length: 100 }),
    model: varchar("model", { length: 100 }),
    serialNumber: varchar("serial_number", { length: 100 }),
    location: varchar("location", { length: 100 }),
    status: varchar("status", { length: 50 }).$type<EquipmentStatus>().default("operational"),
    calibrationFrequencyMonths: integer("calibration_frequency_months").default(12),
    lastCalibrationDate: date("last_calibration_date"),
    nextCalibrationDate: date("next_calibration_date").notNull(),
    qrCodeToken: uuid("qr_code_token").defaultRandom().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("equipments_org_id_idx").on(t.orgId),
    index("equipments_next_calibration_idx").on(t.nextCalibrationDate),
    // ajout : un code interne est unique au sein d'une organisation
    uniqueIndex("equipments_org_internal_id_uq").on(t.orgId, t.internalId),
  ],
);

export const maintenanceRecords = pgTable(
  "maintenance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    equipmentId: uuid("equipment_id").references(() => equipments.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: varchar("type", { length: 50 }).$type<RecordType>().notNull(),
    performedAt: date("performed_at").notNull(),
    performedBy: varchar("performed_by", { length: 255 }).notNull(),
    statusResult: varchar("status_result", { length: 50 }).$type<RecordResult>().notNull(),
    // Contient la clé d'objet S3/R2 (UUID non prévisible). Le fichier n'est
    // jamais exposé directement : il est servi par /api/certificates/{id}
    // via une URL signée à courte durée de vie.
    certificateFileUrl: text("certificate_file_url"),
    certificateFileName: varchar("certificate_file_name", { length: 255 }),
    comments: text("comments"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("maintenance_records_equipment_id_idx").on(t.equipmentId)],
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .unique(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  planTier: varchar("plan_tier", { length: 50 }).$type<PlanTier>().default("free"),
  status: varchar("status", { length: 50 }).default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
});

// ajout : journal des exécutions du cron d'alertes
export const cronRuns = pgTable("cron_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  job: varchar("job", { length: 100 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: varchar("status", { length: 50 }).notNull().default("running"), // running | success | partial | failed
  organizationsProcessed: integer("organizations_processed").notNull().default(0),
  emailsSent: integer("emails_sent").notNull().default(0),
  emailsFailed: integer("emails_failed").notNull().default(0),
  error: text("error"),
});

// ajout : un envoi par organisation et par jour — permet de relancer le cron
// sans doublon et de reprendre les envois échoués.
export const alertDispatches = pgTable(
  "alert_dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    runDate: date("run_date").notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending | sent | failed | superseded
    attempts: integer("attempts").notNull().default(0),
    recipients: integer("recipients").notNull().default(0),
    equipmentCount: integer("equipment_count").notNull().default(0),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("alert_dispatches_org_day_uq").on(t.orgId, t.runDate)],
);

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Equipment = typeof equipments.$inferSelect;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
