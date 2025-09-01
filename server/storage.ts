import { 
  type User, type InsertUser,
  type Organization, type InsertOrganization,
  type Lote, type InsertLote,
  type Zone, type InsertZone,
  type Stay, type InsertStay,
  type Sensor, type InsertSensor,
  type SensorReading, type InsertSensorReading,
  type QrSnapshot, type InsertQrSnapshot,
  type LoteTemplate, type InsertLoteTemplate,
  type AuditLog, type InsertAuditLog
} from "@shared/schema";
import { randomUUID } from "crypto";
import session, { Store } from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Auth
  sessionStore: Store;
  
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Lotes
  getLotesByOrganization(organizationId: string): Promise<Lote[]>;
  getSubLotes(parentLoteId: string, organizationId: string): Promise<Lote[]>;
  getLote(id: string, organizationId: string): Promise<Lote | undefined>;
  createLote(lote: InsertLote): Promise<Lote>;
  updateLote(id: string, lote: Partial<InsertLote>, organizationId: string): Promise<Lote | undefined>;
  deleteLote(id: string, organizationId: string): Promise<boolean>;
  
  // Lote Templates
  getLoteTemplate(organizationId: string): Promise<LoteTemplate | undefined>;
  updateLoteTemplate(template: InsertLoteTemplate): Promise<LoteTemplate>;
  
  // Zones
  getZonesByOrganization(organizationId: string): Promise<Zone[]>;
  getZonesByStage(organizationId: string, stage: string): Promise<Zone[]>;
  getZone(id: string, organizationId: string): Promise<Zone | undefined>;
  createZone(zone: InsertZone): Promise<Zone>;
  updateZone(id: string, zone: Partial<InsertZone>, organizationId: string): Promise<Zone | undefined>;
  deleteZone(id: string, organizationId: string): Promise<boolean>;
  
  // Stays
  getStaysByLote(loteId: string): Promise<Stay[]>;
  getActiveStayByLote(loteId: string): Promise<Stay | undefined>;
  getStaysByZone(zoneId: string): Promise<Stay[]>;
  createStay(stay: InsertStay): Promise<Stay>;
  updateStay(id: string, stay: Partial<InsertStay>): Promise<Stay | undefined>;
  closeStay(id: string, exitTime: Date): Promise<Stay | undefined>;
  
  // Sensors
  getSensorsByZone(zoneId: string): Promise<Sensor[]>;
  getSensorsByOrganization(organizationId: string): Promise<Sensor[]>;
  getSensor(id: string): Promise<Sensor | undefined>;
  getSensorByDeviceId(deviceId: string): Promise<Sensor | undefined>;
  createSensor(sensor: InsertSensor & { deviceId: string; mqttTopic: string; mqttUsername: string; mqttPassword: string }): Promise<Sensor>;
  updateSensor(id: string, sensor: Partial<InsertSensor>): Promise<Sensor | undefined>;
  rotateSensorCredentials(id: string): Promise<{ username: string; password: string } | undefined>;
  deleteSensor(id: string): Promise<boolean>;
  
  // Sensor Readings
  getSensorReadings(sensorId: string, startTime?: Date, endTime?: Date, includeSimulated?: boolean): Promise<SensorReading[]>;
  getLatestReadingBySensor(sensorId: string): Promise<SensorReading | undefined>;
  getLatestReadingsByZone(zoneId: string, today?: Date): Promise<Array<SensorReading & { sensor: Sensor }>>;
  createSensorReading(reading: InsertSensorReading): Promise<SensorReading>;
  
  // QR Snapshots
  getQrSnapshotsByOrganization(organizationId: string): Promise<QrSnapshot[]>;
  getQrSnapshotByToken(token: string): Promise<QrSnapshot | undefined>;
  getQrSnapshot(id: string): Promise<QrSnapshot | undefined>;
  createQrSnapshot(snapshot: InsertQrSnapshot & { publicToken: string }): Promise<QrSnapshot>;
  updateQrSnapshot(id: string, data: Partial<Pick<QrSnapshot, 'publicToken' | 'scanCount' | 'isActive'>>): Promise<QrSnapshot | undefined>;
  incrementScanCount(token: string): Promise<void>;
  revokeQrSnapshot(id: string, organizationId: string): Promise<boolean>;
  
  // Audit Log
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
}

export class MemStorage implements IStorage {
  private organizations: Map<string, Organization> = new Map();
  private users: Map<string, User> = new Map();
  private lotes: Map<string, Lote> = new Map();
  private loteTemplates: Map<string, LoteTemplate> = new Map();
  private zones: Map<string, Zone> = new Map();
  private stays: Map<string, Stay> = new Map();
  private sensors: Map<string, Sensor> = new Map();
  private sensorReadings: Map<string, SensorReading> = new Map();
  private qrSnapshots: Map<string, QrSnapshot> = new Map();
  private auditLogs: Map<string, AuditLog> = new Map();
  
  public readonly sessionStore: Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const organization: Organization = { 
      ...org, 
      id, 
      createdAt: new Date() 
    };
    this.organizations.set(id, organization);
    return organization;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  // Lotes
  async getLotesByOrganization(organizationId: string): Promise<Lote[]> {
    return Array.from(this.lotes.values()).filter(lote => lote.organizationId === organizationId);
  }

  async getSubLotes(parentLoteId: string, organizationId: string): Promise<Lote[]> {
    return Array.from(this.lotes.values()).filter(lote => 
      lote.parentLoteId === parentLoteId && lote.organizationId === organizationId
    );
  }

  async getLote(id: string, organizationId: string): Promise<Lote | undefined> {
    const lote = this.lotes.get(id);
    return lote && lote.organizationId === organizationId ? lote : undefined;
  }

  async createLote(lote: InsertLote): Promise<Lote> {
    const id = randomUUID();
    const newLote: Lote = { 
      ...lote, 
      id, 
      createdAt: new Date(),
      finalAnimals: lote.finalAnimals ?? null,
      foodRegime: lote.foodRegime ?? null,
      customData: lote.customData ?? null,
      parentLoteId: lote.parentLoteId ?? null,
      pieceType: lote.pieceType ?? null
    };
    this.lotes.set(id, newLote);
    return newLote;
  }

  async updateLote(id: string, lote: Partial<InsertLote>, organizationId: string): Promise<Lote | undefined> {
    const existing = this.lotes.get(id);
    if (!existing || existing.organizationId !== organizationId) return undefined;
    
    const updated = { ...existing, ...lote };
    this.lotes.set(id, updated);
    return updated;
  }

  async deleteLote(id: string, organizationId: string): Promise<boolean> {
    const lote = this.lotes.get(id);
    if (!lote || lote.organizationId !== organizationId) return false;
    
    this.lotes.delete(id);
    return true;
  }

  // Lote Templates
  async getLoteTemplate(organizationId: string): Promise<LoteTemplate | undefined> {
    return Array.from(this.loteTemplates.values()).find(template => template.organizationId === organizationId);
  }

  async updateLoteTemplate(template: InsertLoteTemplate): Promise<LoteTemplate> {
    const existing = await this.getLoteTemplate(template.organizationId);
    
    if (existing) {
      const updated = { ...existing, ...template };
      this.loteTemplates.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newTemplate: LoteTemplate = {
        ...template,
        id,
        createdAt: new Date()
      };
      this.loteTemplates.set(id, newTemplate);
      return newTemplate;
    }
  }

  // Zones
  async getZonesByOrganization(organizationId: string): Promise<Zone[]> {
    return Array.from(this.zones.values()).filter(zone => zone.organizationId === organizationId && zone.isActive);
  }

  async getZonesByStage(organizationId: string, stage: string): Promise<Zone[]> {
    return Array.from(this.zones.values()).filter(zone => 
      zone.organizationId === organizationId && zone.stage === stage && zone.isActive
    );
  }

  async getZone(id: string, organizationId: string): Promise<Zone | undefined> {
    const zone = this.zones.get(id);
    return zone && zone.organizationId === organizationId ? zone : undefined;
  }

  async createZone(zone: InsertZone): Promise<Zone> {
    const id = randomUUID();
    const newZone: Zone = { 
      ...zone, 
      id, 
      createdAt: new Date(),
      fixedInfo: zone.fixedInfo ?? null,
      temperatureTarget: zone.temperatureTarget ?? null,
      humidityTarget: zone.humidityTarget ?? null,
      isActive: zone.isActive ?? null
    };
    this.zones.set(id, newZone);
    return newZone;
  }

  async updateZone(id: string, zone: Partial<InsertZone>, organizationId: string): Promise<Zone | undefined> {
    const existing = this.zones.get(id);
    if (!existing || existing.organizationId !== organizationId) return undefined;
    
    const updated = { ...existing, ...zone };
    this.zones.set(id, updated);
    return updated;
  }

  async deleteZone(id: string, organizationId: string): Promise<boolean> {
    const zone = this.zones.get(id);
    if (!zone || zone.organizationId !== organizationId) return false;
    
    // Check for active stays
    const activeStays = Array.from(this.stays.values()).filter(stay => 
      stay.zoneId === id && !stay.exitTime
    );
    if (activeStays.length > 0) return false;
    
    // Mark as inactive instead of deleting
    const updated = { ...zone, isActive: false };
    this.zones.set(id, updated);
    return true;
  }

  // Stays
  async getStaysByLote(loteId: string): Promise<Stay[]> {
    return Array.from(this.stays.values())
      .filter(stay => stay.loteId === loteId)
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
  }

  async getActiveStayByLote(loteId: string): Promise<Stay | undefined> {
    return Array.from(this.stays.values()).find(stay => stay.loteId === loteId && !stay.exitTime);
  }

  async getStaysByZone(zoneId: string): Promise<Stay[]> {
    return Array.from(this.stays.values()).filter(stay => stay.zoneId === zoneId);
  }

  async createStay(stay: InsertStay): Promise<Stay> {
    const id = randomUUID();
    const newStay: Stay = { 
      ...stay, 
      id, 
      createdAt: new Date() 
    };
    this.stays.set(id, newStay);
    return newStay;
  }

  async updateStay(id: string, stay: Partial<InsertStay>): Promise<Stay | undefined> {
    const existing = this.stays.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...stay };
    this.stays.set(id, updated);
    return updated;
  }

  async closeStay(id: string, exitTime: Date): Promise<Stay | undefined> {
    const existing = this.stays.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, exitTime };
    this.stays.set(id, updated);
    return updated;
  }

  // Sensors
  async getSensorsByZone(zoneId: string): Promise<Sensor[]> {
    return Array.from(this.sensors.values()).filter(sensor => sensor.zoneId === zoneId && sensor.isActive);
  }

  async getSensorsByOrganization(organizationId: string): Promise<Sensor[]> {
    return Array.from(this.sensors.values()).filter(sensor => sensor.organizationId === organizationId && sensor.isActive);
  }

  async getSensor(id: string): Promise<Sensor | undefined> {
    return this.sensors.get(id);
  }

  async getSensorByDeviceId(deviceId: string): Promise<Sensor | undefined> {
    return Array.from(this.sensors.values()).find(sensor => sensor.deviceId === deviceId);
  }

  async createSensor(sensor: InsertSensor & { deviceId: string; mqttTopic: string; mqttUsername: string; mqttPassword: string }): Promise<Sensor> {
    const id = randomUUID();
    const newSensor: Sensor = { 
      ...sensor, 
      id, 
      createdAt: new Date() 
    };
    this.sensors.set(id, newSensor);
    return newSensor;
  }

  async updateSensor(id: string, sensor: Partial<InsertSensor>): Promise<Sensor | undefined> {
    const existing = this.sensors.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...sensor };
    this.sensors.set(id, updated);
    return updated;
  }

  async rotateSensorCredentials(id: string): Promise<{ username: string; password: string } | undefined> {
    const sensor = this.sensors.get(id);
    if (!sensor) return undefined;
    
    const newUsername = `sensor_${randomUUID().substring(0, 8)}`;
    const newPassword = randomUUID();
    
    const updated = { ...sensor, mqttUsername: newUsername, mqttPassword: newPassword };
    this.sensors.set(id, updated);
    
    return { username: newUsername, password: newPassword };
  }

  async deleteSensor(id: string): Promise<boolean> {
    const sensor = this.sensors.get(id);
    if (!sensor) return false;
    
    // Mark as inactive
    const updated = { ...sensor, isActive: false };
    this.sensors.set(id, updated);
    return true;
  }

  // Sensor Readings
  async getSensorReadings(sensorId: string, startTime?: Date, endTime?: Date, includeSimulated = true): Promise<SensorReading[]> {
    let readings = Array.from(this.sensorReadings.values()).filter(reading => reading.sensorId === sensorId);
    
    if (!includeSimulated) {
      readings = readings.filter(reading => !reading.isSimulated);
    }
    
    if (startTime) {
      readings = readings.filter(reading => reading.timestamp >= startTime);
    }
    
    if (endTime) {
      readings = readings.filter(reading => reading.timestamp <= endTime);
    }
    
    return readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getLatestReadingBySensor(sensorId: string): Promise<SensorReading | undefined> {
    const readings = Array.from(this.sensorReadings.values())
      .filter(reading => reading.sensorId === sensorId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return readings[0];
  }

  async getLatestReadingsByZone(zoneId: string, today?: Date): Promise<Array<SensorReading & { sensor: Sensor }>>  {
    const sensors = await this.getSensorsByZone(zoneId);
    const results: Array<SensorReading & { sensor: Sensor }> = [];
    
    for (const sensor of sensors) {
      let readings = Array.from(this.sensorReadings.values())
        .filter(reading => reading.sensorId === sensor.id);
      
      if (today) {
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        
        readings = readings.filter(reading => 
          reading.timestamp >= startOfDay && reading.timestamp <= endOfDay
        );
      }
      
      const latest = readings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      if (latest) {
        results.push({ ...latest, sensor });
      }
    }
    
    return results;
  }

  async createSensorReading(reading: InsertSensorReading): Promise<SensorReading> {
    const id = randomUUID();
    const newReading: SensorReading = { 
      ...reading, 
      id, 
      createdAt: new Date() 
    };
    this.sensorReadings.set(id, newReading);
    return newReading;
  }

  // QR Snapshots
  async getQrSnapshotsByOrganization(organizationId: string): Promise<QrSnapshot[]> {
    const orgLotes = await this.getLotesByOrganization(organizationId);
    const loteIds = new Set(orgLotes.map(l => l.id));
    
    return Array.from(this.qrSnapshots.values())
      .filter(snapshot => loteIds.has(snapshot.loteId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getQrSnapshotByToken(token: string): Promise<QrSnapshot | undefined> {
    return Array.from(this.qrSnapshots.values()).find(snapshot => 
      snapshot.publicToken === token && snapshot.isActive
    );
  }

  async getQrSnapshot(id: string): Promise<QrSnapshot | undefined> {
    return this.qrSnapshots.get(id);
  }

  async updateQrSnapshot(id: string, data: Partial<Pick<QrSnapshot, 'publicToken' | 'scanCount' | 'isActive'>>): Promise<QrSnapshot | undefined> {
    const snapshot = this.qrSnapshots.get(id);
    if (!snapshot) return undefined;
    
    const updated = { ...snapshot, ...data };
    this.qrSnapshots.set(id, updated);
    return updated;
  }

  async createQrSnapshot(snapshot: InsertQrSnapshot & { publicToken: string }): Promise<QrSnapshot> {
    const id = randomUUID();
    const newSnapshot: QrSnapshot = { 
      ...snapshot, 
      id, 
      scanCount: 0,
      createdAt: new Date() 
    };
    this.qrSnapshots.set(id, newSnapshot);
    return newSnapshot;
  }

  async incrementScanCount(token: string): Promise<void> {
    const snapshot = Array.from(this.qrSnapshots.values()).find(s => s.publicToken === token);
    if (snapshot) {
      const updated = { ...snapshot, scanCount: (snapshot.scanCount || 0) + 1 };
      this.qrSnapshots.set(snapshot.id, updated);
    }
  }

  async revokeQrSnapshot(id: string, organizationId: string): Promise<boolean> {
    const snapshot = this.qrSnapshots.get(id);
    if (!snapshot) return false;
    
    const lote = this.lotes.get(snapshot.loteId);
    if (!lote || lote.organizationId !== organizationId) return false;
    
    const updated = { ...snapshot, isActive: false };
    this.qrSnapshots.set(id, updated);
    return true;
  }

  // Audit Log
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const newLog: AuditLog = { 
      ...log, 
      id,
      oldData: log.oldData || null,
      newData: log.newData || null,
      timestamp: new Date() 
    };
    this.auditLogs.set(id, newLog);
    return newLog;
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter(log => log.entityType === entityType && log.entityId === entityId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

import { PostgresStorage } from "./postgres-storage";

// Use PostgreSQL for persistence, fallback to memory for testing
export const storage = process.env.STORAGE === 'memory' 
  ? new MemStorage() 
  : new PostgresStorage();
