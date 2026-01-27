import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { randomUUID } from "crypto";
import type { Store } from "express-session";
import {
  eq,
  and,
  desc,
  gte,
  lte,
  sql,
  isNull,
  isNotNull,
  or,
  inArray,
} from "drizzle-orm";
import {
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type Lote,
  type InsertLote,
  type Zone,
  type InsertZone,
  type Stay,
  type InsertStay,
  type Sensor,
  type InsertSensor,
  type SensorReading,
  type InsertSensorReading,
  type ZoneQr,
  type InsertZoneQr,
  type QrSnapshot,
  type InsertQrSnapshot,
  type LoteTemplate,
  type InsertLoteTemplate,
  type AuditLog,
  type InsertAuditLog,
  type Alert,
  type InsertAlert,
  organizations,
  users,
  lotes,
  zones,
  stays,
  sensors,
  sensorReadings,
  zoneQrs,
  qrSnapshots,
  loteTemplates,
  auditLog,
  alerts, // Asegúrate de que esto esté en shared/schema.ts
} from "@shared/schema";
import type { IStorage } from "./storage";

const PostgresSessionStore = connectPg(session);

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")
  ) as Partial<T>;
}

export class PostgresStorage implements IStorage {
  private client: postgres.Sql;
  private db: ReturnType<typeof drizzle>;
  public readonly sessionStore: Store;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    this.client = postgres(databaseUrl);
    this.db = drizzle(this.client);

    this.sessionStore = new PostgresSessionStore({
      conString: databaseUrl,
      createTableIfMissing: true,
    });
  }

  // --- Alertas ---
  async getAlerts(organizationId: string): Promise<Alert[]> {
    return await this.db
      .select()
      .from(alerts)
      .where(eq(alerts.organizationId, organizationId))
      .orderBy(desc(alerts.createdAt));
  }

  async getUnreadAlertsCount(organizationId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(
        and(
          eq(alerts.organizationId, organizationId),
          eq(alerts.isRead, false),
        ),
      );
    return Number(result[0]?.count || 0);
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const result = await this.db.insert(alerts).values(alert).returning();
    return result[0];
  }

  async markAlertAsRead(id: string, organizationId: string): Promise<void> {
    await this.db
      .update(alerts)
      .set({ isRead: true })
      .where(and(eq(alerts.id, id), eq(alerts.organizationId, organizationId)));
  }

  // --- Organizations ---
  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return result[0];
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const result = await this.db.insert(organizations).values(org).returning();
    return result[0];
  }

  // --- Users ---
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0];
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return await this.db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // --- Lotes ---
  async getLotesByOrganization(organizationId: string): Promise<Lote[]> {
    return await this.db
      .select()
      .from(lotes)
      .where(eq(lotes.organizationId, organizationId));
  }

  async getSubLotes(
    parentLoteId: string,
    organizationId: string,
  ): Promise<Lote[]> {
    return await this.db
      .select()
      .from(lotes)
      .where(
        and(
          eq(lotes.parentLoteId, parentLoteId),
          eq(lotes.organizationId, organizationId),
        ),
      );
  }

  async getLote(id: string, organizationId: string): Promise<Lote | undefined> {
    const result = await this.db
      .select()
      .from(lotes)
      .where(and(eq(lotes.id, id), eq(lotes.organizationId, organizationId)))
      .limit(1);
    return result[0];
  }

  async createLote(lote: InsertLote): Promise<Lote> {
    const result = await this.db.insert(lotes).values(lote).returning();
    return result[0];
  }

  async updateLote(
    id: string,
    lote: Partial<InsertLote>,
    organizationId: string,
  ): Promise<Lote | undefined> {
    const result = await this.db
      .update(lotes)
      .set(lote)
      .where(and(eq(lotes.id, id), eq(lotes.organizationId, organizationId)))
      .returning();
    return result[0];
  }

  async deleteLote(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .delete(lotes)
      .where(and(eq(lotes.id, id), eq(lotes.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }

  // --- Lote Templates ---
  async getLoteTemplate(
    organizationId: string,
  ): Promise<LoteTemplate | undefined> {
    const result = await this.db
      .select()
      .from(loteTemplates)
      .where(eq(loteTemplates.organizationId, organizationId))
      .orderBy(desc(loteTemplates.createdAt))
      .limit(1);
    return result[0];
  }

  async updateLoteTemplate(
    template: InsertLoteTemplate,
  ): Promise<LoteTemplate> {
    const existing = await this.getLoteTemplate(template.organizationId);
    if (existing) {
      const result = await this.db
        .update(loteTemplates)
        .set(template)
        .where(eq(loteTemplates.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await this.db
        .insert(loteTemplates)
        .values(template)
        .returning();
      return result[0];
    }
  }

  // --- Zones ---
  async getZonesByOrganization(organizationId: string): Promise<Zone[]> {
    return await this.db
      .select()
      .from(zones)
      .where(eq(zones.organizationId, organizationId));
  }

  async getZonesByStage(
    organizationId: string,
    stage: string,
  ): Promise<Zone[]> {
    return await this.db
      .select()
      .from(zones)
      .where(
        and(eq(zones.organizationId, organizationId), eq(zones.stage, stage)),
      );
  }

  async getZoneById(id: string): Promise<Zone | undefined> {
    const result = await this.db
      .select()
      .from(zones)
      .where(eq(zones.id, id))
      .limit(1);
    return result[0];
  }

  async getZone(id: string, organizationId: string): Promise<Zone | undefined> {
    try {
      console.log(`[STORAGE] Buscando zona: id=${id}, org=${organizationId}`);
      const result = await this.db
        .select()
        .from(zones)
        .where(
          and(
            eq(zones.id, id),
            eq(zones.organizationId, organizationId)
          )
        )
        .limit(1);
      
      if (!result[0]) {
        // Búsqueda de respaldo solo por ID para depuración
        const backup = await this.db.select().from(zones).where(eq(zones.id, id)).limit(1);
        if (backup[0]) {
          console.warn(`[STORAGE] Zona encontrada por ID ${id} pero pertenece a otra org: ${backup[0].organizationId} (esperada: ${organizationId})`);
        } else {
          console.warn(`[STORAGE] Zona no encontrada ni siquiera por ID: ${id}`);
        }
      }
      return result[0];
    } catch (e) {
      console.error(`Error en getZone para ID ${id}:`, e);
      return undefined;
    }
  }

  async createZone(zone: InsertZone): Promise<Zone> {
    const result = await this.db.insert(zones).values(zone).returning();
    return result[0];
  }

  async updateZone(
    id: string,
    zone: Partial<InsertZone>,
    organizationId: string,
  ): Promise<Zone | undefined> {
    const result = await this.db
      .update(zones)
      .set(zone)
      .where(and(eq(zones.id, id), eq(zones.organizationId, organizationId)))
      .returning();
    return result[0];
  }

  async deleteZone(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .delete(zones)
      .where(and(eq(zones.id, id), eq(zones.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }

  // --- Stays ---
  async getStaysByLote(loteId: string): Promise<Stay[]> {
    return await this.db
      .select()
      .from(stays)
      .where(eq(stays.loteId, loteId))
      .orderBy(desc(stays.entryTime));
  }

  async getActiveStayByLote(loteId: string): Promise<Stay | undefined> {
    const result = await this.db
      .select()
      .from(stays)
      .where(and(eq(stays.loteId, loteId), isNull(stays.exitTime)))
      .limit(1);
    return result[0];
  }

  async getActiveStaysByZone(zoneId: string): Promise<Stay[]> {
    return await this.db
      .select()
      .from(stays)
      .where(and(eq(stays.zoneId, zoneId), isNull(stays.exitTime)));
  }

  async getStaysByZone(zoneId: string): Promise<Stay[]> {
    return await this.db
      .select()
      .from(stays)
      .where(eq(stays.zoneId, zoneId))
      .orderBy(desc(stays.entryTime));
  }

  async createStay(stay: InsertStay): Promise<Stay> {
    const result = await this.db.insert(stays).values(stay).returning();
    return result[0];
  }

  async updateStay(
    id: string,
    stay: Partial<InsertStay>,
  ): Promise<Stay | undefined> {
    const result = await this.db
      .update(stays)
      .set(stay)
      .where(eq(stays.id, id))
      .returning();
    return result[0];
  }

  async closeStay(id: string, exitTime: Date): Promise<Stay | undefined> {
    const result = await this.db
      .update(stays)
      .set({ exitTime })
      .where(eq(stays.id, id))
      .returning();
    return result[0];
  }

  // --- Sensors ---
  async getSensorsByZone(zoneId: string): Promise<Sensor[]> {
    return await this.db
      .select()
      .from(sensors)
      .where(eq(sensors.zoneId, zoneId));
  }

  async getSensorsByOrganization(organizationId: string): Promise<Sensor[]> {
    return await this.db
      .select()
      .from(sensors)
      .where(eq(sensors.organizationId, organizationId));
  }

  async getAllMqttEnabledSensors(): Promise<Sensor[]> {
    return await this.db
      .select()
      .from(sensors)
      .where(and(eq(sensors.isActive, true), eq(sensors.mqttEnabled, true)));
  }

  async getSensor(id: string): Promise<Sensor | undefined> {
    const result = await this.db
      .select()
      .from(sensors)
      .where(eq(sensors.id, id))
      .limit(1);
    return result[0];
  }

  async getSensorByDeviceId(deviceId: string): Promise<Sensor | undefined> {
    const result = await this.db
      .select()
      .from(sensors)
      .where(eq(sensors.deviceId, deviceId))
      .limit(1);
    return result[0];
  }

  async createSensor(
    sensor: InsertSensor & {
      deviceId: string;
      mqttTopic: string;
      mqttUsername: string;
      mqttPassword: string;
    },
  ): Promise<Sensor> {
    const result = await this.db.insert(sensors).values(sensor).returning();
    return result[0];
  }

  async updateSensor(
    id: string,
    sensor: Partial<InsertSensor>,
  ): Promise<Sensor | undefined> {
    const dataToUpdate = cleanUndefined(sensor);
    console.log(`[STORAGE] Actualizando sensor ${id} con datos:`, dataToUpdate);
    const result = await this.db
      .update(sensors)
      .set(dataToUpdate)
      .where(eq(sensors.id, id))
      .returning();
    console.log(`[STORAGE] Resultado de actualización:`, result[0]);
    return result[0];
  }

  async updateSensorMqttConfig(
    id: string,
    config: Partial<
      Pick<
        Sensor,
        | "mqttHost"
        | "mqttPort"
        | "mqttUsername"
        | "mqttPassword"
        | "ttnTopic"
        | "jsonFields"
        | "mqttEnabled"
      >
    >,
  ): Promise<Sensor | undefined> {
    const result = await this.db
      .update(sensors)
      .set(config)
      .where(eq(sensors.id, id))
      .returning();
    return result[0];
  }

  async rotateSensorCredentials(
    id: string,
  ): Promise<{ username: string; password: string } | undefined> {
    const u = `sensor_${randomUUID().slice(0, 8)}`;
    const p = randomUUID();
    const result = await this.db
      .update(sensors)
      .set({ mqttUsername: u, mqttPassword: p })
      .where(eq(sensors.id, id))
      .returning();
    return result.length > 0 ? { username: u, password: p } : undefined;
  }

  async deleteSensor(id: string): Promise<boolean> {
    const result = await this.db
      .update(sensors)
      .set({ isActive: false })
      .where(eq(sensors.id, id))
      .returning();
    return result.length > 0;
  }

  // --- Readings ---
  async getSensorReadings(
    sensorId: string,
    start?: Date,
    end?: Date,
    incSim?: boolean,
  ): Promise<SensorReading[]> {
    let conds = [eq(sensorReadings.sensorId, sensorId)];
    if (start) conds.push(gte(sensorReadings.timestamp, start));
    if (end) conds.push(lte(sensorReadings.timestamp, end));
    if (incSim === false) conds.push(eq(sensorReadings.isSimulated, false));
    return await this.db
      .select()
      .from(sensorReadings)
      .where(and(...conds))
      .orderBy(desc(sensorReadings.timestamp));
  }

  async getLatestReadingBySensor(
    sensorId: string,
  ): Promise<SensorReading | undefined> {
    const result = await this.db
      .select()
      .from(sensorReadings)
      .where(eq(sensorReadings.sensorId, sensorId))
      .orderBy(desc(sensorReadings.timestamp))
      .limit(1);
    return result[0];
  }

  async getLatestReadingsByZone(
    zoneId: string,
    today?: Date,
  ): Promise<Array<SensorReading & { sensor: Sensor }>> {
    const sList = await this.getSensorsByZone(zoneId);
    const results: any[] = [];
    for (const s of sList) {
      const r = await this.getLatestReadingBySensor(s.id);
      if (r) results.push({ ...r, sensor: s });
    }
    return results;
  }

  async createSensorReading(
    reading: InsertSensorReading,
  ): Promise<SensorReading> {
    const result = await this.db
      .insert(sensorReadings)
      .values(reading)
      .returning();
    return result[0];
  }

  // --- QR & Snapshots ---
  async getZoneQr(zoneId: string) {
    const r = await this.db
      .select()
      .from(zoneQrs)
      .where(eq(zoneQrs.zoneId, zoneId))
      .limit(1);
    return r[0];
  }
  async getZoneQrByToken(t: string) {
    const r = await this.db
      .select()
      .from(zoneQrs)
      .where(eq(zoneQrs.publicToken, t))
      .limit(1);
    return r[0];
  }
  async createZoneQr(q: any) {
    const r = await this.db.insert(zoneQrs).values(q).returning();
    return r[0];
  }
  async getQrSnapshotsByOrganization(orgId: string) {
    return await this.db
      .select({ qrSnapshot: qrSnapshots })
      .from(qrSnapshots)
      .innerJoin(lotes, eq(qrSnapshots.loteId, lotes.id))
      .where(eq(lotes.organizationId, orgId))
      .then((rows) => rows.map((r) => r.qrSnapshot));
  }
  async getQrSnapshotByToken(t: string) {
    const r = await this.db
      .select()
      .from(qrSnapshots)
      .where(
        and(eq(qrSnapshots.publicToken, t), eq(qrSnapshots.isActive, true)),
      )
      .limit(1);
    return r[0];
  }
  async getQrSnapshot(id: string) {
    const r = await this.db
      .select()
      .from(qrSnapshots)
      .where(eq(qrSnapshots.id, id))
      .limit(1);
    return r[0];
  }
  async updateQrSnapshot(id: string, data: any) {
    const r = await this.db
      .update(qrSnapshots)
      .set(data)
      .where(eq(qrSnapshots.id, id))
      .returning();
    return r[0];
  }
  async incrementScanCount(t: string) {
    await this.db
      .update(qrSnapshots)
      .set({ scanCount: sql`${qrSnapshots.scanCount} + 1` })
      .where(eq(qrSnapshots.publicToken, t));
  }
  async revokeQrSnapshot(id: string, orgId: string) {
    const r = await this.db
      .update(qrSnapshots)
      .set({ isActive: false })
      .from(lotes)
      .where(
        and(
          eq(qrSnapshots.id, id),
          eq(qrSnapshots.loteId, lotes.id),
          eq(lotes.organizationId, orgId),
        ),
      )
      .returning();
    return r.length > 0;
  }
  async createQrSnapshot(snapshot: any): Promise<QrSnapshot> {
    const result = await this.db
      .insert(qrSnapshots)
      .values(snapshot)
      .returning();
    return result[0];
  }

  // --- Audit & Traceability ---
  async createAuditLog(log: InsertAuditLog) {
    const r = await this.db.insert(auditLog).values(log).returning();
    return r[0];
  }
  async getAuditLogsByEntity(type: string, id: string) {
    return await this.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, type), eq(auditLog.entityId, id)))
      .orderBy(desc(auditLog.timestamp));
  }
  async getSensorDataByLoteAndStage(
    loteId: string,
    stage: string,
    start: Date,
    end: Date,
  ) {
    const relevantStays = await this.db
      .select({ zoneId: stays.zoneId })
      .from(stays)
      .innerJoin(zones, eq(zones.id, stays.zoneId))
      .where(and(eq(stays.loteId, loteId), eq(zones.stage, stage)));
    if (relevantStays.length === 0) return [];
    const zIds = relevantStays
      .map((s) => s.zoneId)
      .filter((id): id is string => !!id);
    return await this.db
      .select({
        id: sensorReadings.id,
        sensorType: sensors.sensorType,
        value: sensorReadings.value,
        timestamp: sensorReadings.timestamp,
      })
      .from(sensorReadings)
      .innerJoin(sensors, eq(sensors.id, sensorReadings.sensorId))
      .where(
        and(
          inArray(sensors.zoneId, zIds),
          gte(sensorReadings.timestamp, start),
          lte(sensorReadings.timestamp, end),
        ),
      )
      .orderBy(sensorReadings.timestamp);
  }
}
