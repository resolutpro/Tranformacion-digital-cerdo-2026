import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { randomUUID } from "crypto";
import type { Store } from "express-session";
import { eq, and, desc, gte, lte, sql, isNull } from "drizzle-orm";
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
} from "@shared/schema";
import type { IStorage } from "./storage";

const PostgresSessionStore = connectPg(session);

// Helper: elimina claves con valor undefined para no pisar columnas en UPDATE/INSERT
function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
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

  // Organizations
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

  // Users
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

  // Lotes
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

  // Lote Templates
  async getLoteTemplate(
    organizationId: string,
  ): Promise<LoteTemplate | undefined> {
    // Devuelve siempre la última versión (updatedAt si existe, si no createdAt)
    const orderColumn =
      (loteTemplates as any).updatedAt ?? (loteTemplates as any).createdAt;

    const result = await this.db
      .select()
      .from(loteTemplates)
      .where(eq(loteTemplates.organizationId, organizationId))
      .orderBy(desc(orderColumn))
      .limit(1);
    return result[0];
  }

  async updateLoteTemplate(
    template: InsertLoteTemplate,
  ): Promise<LoteTemplate> {
    // Busca la última plantilla de la organización
    const existing = await this.getLoteTemplate(template.organizationId);

    // Prepara set seguro: no pisa columnas con undefined y siempre actualiza updatedAt
    const toSet = cleanUndefined({
      ...(template as any),
      updatedAt: new Date(),
    });

    if (existing) {
      // Actualiza por PK para evitar tocar varias filas si existieran duplicados
      const result = await this.db
        .update(loteTemplates)
        .set(toSet as any)
        .where(eq(loteTemplates.id, (existing as any).id))
        .returning();
      return result[0];
    } else {
      // Crea nueva plantilla; añade timestamps si existen en el schema
      const insertValues = cleanUndefined({
        ...(template as any),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await this.db
        .insert(loteTemplates)
        .values([insertValues as any])
        .returning();
      return result[0];
    }
  }

  // Zones
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

  async getActiveStaysByZone(zoneId: string): Promise<Stay[]> {
    return await this.db
      .select()
      .from(stays)
      .where(and(eq(stays.zoneId, zoneId), isNull(stays.exitTime)))
      .orderBy(desc(stays.entryTime));
  }

  async getZone(id: string, organizationId: string): Promise<Zone | undefined> {
    const result = await this.db
      .select()
      .from(zones)
      .where(and(eq(zones.id, id), eq(zones.organizationId, organizationId)))
      .limit(1);
    return result[0];
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

  // Stays
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

  // Sensors
  async getSensorsByZone(zoneId: string): Promise<Sensor[]> {
    return await this.db
      .select()
      .from(sensors)
      .where(eq(sensors.zoneId, zoneId));
  }

  async getSensorsByOrganization(organizationId: string): Promise<Sensor[]> {
    const results = await this.db
      .select({ sensor: sensors })
      .from(sensors)
      .innerJoin(zones, eq(sensors.zoneId, zones.id))
      .where(eq(zones.organizationId, organizationId));
    return results.map((r) => r.sensor);
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
    const result = await this.db
      .update(sensors)
      .set(sensor)
      .where(eq(sensors.id, id))
      .returning();
    return result[0];
  }

  async rotateSensorCredentials(
    id: string,
  ): Promise<{ username: string; password: string } | undefined> {
    const newUsername = `sensor_${randomUUID().slice(0, 8)}`;
    const newPassword = randomUUID();

    const result = await this.db
      .update(sensors)
      .set({
        mqttUsername: newUsername,
        mqttPassword: newPassword,
      })
      .where(eq(sensors.id, id))
      .returning();

    if (result.length > 0) {
      return { username: newUsername, password: newPassword };
    }
    return undefined;
  }

  async deleteSensor(id: string): Promise<boolean> {
    const result = await this.db
      .delete(sensors)
      .where(eq(sensors.id, id))
      .returning();
    return result.length > 0;
  }

  // Sensor Readings
  async getSensorReadings(
    sensorId: string,
    startTime?: Date,
    endTime?: Date,
    includeSimulated?: boolean,
  ): Promise<SensorReading[]> {
    let query = this.db
      .select()
      .from(sensorReadings)
      .where(eq(sensorReadings.sensorId, sensorId));

    const conditions = [eq(sensorReadings.sensorId, sensorId)];

    if (startTime) {
      conditions.push(gte(sensorReadings.timestamp, startTime));
    }
    if (endTime) {
      conditions.push(lte(sensorReadings.timestamp, endTime));
    }
    if (includeSimulated === false) {
      conditions.push(eq(sensorReadings.isSimulated, false));
    }

    return await this.db
      .select()
      .from(sensorReadings)
      .where(and(...conditions))
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
    const zoneSensors = await this.getSensorsByZone(zoneId);
    const results: Array<SensorReading & { sensor: Sensor }> = [];

    for (const sensor of zoneSensors) {
      const reading = await this.getLatestReadingBySensor(sensor.id);
      if (reading) {
        results.push({ ...reading, sensor });
      }
    }

    return results;
  }

  async createSensorReading(
    reading: InsertSensorReading,
  ): Promise<SensorReading> {
    const result = await this.db
      .insert(sensorReadings)
      .values([reading])
      .returning();
    return result[0];
  }

  // Zone QR Codes
  async getZoneQr(zoneId: string): Promise<ZoneQr | undefined> {
    const result = await this.db
      .select()
      .from(zoneQrs)
      .where(eq(zoneQrs.zoneId, zoneId))
      .limit(1);
    return result[0];
  }

  async getZoneQrByToken(publicToken: string): Promise<ZoneQr | undefined> {
    const result = await this.db
      .select()
      .from(zoneQrs)
      .where(eq(zoneQrs.publicToken, publicToken))
      .limit(1);
    return result[0];
  }

  async createZoneQr(
    zoneQr: InsertZoneQr & { publicToken: string },
  ): Promise<ZoneQr> {
    const result = await this.db.insert(zoneQrs).values([zoneQr]).returning();
    return result[0];
  }

  // QR Snapshots
  async getQrSnapshotsByOrganization(
    organizationId: string,
  ): Promise<QrSnapshot[]> {
    const results = await this.db
      .select({ qrSnapshot: qrSnapshots })
      .from(qrSnapshots)
      .innerJoin(lotes, eq(qrSnapshots.loteId, lotes.id))
      .where(eq(lotes.organizationId, organizationId));
    return results.map((r) => r.qrSnapshot);
  }

  async getQrSnapshot(id: string): Promise<QrSnapshot | undefined> {
    const result = await this.db
      .select()
      .from(qrSnapshots)
      .where(eq(qrSnapshots.id, id))
      .limit(1);
    return result[0];
  }

  async getQrSnapshotByToken(token: string): Promise<QrSnapshot | undefined> {
    const result = await this.db
      .select()
      .from(qrSnapshots)
      .where(
        and(eq(qrSnapshots.publicToken, token), eq(qrSnapshots.isActive, true)),
      )
      .limit(1);
    return result[0];
  }

  async createQrSnapshot(
    snapshot: InsertQrSnapshot & { publicToken: string },
  ): Promise<QrSnapshot> {
    const result = await this.db
      .insert(qrSnapshots)
      .values([snapshot])
      .returning();
    return result[0];
  }

  async updateQrSnapshot(
    id: string,
    snapshot: Partial<QrSnapshot>,
  ): Promise<QrSnapshot | undefined> {
    const result = await this.db
      .update(qrSnapshots)
      .set(snapshot as any)
      .where(eq(qrSnapshots.id, id))
      .returning();
    return result[0];
  }

  async incrementScanCount(token: string): Promise<void> {
    await this.db
      .update(qrSnapshots)
      .set({ scanCount: sql`${qrSnapshots.scanCount} + 1` })
      .where(eq(qrSnapshots.publicToken, token));
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await this.db.insert(auditLog).values(log).returning();
    return result[0];
  }

  async getAuditLogsByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return await this.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, entityType),
          eq(auditLog.entityId, entityId),
        ),
      )
      .orderBy(desc(auditLog.timestamp));
  }

  // Missing method to implement IStorage interface
  async revokeQrSnapshot(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .update(qrSnapshots)
      .set({ isActive: false })
      .from(lotes)
      .where(
        and(
          eq(qrSnapshots.id, id),
          eq(qrSnapshots.loteId, lotes.id),
          eq(lotes.organizationId, organizationId),
        ),
      )
      .returning();
    return result.length > 0;
  }
}
