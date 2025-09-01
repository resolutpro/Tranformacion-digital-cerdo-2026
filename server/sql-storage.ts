import Database from "better-sqlite3";
import session from "express-session";
import createMemoryStore from "memorystore";
import { randomUUID } from "crypto";
import type { SessionStore } from "express-session";
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
import type { IStorage } from "./storage";

const MemoryStore = createMemoryStore(session);

export class SqlStorage implements IStorage {
  private db: Database.Database;
  public readonly sessionStore: SessionStore;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath || 'livestock.db');
    
    // Configure SQLite for better performance and integrity
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeTables();
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  private initializeTables() {
    // Organizations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Lote templates table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lote_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        custom_fields TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Lotes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lotes (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        identification TEXT NOT NULL,
        initial_animals INTEGER NOT NULL,
        final_animals INTEGER NULL,
        food_regime TEXT NULL,
        custom_data TEXT NULL,
        status TEXT DEFAULT 'active',
        parent_lote_id TEXT NULL REFERENCES lotes(id),
        piece_type TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Zones table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        name TEXT NOT NULL,
        stage TEXT NOT NULL,
        fixed_info TEXT NULL,
        temperature_target TEXT NULL,
        humidity_target TEXT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Stays table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stays (
        id TEXT PRIMARY KEY,
        lote_id TEXT NOT NULL REFERENCES lotes(id),
        zone_id TEXT NOT NULL REFERENCES zones(id),
        entry_time DATETIME NOT NULL,
        exit_time DATETIME NULL,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sensors table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sensors (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        zone_id TEXT NOT NULL REFERENCES zones(id),
        name TEXT NOT NULL,
        device_id TEXT UNIQUE NOT NULL,
        sensor_type TEXT NOT NULL,
        unit TEXT NULL,
        mqtt_topic TEXT UNIQUE NOT NULL,
        mqtt_username TEXT NOT NULL,
        mqtt_password TEXT NOT NULL,
        validation_min REAL NULL,
        validation_max REAL NULL,
        is_active INTEGER DEFAULT 1,
        is_public INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sensor readings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id TEXT PRIMARY KEY,
        sensor_id TEXT NOT NULL REFERENCES sensors(id),
        value TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        is_simulated INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // QR snapshots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS qr_snapshots (
        id TEXT PRIMARY KEY,
        lote_id TEXT NOT NULL REFERENCES lotes(id),
        public_token TEXT UNIQUE NOT NULL,
        snapshot_data TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        scan_count INTEGER DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audit log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_data TEXT NULL,
        new_data TEXT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const stmt = this.db.prepare('SELECT * FROM organizations WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapOrganization(row) : undefined;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const stmt = this.db.prepare(
      'INSERT INTO organizations (id, name) VALUES (?, ?)'
    );
    stmt.run(id, org.name);
    
    const created: Organization = { 
      ...org, 
      id, 
      createdAt: new Date() 
    };
    return created;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapUser(row) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username) as any;
    return row ? this.mapUser(row) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    return row ? this.mapUser(row) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const stmt = this.db.prepare(
      'INSERT INTO users (id, organization_id, username, email, password) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, user.organizationId, user.username, user.email, user.password);
    
    const created: User = { 
      ...user, 
      id, 
      createdAt: new Date() 
    };
    return created;
  }

  // Lotes
  async getLotesByOrganization(organizationId: string): Promise<Lote[]> {
    const stmt = this.db.prepare('SELECT * FROM lotes WHERE organization_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(organizationId) as any[];
    return rows.map(row => this.mapLote(row));
  }

  async getLote(id: string, organizationId: string): Promise<Lote | undefined> {
    const stmt = this.db.prepare('SELECT * FROM lotes WHERE id = ? AND organization_id = ?');
    const row = stmt.get(id, organizationId) as any;
    return row ? this.mapLote(row) : undefined;
  }

  async createLote(lote: InsertLote): Promise<Lote> {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO lotes (id, organization_id, identification, initial_animals, final_animals, 
                        food_regime, custom_data, status, parent_lote_id, piece_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      lote.organizationId,
      lote.identification,
      lote.initialAnimals,
      lote.finalAnimals || null,
      lote.foodRegime || null,
      lote.customData ? JSON.stringify(lote.customData) : null,
      lote.status || 'activo',
      lote.parentLoteId || null,
      lote.pieceType || null
    );
    
    const created: Lote = { 
      ...lote,
      id,
      finalAnimals: lote.finalAnimals || null,
      foodRegime: lote.foodRegime || null,
      customData: lote.customData || null,
      status: lote.status || 'activo',
      parentLoteId: lote.parentLoteId || null,
      pieceType: lote.pieceType || null,
      createdAt: new Date() 
    };
    return created;
  }

  async updateLote(id: string, lote: Partial<InsertLote>, organizationId: string): Promise<Lote | undefined> {
    const existing = await this.getLote(id, organizationId);
    if (!existing) return undefined;
    
    const updates = [];
    const values = [];
    
    if (lote.identification !== undefined) {
      updates.push('identification = ?');
      values.push(lote.identification);
    }
    if (lote.initialAnimals !== undefined) {
      updates.push('initial_animals = ?');
      values.push(lote.initialAnimals);
    }
    if (lote.finalAnimals !== undefined) {
      updates.push('final_animals = ?');
      values.push(lote.finalAnimals);
    }
    if (lote.foodRegime !== undefined) {
      updates.push('food_regime = ?');
      values.push(lote.foodRegime);
    }
    if (lote.customData !== undefined) {
      updates.push('custom_data = ?');
      values.push(lote.customData ? JSON.stringify(lote.customData) : null);
    }
    if (lote.status !== undefined) {
      updates.push('status = ?');
      values.push(lote.status);
    }
    
    if (updates.length === 0) return existing;
    
    values.push(id, organizationId);
    const stmt = this.db.prepare(
      `UPDATE lotes SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`
    );
    stmt.run(...values);
    
    return this.getLote(id, organizationId);
  }

  async deleteLote(id: string, organizationId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM lotes WHERE id = ? AND organization_id = ?');
    const result = stmt.run(id, organizationId);
    return result.changes > 0;
  }

  // Lote Templates
  async getLoteTemplate(organizationId: string): Promise<LoteTemplate | undefined> {
    const stmt = this.db.prepare('SELECT * FROM lote_templates WHERE organization_id = ?');
    const row = stmt.get(organizationId) as any;
    return row ? this.mapLoteTemplate(row) : undefined;
  }

  async updateLoteTemplate(template: InsertLoteTemplate): Promise<LoteTemplate> {
    const existing = await this.getLoteTemplate(template.organizationId);
    
    if (existing) {
      const stmt = this.db.prepare(
        'UPDATE lote_templates SET custom_fields = ? WHERE organization_id = ?'
      );
      stmt.run(JSON.stringify(template.customFields), template.organizationId);
    } else {
      const id = randomUUID();
      const stmt = this.db.prepare(
        'INSERT INTO lote_templates (id, organization_id, custom_fields) VALUES (?, ?, ?)'
      );
      stmt.run(id, template.organizationId, JSON.stringify(template.customFields));
    }
    
    return this.getLoteTemplate(template.organizationId) as LoteTemplate;
  }

  // Zones
  async getZonesByOrganization(organizationId: string): Promise<Zone[]> {
    const stmt = this.db.prepare('SELECT * FROM zones WHERE organization_id = ? AND is_active = 1 ORDER BY stage, name');
    const rows = stmt.all(organizationId) as any[];
    return rows.map(row => this.mapZone(row));
  }

  async getZonesByStage(organizationId: string, stage: string): Promise<Zone[]> {
    const stmt = this.db.prepare('SELECT * FROM zones WHERE organization_id = ? AND stage = ? AND is_active = 1 ORDER BY name');
    const rows = stmt.all(organizationId, stage) as any[];
    return rows.map(row => this.mapZone(row));
  }

  async getZone(id: string, organizationId: string): Promise<Zone | undefined> {
    const stmt = this.db.prepare('SELECT * FROM zones WHERE id = ? AND organization_id = ?');
    const row = stmt.get(id, organizationId) as any;
    return row ? this.mapZone(row) : undefined;
  }

  async createZone(zone: InsertZone): Promise<Zone> {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO zones (id, organization_id, name, stage, fixed_info, temperature_target, humidity_target, is_active) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    
    stmt.run(
      id,
      zone.organizationId,
      zone.name,
      zone.stage,
      zone.fixedInfo ? JSON.stringify(zone.fixedInfo) : null,
      zone.temperatureTarget ? JSON.stringify(zone.temperatureTarget) : null,
      zone.humidityTarget ? JSON.stringify(zone.humidityTarget) : null
    );
    
    const created: Zone = { 
      ...zone,
      id,
      fixedInfo: zone.fixedInfo || null,
      temperatureTarget: zone.temperatureTarget || null,
      humidityTarget: zone.humidityTarget || null,
      isActive: true,
      createdAt: new Date() 
    };
    return created;
  }

  async updateZone(id: string, zone: Partial<InsertZone>, organizationId: string): Promise<Zone | undefined> {
    const existing = await this.getZone(id, organizationId);
    if (!existing) return undefined;
    
    const updates = [];
    const values = [];
    
    if (zone.name !== undefined) {
      updates.push('name = ?');
      values.push(zone.name);
    }
    if (zone.stage !== undefined) {
      updates.push('stage = ?');
      values.push(zone.stage);
    }
    if (zone.fixedInfo !== undefined) {
      updates.push('fixed_info = ?');
      values.push(zone.fixedInfo ? JSON.stringify(zone.fixedInfo) : null);
    }
    if (zone.temperatureTarget !== undefined) {
      updates.push('temperature_target = ?');
      values.push(zone.temperatureTarget ? JSON.stringify(zone.temperatureTarget) : null);
    }
    if (zone.humidityTarget !== undefined) {
      updates.push('humidity_target = ?');
      values.push(zone.humidityTarget ? JSON.stringify(zone.humidityTarget) : null);
    }
    
    if (updates.length === 0) return existing;
    
    values.push(id, organizationId);
    const stmt = this.db.prepare(
      `UPDATE zones SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`
    );
    stmt.run(...values);
    
    return this.getZone(id, organizationId);
  }

  async deleteZone(id: string, organizationId: string): Promise<boolean> {
    const stmt = this.db.prepare('UPDATE zones SET is_active = 0 WHERE id = ? AND organization_id = ?');
    const result = stmt.run(id, organizationId);
    return result.changes > 0;
  }

  // Continues with all other IStorage methods...
  // (I'll continue with the rest in the next edit)

  // Helper mapping methods
  private mapOrganization(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at)
    };
  }

  private mapUser(row: any): User {
    return {
      id: row.id,
      organizationId: row.organization_id,
      username: row.username,
      email: row.email,
      password: row.password,
      createdAt: new Date(row.created_at)
    };
  }

  private mapLote(row: any): Lote {
    return {
      id: row.id,
      organizationId: row.organization_id,
      identification: row.identification,
      initialAnimals: row.initial_animals,
      finalAnimals: row.final_animals,
      foodRegime: row.food_regime,
      customData: row.custom_data ? JSON.parse(row.custom_data) : null,
      status: row.status,
      parentLoteId: row.parent_lote_id,
      pieceType: row.piece_type,
      createdAt: new Date(row.created_at)
    };
  }

  private mapLoteTemplate(row: any): LoteTemplate {
    return {
      id: row.id,
      organizationId: row.organization_id,
      customFields: JSON.parse(row.custom_fields),
      createdAt: new Date(row.created_at)
    };
  }

  private mapZone(row: any): Zone {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      stage: row.stage,
      fixedInfo: row.fixed_info ? JSON.parse(row.fixed_info) : null,
      temperatureTarget: row.temperature_target ? JSON.parse(row.temperature_target) : null,
      humidityTarget: row.humidity_target ? JSON.parse(row.humidity_target) : null,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at)
    };
  }

  // Stays
  async getStaysByLote(loteId: string): Promise<Stay[]> {
    const stmt = this.db.prepare('SELECT * FROM stays WHERE lote_id = ? ORDER BY entry_time DESC');
    const rows = stmt.all(loteId) as any[];
    return rows.map(row => this.mapStay(row));
  }

  async getActiveStayByLote(loteId: string): Promise<Stay | undefined> {
    const stmt = this.db.prepare('SELECT * FROM stays WHERE lote_id = ? AND exit_time IS NULL ORDER BY entry_time DESC LIMIT 1');
    const row = stmt.get(loteId) as any;
    return row ? this.mapStay(row) : undefined;
  }

  async getStaysByZone(zoneId: string): Promise<Stay[]> {
    const stmt = this.db.prepare('SELECT * FROM stays WHERE zone_id = ? ORDER BY entry_time DESC');
    const rows = stmt.all(zoneId) as any[];
    return rows.map(row => this.mapStay(row));
  }

  async createStay(stay: InsertStay): Promise<Stay> {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO stays (id, lote_id, zone_id, entry_time, exit_time, created_by) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      stay.loteId,
      stay.zoneId,
      stay.entryTime.toISOString(),
      stay.exitTime ? stay.exitTime.toISOString() : null,
      stay.createdBy
    );
    
    const created: Stay = { 
      ...stay,
      id,
      exitTime: stay.exitTime || null,
      createdAt: new Date() 
    };
    return created;
  }

  async updateStay(id: string, stay: Partial<InsertStay>): Promise<Stay | undefined> {
    const updates = [];
    const values = [];
    
    if (stay.exitTime !== undefined) {
      updates.push('exit_time = ?');
      values.push(stay.exitTime ? stay.exitTime.toISOString() : null);
    }
    
    if (updates.length === 0) {
      const stmt = this.db.prepare('SELECT * FROM stays WHERE id = ?');
      const row = stmt.get(id) as any;
      return row ? this.mapStay(row) : undefined;
    }
    
    values.push(id);
    const stmt = this.db.prepare(
      `UPDATE stays SET ${updates.join(', ')} WHERE id = ?`
    );
    stmt.run(...values);
    
    const updatedStmt = this.db.prepare('SELECT * FROM stays WHERE id = ?');
    const row = updatedStmt.get(id) as any;
    return row ? this.mapStay(row) : undefined;
  }

  async closeStay(id: string, exitTime: Date): Promise<Stay | undefined> {
    return this.updateStay(id, { exitTime });
  }

  // Sensors
  async getSensorsByZone(zoneId: string): Promise<Sensor[]> {
    const stmt = this.db.prepare('SELECT * FROM sensors WHERE zone_id = ? AND is_active = 1 ORDER BY name');
    const rows = stmt.all(zoneId) as any[];
    return rows.map(row => this.mapSensor(row));
  }

  async getSensorsByOrganization(organizationId: string): Promise<Sensor[]> {
    const stmt = this.db.prepare('SELECT * FROM sensors WHERE organization_id = ? AND is_active = 1 ORDER BY name');
    const rows = stmt.all(organizationId) as any[];
    return rows.map(row => this.mapSensor(row));
  }

  async getSensor(id: string): Promise<Sensor | undefined> {
    const stmt = this.db.prepare('SELECT * FROM sensors WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapSensor(row) : undefined;
  }

  async getSensorByDeviceId(deviceId: string): Promise<Sensor | undefined> {
    const stmt = this.db.prepare('SELECT * FROM sensors WHERE device_id = ?');
    const row = stmt.get(deviceId) as any;
    return row ? this.mapSensor(row) : undefined;
  }

  async createSensor(sensor: InsertSensor & { deviceId: string; mqttTopic: string; mqttUsername: string; mqttPassword: string }): Promise<Sensor> {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO sensors (id, organization_id, zone_id, name, device_id, sensor_type, unit, 
                          mqtt_topic, mqtt_username, mqtt_password, validation_min, validation_max, 
                          is_active, is_public) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `);
    
    stmt.run(
      id,
      sensor.organizationId,
      sensor.zoneId,
      sensor.name,
      sensor.deviceId,
      sensor.sensorType,
      sensor.unit || null,
      sensor.mqttTopic,
      sensor.mqttUsername,
      sensor.mqttPassword,
      sensor.validationMin ? parseFloat(sensor.validationMin.toString()) : null,
      sensor.validationMax ? parseFloat(sensor.validationMax.toString()) : null
    );
    
    const created: Sensor = { 
      ...sensor,
      id,
      unit: sensor.unit || null,
      validationMin: sensor.validationMin || null,
      validationMax: sensor.validationMax || null,
      isActive: true,
      isPublic: true,
      createdAt: new Date() 
    };
    return created;
  }

  async updateSensor(id: string, sensor: Partial<InsertSensor>): Promise<Sensor | undefined> {
    const updates = [];
    const values = [];
    
    if (sensor.name !== undefined) {
      updates.push('name = ?');
      values.push(sensor.name);
    }
    if (sensor.sensorType !== undefined) {
      updates.push('sensor_type = ?');
      values.push(sensor.sensorType);
    }
    if (sensor.unit !== undefined) {
      updates.push('unit = ?');
      values.push(sensor.unit);
    }
    
    if (updates.length === 0) {
      return this.getSensor(id);
    }
    
    values.push(id);
    const stmt = this.db.prepare(
      `UPDATE sensors SET ${updates.join(', ')} WHERE id = ?`
    );
    stmt.run(...values);
    
    return this.getSensor(id);
  }

  async rotateSensorCredentials(id: string): Promise<{ username: string; password: string } | undefined> {
    const sensor = await this.getSensor(id);
    if (!sensor) return undefined;
    
    const newUsername = `sensor_${randomUUID().substring(0, 8)}`;
    const newPassword = randomUUID();
    
    const stmt = this.db.prepare(
      'UPDATE sensors SET mqtt_username = ?, mqtt_password = ? WHERE id = ?'
    );
    stmt.run(newUsername, newPassword, id);
    
    return { username: newUsername, password: newPassword };
  }

  async deleteSensor(id: string): Promise<boolean> {
    const stmt = this.db.prepare('UPDATE sensors SET is_active = 0 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Sensor Readings
  async getSensorReadings(sensorId: string, startTime?: Date, endTime?: Date, includeSimulated?: boolean): Promise<SensorReading[]> {
    let query = 'SELECT * FROM sensor_readings WHERE sensor_id = ?';
    const params = [sensorId];
    
    if (startTime) {
      query += ' AND timestamp >= ?';
      params.push(startTime.toISOString());
    }
    if (endTime) {
      query += ' AND timestamp <= ?';
      params.push(endTime.toISOString());
    }
    if (includeSimulated === false) {
      query += ' AND is_simulated = 0';
    }
    
    query += ' ORDER BY timestamp DESC';
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.mapSensorReading(row));
  }

  async getLatestReadingBySensor(sensorId: string): Promise<SensorReading | undefined> {
    const stmt = this.db.prepare('SELECT * FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 1');
    const row = stmt.get(sensorId) as any;
    return row ? this.mapSensorReading(row) : undefined;
  }

  async getLatestReadingsByZone(zoneId: string, today?: Date): Promise<Array<SensorReading & { sensor: Sensor }>> {
    let query = `
      SELECT sr.*, s.* FROM sensor_readings sr 
      JOIN sensors s ON sr.sensor_id = s.id 
      WHERE s.zone_id = ? AND s.is_active = 1
    `;
    const params = [zoneId];
    
    if (today) {
      query += ' AND DATE(sr.timestamp) = DATE(?)';
      params.push(today.toISOString());
    }
    
    query += ' ORDER BY sr.timestamp DESC';
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      ...this.mapSensorReading(row),
      sensor: this.mapSensor(row)
    }));
  }

  async createSensorReading(reading: InsertSensorReading): Promise<SensorReading> {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO sensor_readings (id, sensor_id, value, timestamp, is_simulated) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      reading.sensorId,
      reading.value,
      reading.timestamp.toISOString(),
      reading.isSimulated ? 1 : 0
    );
    
    const created: SensorReading = { 
      ...reading,
      id,
      isSimulated: reading.isSimulated || null,
      createdAt: new Date() 
    };
    return created;
  }

  // QR Snapshots
  async getQrSnapshotsByOrganization(organizationId: string): Promise<QrSnapshot[]> {
    const stmt = this.db.prepare(`
      SELECT qs.* FROM qr_snapshots qs 
      JOIN lotes l ON qs.lote_id = l.id 
      WHERE l.organization_id = ? AND qs.is_active = 1 
      ORDER BY qs.created_at DESC
    `);
    const rows = stmt.all(organizationId) as any[];
    return rows.map(row => this.mapQrSnapshot(row));
  }

  async getQrSnapshotByToken(token: string): Promise<QrSnapshot | undefined> {
    const stmt = this.db.prepare('SELECT * FROM qr_snapshots WHERE public_token = ? AND is_active = 1');
    const row = stmt.get(token) as any;
    return row ? this.mapQrSnapshot(row) : undefined;
  }

  async createQrSnapshot(snapshot: InsertQrSnapshot & { publicToken: string }): Promise<QrSnapshot> {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO qr_snapshots (id, lote_id, public_token, snapshot_data, is_active, scan_count, created_by) 
      VALUES (?, ?, ?, ?, 1, 0, ?)
    `);
    
    stmt.run(
      id,
      snapshot.loteId,
      snapshot.publicToken,
      JSON.stringify(snapshot.snapshotData),
      snapshot.createdBy
    );
    
    const created: QrSnapshot = { 
      ...snapshot,
      id,
      isActive: true,
      scanCount: 0,
      createdAt: new Date() 
    };
    return created;
  }

  async incrementScanCount(token: string): Promise<void> {
    const stmt = this.db.prepare('UPDATE qr_snapshots SET scan_count = scan_count + 1 WHERE public_token = ?');
    stmt.run(token);
  }

  async revokeQrSnapshot(id: string, organizationId: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE qr_snapshots SET is_active = 0 
      WHERE id = ? AND lote_id IN (
        SELECT id FROM lotes WHERE organization_id = ?
      )
    `);
    const result = stmt.run(id, organizationId);
    return result.changes > 0;
  }

  // Audit Log
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (id, organization_id, user_id, entity_type, entity_id, action, old_data, new_data) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      log.organizationId,
      log.userId,
      log.entityType,
      log.entityId,
      log.action,
      log.oldData ? JSON.stringify(log.oldData) : null,
      log.newData ? JSON.stringify(log.newData) : null
    );
    
    const created: AuditLog = { 
      ...log,
      id,
      oldData: log.oldData || null,
      newData: log.newData || null,
      timestamp: new Date() 
    };
    return created;
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    const stmt = this.db.prepare('SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC');
    const rows = stmt.all(entityType, entityId) as any[];
    return rows.map(row => this.mapAuditLog(row));
  }

  // Additional mapper methods
  private mapStay(row: any): Stay {
    return {
      id: row.id,
      loteId: row.lote_id,
      zoneId: row.zone_id,
      entryTime: new Date(row.entry_time),
      exitTime: row.exit_time ? new Date(row.exit_time) : null,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    };
  }

  private mapSensor(row: any): Sensor {
    return {
      id: row.id,
      organizationId: row.organization_id,
      zoneId: row.zone_id,
      name: row.name,
      deviceId: row.device_id,
      sensorType: row.sensor_type,
      unit: row.unit,
      mqttTopic: row.mqtt_topic,
      mqttUsername: row.mqtt_username,
      mqttPassword: row.mqtt_password,
      validationMin: row.validation_min ? parseFloat(row.validation_min) : null,
      validationMax: row.validation_max ? parseFloat(row.validation_max) : null,
      isActive: Boolean(row.is_active),
      isPublic: Boolean(row.is_public),
      createdAt: new Date(row.created_at)
    };
  }

  private mapSensorReading(row: any): SensorReading {
    return {
      id: row.id,
      sensorId: row.sensor_id,
      value: row.value,
      timestamp: new Date(row.timestamp),
      isSimulated: Boolean(row.is_simulated),
      createdAt: new Date(row.created_at)
    };
  }

  private mapQrSnapshot(row: any): QrSnapshot {
    return {
      id: row.id,
      loteId: row.lote_id,
      publicToken: row.public_token,
      snapshotData: JSON.parse(row.snapshot_data),
      isActive: Boolean(row.is_active),
      scanCount: row.scan_count,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    };
  }

  private mapAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      oldData: row.old_data ? JSON.parse(row.old_data) : null,
      newData: row.new_data ? JSON.parse(row.new_data) : null,
      timestamp: new Date(row.timestamp)
    };
  }
}