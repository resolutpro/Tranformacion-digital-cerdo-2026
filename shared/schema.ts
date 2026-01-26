import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, json, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loteTemplates = pgTable("lote_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  customFields: json("custom_fields").$type<Array<{name: string, type: string, required: boolean}> | null>().default(null),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lotes = pgTable("lotes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  identification: text("identification").notNull(),
  initialAnimals: integer("initial_animals").notNull(),
  finalAnimals: integer("final_animals"),
  foodRegime: text("food_regime"),
  customData: json("custom_data").$type<Record<string, any>>().default({}),
  status: text("status").notNull().default("active"),
  parentLoteId: uuid("parent_lote_id"),
  pieceType: text("piece_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const zones = pgTable("zones", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  stage: text("stage").notNull(),
  fixedInfo: json("fixed_info").$type<Record<string, any>>().default({}),
  temperatureTarget: json("temperature_target").$type<{min: number, max: number}>(),
  humidityTarget: json("humidity_target").$type<{min: number, max: number}>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stays = pgTable("stays", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  loteId: uuid("lote_id").references(() => lotes.id).notNull(),
  zoneId: uuid("zone_id").references(() => zones.id),
  entryTime: timestamp("entry_time").notNull(),
  exitTime: timestamp("exit_time"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sensors = pgTable("sensors", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  zoneId: uuid("zone_id").references(() => zones.id).notNull(),
  name: text("name").notNull(),
  deviceId: text("device_id").notNull().unique(),
  sensorType: text("sensor_type").notNull(),
  unit: text("unit"),
  mqttTopic: text("mqtt_topic").notNull().unique(),
  mqttUsername: text("mqtt_username").notNull(),
  mqttPassword: text("mqtt_password").notNull(),
  mqttHost: text("mqtt_host").default("eu1.cloud.thethings.network"),
  mqttPort: integer("mqtt_port").default(8883),
  ttnTopic: text("ttn_topic"),
  jsonFields: text("json_fields"),
  mqttEnabled: boolean("mqtt_enabled").default(false),
  validationMin: decimal("validation_min", { precision: 10, scale: 2 }),
  validationMax: decimal("validation_max", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sensorReadings = pgTable("sensor_readings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sensorId: uuid("sensor_id").references(() => sensors.id).notNull(),
  value: decimal("value", { precision: 15, scale: 6 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  isSimulated: boolean("is_simulated").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const zoneQrs = pgTable("zone_qrs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  zoneId: uuid("zone_id").references(() => zones.id).notNull(),
  publicToken: text("public_token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const qrSnapshots = pgTable("qr_snapshots", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  loteId: uuid("lote_id").references(() => lotes.id).notNull(),
  publicToken: text("public_token").notNull().unique(),
  snapshotData: json("snapshot_data").$type<any>().notNull(),
  scanCount: integer("scan_count").default(0),
  isActive: boolean("is_active").default(true),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  oldData: json("old_data"),
  newData: json("new_data"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// NUEVA TABLA: Alertas
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  sensorId: uuid("sensor_id").references(() => sensors.id).notNull(),
  zoneId: uuid("zone_id").references(() => zones.id).notNull(),
  type: text("type").notNull(), // 'min_breach' | 'max_breach'
  value: decimal("value", { precision: 15, scale: 6 }).notNull(),
  threshold: decimal("threshold", { precision: 15, scale: 6 }).notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertLoteSchema = createInsertSchema(lotes).omit({ id: true, createdAt: true });
export const insertZoneSchema = createInsertSchema(zones).omit({ id: true, createdAt: true });
export const insertSensorSchema = createInsertSchema(sensors).omit({ id: true, createdAt: true, deviceId: true, mqttTopic: true, mqttUsername: true, mqttPassword: true });
export const sensorMqttConfigSchema = createInsertSchema(sensors).pick({ mqttHost: true, mqttPort: true, mqttUsername: true, mqttPassword: true, ttnTopic: true, jsonFields: true, mqttEnabled: true });

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Lote = typeof lotes.$inferSelect;
export type Zone = typeof zones.$inferSelect;
export type Stay = typeof stays.$inferSelect;
export type Sensor = typeof sensors.$inferSelect;
export type SensorReading = typeof sensorReadings.$inferSelect;
export type ZoneQr = typeof zoneQrs.$inferSelect;
export type QrSnapshot = typeof qrSnapshots.$inferSelect;
export type LoteTemplate = typeof loteTemplates.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type Alert = typeof alerts.$inferSelect;

export const insertStaySchema = createInsertSchema(stays).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
export const insertSensorReadingSchema = createInsertSchema(sensorReadings).omit({ id: true, createdAt: true });
export const insertZoneQrSchema = createInsertSchema(zoneQrs).omit({ id: true, createdAt: true });
export const insertQrSnapshotSchema = createInsertSchema(qrSnapshots).omit({ id: true, createdAt: true });
export const insertLoteTemplateSchema = createInsertSchema(loteTemplates).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertLote = z.infer<typeof insertLoteSchema>;
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type InsertSensor = z.infer<typeof insertSensorSchema>;
export type InsertStay = z.infer<typeof insertStaySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertSensorReading = z.infer<typeof insertSensorReadingSchema>;
export type InsertZoneQr = z.infer<typeof insertZoneQrSchema>;
export type InsertQrSnapshot = z.infer<typeof insertQrSnapshotSchema>;
export type InsertLoteTemplate = z.infer<typeof insertLoteTemplateSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;