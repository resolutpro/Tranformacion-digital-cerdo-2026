import {
  type User, type InsertUser,
  type Organization, type InsertOrganization,
  type Lote, type InsertLote,
  type Zone, type InsertZone,
  type Stay, type InsertStay,
  type Sensor, type InsertSensor,
  type SensorReading, type InsertSensorReading,
  type ZoneQr, type InsertZoneQr,
  type QrSnapshot, type InsertQrSnapshot,
  type LoteTemplate, type InsertLoteTemplate,
  type AuditLog, type InsertAuditLog,
  type Alert, type InsertAlert
} from "@shared/schema";
import session, { Store } from "express-session";

export interface IStorage {
  sessionStore: Store;

  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;

  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByOrganization?(organizationId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  getLotesByOrganization(organizationId: string): Promise<Lote[]>;
  getSubLotes(parentLoteId: string, organizationId: string): Promise<Lote[]>;
  getLote(id: string, organizationId: string): Promise<Lote | undefined>;
  createLote(lote: InsertLote): Promise<Lote>;
  updateLote(id: string, lote: Partial<InsertLote>, organizationId: string): Promise<Lote | undefined>;
  deleteLote(id: string, organizationId: string): Promise<boolean>;

  getLoteTemplate(organizationId: string): Promise<LoteTemplate | undefined>;
  updateLoteTemplate(template: InsertLoteTemplate): Promise<LoteTemplate>;

  getZonesByOrganization(organizationId: string): Promise<Zone[]>;
  getZonesByStage(organizationId: string, stage: string): Promise<Zone[]>;
  getZoneById(id: string): Promise<Zone | undefined>;
  getZone(id: string, organizationId: string): Promise<Zone | undefined>;
  createZone(zone: InsertZone): Promise<Zone>;
  updateZone(id: string, zone: Partial<InsertZone>, organizationId: string): Promise<Zone | undefined>;
  deleteZone(id: string, organizationId: string): Promise<boolean>;

  getStaysByLote(loteId: string): Promise<Stay[]>;
  getActiveStayByLote(loteId: string): Promise<Stay | undefined>;
  getActiveStaysByZone(zoneId: string): Promise<Stay[]>;
  getStaysByZone(zoneId: string): Promise<Stay[]>;
  createStay(stay: InsertStay): Promise<Stay>;
  updateStay(id: string, stay: Partial<InsertStay>): Promise<Stay | undefined>;
  closeStay(id: string, exitTime: Date): Promise<Stay | undefined>;

  getSensorsByZone(zoneId: string): Promise<Sensor[]>;
  getSensorsByOrganization(organizationId: string): Promise<Sensor[]>;
  getSensor(id: string): Promise<Sensor | undefined>;
  getSensorByDeviceId(deviceId: string): Promise<Sensor | undefined>;
  getAllMqttEnabledSensors(): Promise<Sensor[]>;
  createSensor(sensor: InsertSensor & { deviceId: string; mqttTopic: string; mqttUsername: string; mqttPassword: string }): Promise<Sensor>;
  updateSensor(id: string, sensor: Partial<InsertSensor>): Promise<Sensor | undefined>;
  updateSensorMqttConfig(id: string, config: Partial<Pick<Sensor, 'mqttHost' | 'mqttPort' | 'mqttUsername' | 'mqttPassword' | 'ttnTopic' | 'jsonFields' | 'mqttEnabled'>>): Promise<Sensor | undefined>;
  rotateSensorCredentials(id: string): Promise<{ username: string; password: string } | undefined>;
  deleteSensor(id: string): Promise<boolean>;

  getSensorReadings(sensorId: string, startTime?: Date, endTime?: Date, includeSimulated?: boolean): Promise<SensorReading[]>;
  getLatestReadingBySensor(sensorId: string): Promise<SensorReading | undefined>;
  getLatestReadingsByZone(zoneId: string, today?: Date): Promise<Array<SensorReading & { sensor: Sensor }>>;
  createSensorReading(reading: InsertSensorReading): Promise<SensorReading>;

  getZoneQr(zoneId: string): Promise<ZoneQr | undefined>;
  getZoneQrByToken(publicToken: string): Promise<ZoneQr | undefined>;
  createZoneQr(zoneQr: InsertZoneQr & { publicToken: string }): Promise<ZoneQr>;

  getQrSnapshotsByOrganization(organizationId: string): Promise<QrSnapshot[]>;
  getQrSnapshotByToken(token: string): Promise<QrSnapshot | undefined>;
  getQrSnapshot(id: string): Promise<QrSnapshot | undefined>;
  updateQrSnapshot(id: string, data: Partial<Pick<QrSnapshot, 'publicToken' | 'scanCount' | 'isActive'>>): Promise<QrSnapshot | undefined>;
  incrementScanCount(token: string): Promise<void>;
  revokeQrSnapshot(id: string, organizationId: string): Promise<boolean>;

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;

  getSensorDataByLoteAndStage(loteId: string, stage: string, startTime: Date, endTime: Date): Promise<any[]>;

  // NUEVO: Métodos de Alertas
  getAlerts(organizationId: string): Promise<Alert[]>;
  getUnreadAlertsCount(organizationId: string): Promise<number>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  checkAndCreateAlerts(sensor: Sensor, readingValue: string): Promise<void>;
  markAlertAsRead(id: string, organizationId: string): Promise<void>;
}

import { PostgresStorage } from "./postgres-storage";
export const storage = new PostgresStorage();