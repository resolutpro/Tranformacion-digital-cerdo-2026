import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { 
  insertLoteSchema, 
  insertZoneSchema, 
  insertSensorSchema,
  insertSensorReadingSchema,
  insertStaySchema,
  insertQrSnapshotSchema,
  insertLoteTemplateSchema
} from "@shared/schema";
import { randomUUID } from "crypto";

// Simple logger for diagnostics
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error?.message || error || '');
  }
};

// Middleware to ensure user is authenticated and get organization
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "No autorizado" });
  }
  req.organizationId = req.user.organizationId;
  next();
}

// Generate MQTT credentials
function generateMqttCredentials(sensorName: string) {
  const deviceId = `SENSOR_${randomUUID().substring(0, 8).toUpperCase()}`;
  const topic = `sensors/${deviceId}/data`;
  const username = `sensor_${randomUUID().substring(0, 8)}`;
  const password = randomUUID();
  
  return { deviceId, topic, username, password };
}

// Generate QR snapshot data
async function generateSnapshotData(loteId: string) {
  const lote = await storage.getLote(loteId, ""); // We'll validate org access in the route
  if (!lote) throw new Error("Lote no encontrado");
  
  const stays = await storage.getStaysByLote(loteId);
  const phases: any[] = [];
  
  // Group stays by stage
  const stageGroups = new Map();
  for (const stay of stays) {
    const zone = await storage.getZone(stay.zoneId, lote.organizationId);
    if (!zone) continue;
    
    if (!stageGroups.has(zone.stage)) {
      stageGroups.set(zone.stage, []);
    }
    stageGroups.get(zone.stage).push({ stay, zone });
  }
  
  // Process each stage
  for (const [stage, stayZones] of Array.from(stageGroups.entries())) {
    const startTime = Math.min(...stayZones.map((sz: any) => sz.stay.entryTime.getTime()));
    const endTime = Math.max(...stayZones.map((sz: any) => sz.stay.exitTime?.getTime() || Date.now()));
    const duration = Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24)); // days
    
    const zones = Array.from(new Set(stayZones.map((sz: any) => sz.zone.name)));
    const metrics: Record<string, any> = {};
    
    // Aggregate sensor data for this phase
    for (const { stay, zone } of stayZones) {
      const sensors = await storage.getSensorsByZone(zone.id);
      for (const sensor of sensors.filter(s => s.isPublic)) {
        const readings = await storage.getSensorReadings(
          sensor.id, 
          stay.entryTime, 
          stay.exitTime || new Date(),
          false // exclude simulated
        );
        
        if (readings.length > 0) {
          const values = readings.map(r => parseFloat(r.value));
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          
          let pctInTarget;
          if (sensor.sensorType === 'temperature' && zone.temperatureTarget) {
            const inTarget = values.filter(v => 
              v >= zone.temperatureTarget!.min && v <= zone.temperatureTarget!.max
            ).length;
            pctInTarget = Math.round((inTarget / values.length) * 100);
          } else if (sensor.sensorType === 'humidity' && zone.humidityTarget) {
            const inTarget = values.filter(v => 
              v >= zone.humidityTarget!.min && v <= zone.humidityTarget!.max
            ).length;
            pctInTarget = Math.round((inTarget / values.length) * 100);
          }
          
          metrics[sensor.sensorType] = {
            avg: Math.round(avg * 10) / 10,
            min: Math.round(min * 10) / 10,
            max: Math.round(max * 10) / 10,
            ...(pctInTarget !== undefined && { pctInTarget })
          };
        }
      }
    }
    
    phases.push({
      stage,
      zones,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration,
      metrics
    });
  }
  
  return {
    lote: {
      id: lote.id,
      name: lote.identification,
      iberianPercentage: 100, // Default, could be in custom data
      regime: lote.foodRegime
    },
    phases,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: "1.0"
    }
  };
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Lotes API
  app.get("/api/lotes", requireAuth, async (req: any, res) => {
    try {
      logger.info('GET /api/lotes', { organizationId: req.organizationId });
      const lotes = await storage.getLotesByOrganization(req.organizationId);
      res.json(lotes);
    } catch (error: any) {
      logger.error('Error getting lotes', { organizationId: req.organizationId, error });
      res.status(500).json({ message: "Error al obtener lotes" });
    }
  });

  app.post("/api/lotes", requireAuth, async (req: any, res) => {
    try {
      const loteData = insertLoteSchema.parse({
        ...req.body,
        organizationId: req.organizationId
      });
      
      // Check unique identification within organization
      const existing = await storage.getLotesByOrganization(req.organizationId);
      if (existing.some(l => l.identification === loteData.identification)) {
        return res.status(400).json({ message: "La identificación del lote ya existe" });
      }
      
      // Ensure new lotes start as active
      const loteWithStatus = {
        ...loteData,
        status: 'active'
      };
      
      logger.info('POST /api/lotes', { organizationId: req.organizationId, payload: loteWithStatus });
      const lote = await storage.createLote(loteWithStatus);
      logger.info('Lote created', { loteId: lote.id, status: lote.status });
      res.status(201).json(lote);
    } catch (error: any) {
      logger.error('Error creating lote', { organizationId: req.organizationId, error });
      res.status(400).json({ message: error.message || "Error al crear lote" });
    }
  });

  app.put("/api/lotes/:id", requireAuth, async (req: any, res) => {
    try {
      const loteData = insertLoteSchema.partial().parse(req.body);
      const lote = await storage.updateLote(req.params.id, loteData, req.organizationId);
      
      if (!lote) {
        return res.status(404).json({ message: "Lote no encontrado" });
      }
      
      res.json(lote);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Error al actualizar lote" });
    }
  });

  app.delete("/api/lotes/:id", requireAuth, async (req: any, res) => {
    try {
      const success = await storage.deleteLote(req.params.id, req.organizationId);
      if (!success) {
        return res.status(404).json({ message: "Lote no encontrado" });
      }
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar lote" });
    }
  });

  app.get("/api/lotes/:id/active-stay", requireAuth, async (req: any, res) => {
    try {
      const lote = await storage.getLote(req.params.id, req.organizationId);
      if (!lote) {
        return res.status(404).json({ message: "Lote no encontrado" });
      }
      
      const activeStay = await storage.getActiveStayByLote(req.params.id);
      if (!activeStay) {
        return res.status(404).json({ message: "No hay estancia activa" });
      }
      
      res.json(activeStay);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener estancia activa" });
    }
  });

  // Lote Templates API
  app.get("/api/lote-template", requireAuth, async (req: any, res) => {
    try {
      const template = await storage.getLoteTemplate(req.organizationId);
      res.json(template || { customFields: [] });
    } catch (error) {
      res.status(500).json({ message: "Error al obtener plantilla" });
    }
  });

  app.put("/api/lote-template", requireAuth, async (req: any, res) => {
    try {
      const templateData = insertLoteTemplateSchema.parse({
        ...req.body,
        organizationId: req.organizationId
      });
      
      const template = await storage.updateLoteTemplate(templateData);
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Error al actualizar plantilla" });
    }
  });

  // Zones API
  app.get("/api/zones", requireAuth, async (req: any, res) => {
    try {
      const { stage } = req.query;
      logger.info('GET /api/zones', { organizationId: req.organizationId, stage });
      const zones = stage 
        ? await storage.getZonesByStage(req.organizationId, stage as string)
        : await storage.getZonesByOrganization(req.organizationId);
      res.json(zones);
    } catch (error: any) {
      logger.error('Error getting zones', { organizationId: req.organizationId, error });
      res.status(500).json({ message: "Error al obtener zonas" });
    }
  });

  app.post("/api/zones", requireAuth, async (req: any, res) => {
    try {
      const zoneData = insertZoneSchema.parse({
        ...req.body,
        organizationId: req.organizationId
      });
      
      logger.info('POST /api/zones', { organizationId: req.organizationId, payload: zoneData });
      const zone = await storage.createZone(zoneData);
      
      // Audit log for zone creation
      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: 'zone',
        entityId: zone.id,
        action: 'create',
        oldData: null,
        newData: { name: zone.name, stage: zone.stage }
      });
      
      logger.info('Zone created', { zoneId: zone.id });
      res.status(201).json(zone);
    } catch (error: any) {
      logger.error('Error creating zone', { organizationId: req.organizationId, error });
      res.status(400).json({ message: error.message || "Error al crear zona" });
    }
  });

  app.get("/api/zones/:id", requireAuth, async (req: any, res) => {
    try {
      const zone = await storage.getZone(req.params.id, req.organizationId);
      if (!zone) {
        return res.status(404).json({ message: "Zona no encontrada" });
      }
      res.json(zone);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener zona" });
    }
  });

  app.put("/api/zones/:id", requireAuth, async (req: any, res) => {
    try {
      const zoneData = insertZoneSchema.partial().parse(req.body);
      const zone = await storage.updateZone(req.params.id, zoneData, req.organizationId);
      
      if (!zone) {
        return res.status(404).json({ message: "Zona no encontrada" });
      }
      
      res.json(zone);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Error al actualizar zona" });
    }
  });

  app.delete("/api/zones/:id", requireAuth, async (req: any, res) => {
    try {
      logger.info('DELETE /api/zones/:id', { zoneId: req.params.id, organizationId: req.organizationId });
      
      // Get zone data before deletion for audit log
      const zone = await storage.getZone(req.params.id, req.organizationId);
      if (!zone) {
        return res.status(404).json({ message: "Zona no encontrada" });
      }
      
      const success = await storage.deleteZone(req.params.id, req.organizationId);
      if (!success) {
        logger.error('Cannot delete zone', { zoneId: req.params.id, reason: 'active_stays' });
        return res.status(400).json({ message: "No se puede eliminar la zona (tiene estancias activas)" });
      }
      
      // Audit log for zone deletion
      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: 'zone',
        entityId: req.params.id,
        action: 'delete',
        oldData: { name: zone.name, stage: zone.stage, isActive: true },
        newData: { isActive: false }
      });
      
      logger.info('Zone deleted', { zoneId: req.params.id });
      res.sendStatus(204);
    } catch (error: any) {
      logger.error('Error deleting zone', { zoneId: req.params.id, error: error.message });
      res.status(500).json({ message: "Error al eliminar zona" });
    }
  });

  // Sensors API
  app.get("/api/zones/:zoneId/sensors", requireAuth, async (req: any, res) => {
    try {
      // Verify zone belongs to user's organization
      const zone = await storage.getZone(req.params.zoneId, req.organizationId);
      if (!zone) {
        return res.status(404).json({ message: "Zona no encontrada" });
      }
      
      logger.info('GET /api/zones/:zoneId/sensors', { organizationId: req.organizationId, zoneId: req.params.zoneId });
      const sensors = await storage.getSensorsByZone(req.params.zoneId);
      res.json(sensors);
    } catch (error: any) {
      logger.error('Error getting sensors', { organizationId: req.organizationId, zoneId: req.params.zoneId, error });
      res.status(500).json({ message: "Error al obtener sensores" });
    }
  });

  app.post("/api/sensors", requireAuth, async (req: any, res) => {
    try {
      // Verify zone belongs to user's organization
      const zone = await storage.getZone(req.body.zoneId, req.organizationId);
      if (!zone) {
        return res.status(404).json({ message: "Zona no encontrada" });
      }
      
      const mqtt = generateMqttCredentials(req.body.name);
      const sensorData = insertSensorSchema.parse({
        ...req.body,
        organizationId: req.organizationId
      });
      
      logger.info('POST /api/sensors', { organizationId: req.organizationId, payload: sensorData, mqttCredentials: mqtt });
      const sensor = await storage.createSensor({
        ...sensorData,
        deviceId: mqtt.deviceId,
        mqttTopic: mqtt.topic,
        mqttUsername: mqtt.username,
        mqttPassword: mqtt.password
      });
      
      // Audit log for sensor creation
      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: 'sensor',
        entityId: sensor.id,
        action: 'create',
        oldData: null,
        newData: { 
          name: sensor.name, 
          zoneId: sensor.zoneId, 
          sensorType: sensor.sensorType,
          deviceId: sensor.deviceId 
        }
      });
      
      logger.info('Sensor created', { sensorId: sensor.id });
      res.status(201).json(sensor);
    } catch (error: any) {
      logger.error('Error creating sensor', { organizationId: req.organizationId, error });
      res.status(400).json({ message: error.message || "Error al crear sensor" });
    }
  });

  app.put("/api/sensors/:id/rotate-credentials", requireAuth, async (req: any, res) => {
    try {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      // Verify sensor belongs to user's organization
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      const credentials = await storage.rotateSensorCredentials(req.params.id);
      res.json(credentials);
    } catch (error) {
      res.status(500).json({ message: "Error al rotar credenciales" });
    }
  });

  app.delete("/api/sensors/:id", requireAuth, async (req: any, res) => {
    try {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      // Verify sensor belongs to user's organization
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      await storage.deleteSensor(req.params.id);
      res.json({ message: "Sensor eliminado correctamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar sensor" });
    }
  });

  // Sensor Readings API
  app.get("/api/sensors/:id/readings", requireAuth, async (req: any, res) => {
    try {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      // Verify sensor belongs to user's organization
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      const { startTime, endTime, includeSimulated } = req.query;
      const readings = await storage.getSensorReadings(
        req.params.id,
        startTime ? new Date(startTime as string) : undefined,
        endTime ? new Date(endTime as string) : undefined,
        includeSimulated === 'true'
      );
      
      res.json(readings);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener lecturas" });
    }
  });

  app.post("/api/sensors/:id/simulate", requireAuth, async (req: any, res) => {
    try {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      // Verify sensor belongs to user's organization
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      const { value, mode, interval, duration, count, minValue, maxValue, addNoise, markAsSimulated, useRealtime } = req.body;
      
      if (mode === 'single') {
        const reading = await storage.createSensorReading({
          sensorId: req.params.id,
          value: value.toString(),
          timestamp: useRealtime ? new Date() : new Date(),
          isSimulated: markAsSimulated !== false
        });
        res.json({ message: "Lectura HTTP simulada creada", reading });
      } else if (mode === 'range') {
        // Random value within range
        const min = parseFloat(minValue);
        const max = parseFloat(maxValue);
        const randomValue = Math.random() * (max - min) + min;
        const finalValue = addNoise 
          ? randomValue * (1 + (Math.random() - 0.5) * 0.1) // ±5% noise
          : randomValue;
        
        const reading = await storage.createSensorReading({
          sensorId: req.params.id,
          value: finalValue.toString(),
          timestamp: useRealtime ? new Date() : new Date(),
          isSimulated: markAsSimulated !== false
        });
        res.json({ message: "Lectura HTTP aleatoria creada", reading });
      } else if (mode === 'burst') {
        // Burst mode - create multiple readings
        const burstCount = count || Math.floor(((duration || 5) * 60 * 1000) / ((interval || 30) * 1000));
        const intervalMs = (interval || 30) * 1000;
        
        const readings = [];
        for (let i = 0; i < burstCount; i++) {
          const baseTimestamp = useRealtime ? Date.now() : Date.now() - (burstCount - i) * intervalMs;
          const timestamp = new Date(baseTimestamp + i * intervalMs);
          
          let simulatedValue = value;
          if (addNoise) {
            const variance = (Math.random() - 0.5) * 0.2; // ±10% variance for burst
            simulatedValue = value * (1 + variance);
          }
          
          const reading = await storage.createSensorReading({
            sensorId: req.params.id,
            value: simulatedValue.toString(),
            timestamp,
            isSimulated: markAsSimulated !== false
          });
          readings.push(reading);
        }
        
        res.json({ message: `${readings.length} lecturas HTTP en ráfaga creadas`, count: readings.length });
      } else {
        res.status(400).json({ message: "Modo de simulación no válido" });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Error al simular lecturas" });
    }
  });

  // Direct HTTP reading endpoint for external devices
  app.post("/api/sensors/:id/reading", async (req: any, res) => {
    try {
      const { deviceId, value, timestamp } = req.body;
      
      // Find sensor by device ID for external devices, or by sensor ID for internal
      const sensor = await storage.getSensorByDeviceId(deviceId) || await storage.getSensor(req.params.id);
      if (!sensor) {
        return res.status(404).json({ message: "Sensor no encontrado" });
      }
      
      const reading = await storage.createSensorReading({
        sensorId: sensor.id,
        value: value.toString(),
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        isSimulated: false // External readings are considered real
      });
      
      res.status(201).json({ message: "Lectura recibida correctamente", reading });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Error al procesar lectura" });
    }
  });

  // Stays and Tracking API
  app.get("/api/tracking/board", requireAuth, async (req: any, res) => {
    try {
      const zones = await storage.getZonesByOrganization(req.organizationId);
      const lotes = await storage.getLotesByOrganization(req.organizationId);
      
      const board: any = {
        cria: { zones: zones.filter(z => z.stage === 'cria'), lotes: [] },
        engorde: { zones: zones.filter(z => z.stage === 'engorde'), lotes: [] },
        matadero: { zones: zones.filter(z => z.stage === 'matadero'), lotes: [] },
        secadero: { zones: zones.filter(z => z.stage === 'secadero'), lotes: [] },
        distribucion: { zones: zones.filter(z => z.stage === 'distribucion'), lotes: [] },
        finalizado: { zones: [], lotes: [] }
      };
      
      // Get active stays for each lote
      const activeLotes = lotes.filter(l => l.status === 'active');
      const lotesWithoutLocation = [];
      
      for (const lote of activeLotes) {
        const activeStay = await storage.getActiveStayByLote(lote.id);
        if (activeStay) {
          const zone = await storage.getZone(activeStay.zoneId, req.organizationId);
          if (zone) {
            const stays = await storage.getStaysByLote(lote.id);
            const totalDays = stays.reduce((total, stay) => {
              const start = stay.entryTime.getTime();
              const end = stay.exitTime?.getTime() || Date.now();
              return total + Math.floor((end - start) / (1000 * 60 * 60 * 24));
            }, 0);
            
            const loteWithStay = { 
              ...lote, 
              currentZone: zone, 
              currentStay: activeStay,
              totalDays 
            };
            
            if (board[zone.stage as keyof typeof board]) {
              board[zone.stage as keyof typeof board].lotes.push(loteWithStay);
            }
          }
        } else {
          // Lote activo sin estancia - "Sin ubicación"
          lotesWithoutLocation.push({
            ...lote,
            currentZone: null,
            currentStay: null,
            totalDays: 0
          });
        }
      }
      
      // Add lotes without location to cria stage as default
      board.cria.lotes.push(...lotesWithoutLocation);
      
      // Add finished lotes
      board.finalizado.lotes = lotes.filter(l => l.status === 'finished');
      
      res.json(board);
    } catch (error) {
      res.status(500).json({ message: "Error al cargar tablero" });
    }
  });

  app.post("/api/lotes/:id/move", requireAuth, async (req: any, res) => {
    try {
      logger.info('POST /api/lotes/:id/move', { 
        loteId: req.params.id, 
        organizationId: req.organizationId,
        payload: req.body 
      });

      const { zoneId, entryTime, createSublotes, sublotes, generateQrSnapshot } = req.body;
      
      const lote = await storage.getLote(req.params.id, req.organizationId);
      if (!lote) {
        logger.error('Lote not found', { loteId: req.params.id, organizationId: req.organizationId });
        return res.status(404).json({ message: "Lote no encontrado" });
      }
      
      const targetZone = await storage.getZone(zoneId, req.organizationId);
      if (!targetZone && zoneId !== 'finalizado') {
        logger.error('Zone not found', { zoneId, organizationId: req.organizationId });
        return res.status(404).json({ message: "Zona no encontrada" });
      }
      
      // Close current stay if exists
      const currentStay = await storage.getActiveStayByLote(lote.id);
      if (currentStay) {
        await storage.closeStay(currentStay.id, new Date(entryTime));
        
        // Audit log for closing stay
        await storage.createAuditLog({
          organizationId: req.organizationId,
          userId: req.user.id,
          entityType: 'stay',
          entityId: currentStay.id,
          action: 'close',
          oldData: { exitTime: null },
          newData: { exitTime: new Date(entryTime) }
        });
      }
      
      // Handle sublote creation (Matadero → Secadero)
      if (createSublotes && sublotes && Array.isArray(sublotes) && sublotes.length > 0) {
        const createdSublotes = [];
        
        for (const subloteData of sublotes) {
          const sublote = await storage.createLote({
            organizationId: req.organizationId,
            identification: `${lote.identification}-${subloteData.piece}`,
            initialAnimals: subloteData.count,
            finalAnimals: subloteData.count,
            foodRegime: lote.foodRegime,
            parentLoteId: lote.id,
            pieceType: subloteData.piece,
            status: 'active'
          });
          
          // Create stay for sublote
          await storage.createStay({
            loteId: sublote.id,
            zoneId,
            entryTime: new Date(entryTime),
            createdBy: req.user.id
          });
          
          // Audit log for sublote creation
          await storage.createAuditLog({
            organizationId: req.organizationId,
            userId: req.user.id,
            entityType: 'lote',
            entityId: sublote.id,
            action: 'create',
            oldData: null,
            newData: { type: 'sublote', parentId: lote.id, piece: subloteData.piece }
          });
          
          createdSublotes.push(sublote);
        }
        
        // Mark parent lote as finished
        await storage.updateLote(lote.id, { status: 'finished' }, req.organizationId);
        
        // Audit log for parent lote finishing
        await storage.createAuditLog({
          organizationId: req.organizationId,
          userId: req.user.id,
          entityType: 'lote',
          entityId: lote.id,
          action: 'finish',
          oldData: { status: 'active' },
          newData: { status: 'finished', reason: 'sublotes_created' }
        });
      } else {
        // Regular movement
        if (targetZone?.stage === 'finalizado' || zoneId === 'finalizado') {
          await storage.updateLote(lote.id, { status: 'finished' }, req.organizationId);
          
          // Audit log for finishing
          await storage.createAuditLog({
            organizationId: req.organizationId,
            userId: req.user.id,
            entityType: 'lote',
            entityId: lote.id,
            action: 'finish',
            oldData: { status: 'active' },
            newData: { status: 'finished' }
          });
        } else {
          const newStay = await storage.createStay({
            loteId: lote.id,
            zoneId,
            entryTime: new Date(entryTime),
            createdBy: req.user.id
          });
          
          // Audit log for new stay
          await storage.createAuditLog({
            organizationId: req.organizationId,
            userId: req.user.id,
            entityType: 'stay',
            entityId: newStay.id,
            action: 'create',
            oldData: null,
            newData: { loteId: lote.id, zoneId, entryTime }
          });
        }
      }
      
      // Generate QR snapshot if moving to distribución and requested
      let qrSnapshot = null;
      if (generateQrSnapshot && targetZone?.stage === 'distribucion') {
        const snapshotData = await generateSnapshotData(lote.id);
        qrSnapshot = await storage.createQrSnapshot({
          loteId: lote.id,
          token: randomUUID(),
          data: JSON.stringify(snapshotData),
          createdBy: req.user.id
        });
        
        // Audit log for QR snapshot creation
        await storage.createAuditLog({
          organizationId: req.organizationId,
          userId: req.user.id,
          entityType: 'qr_snapshot',
          entityId: qrSnapshot.id,
          action: 'create',
          oldData: null,
          newData: { loteId: lote.id, token: qrSnapshot.token }
        });
        
        logger.info('QR snapshot created', { 
          loteId: lote.id, 
          snapshotId: qrSnapshot.id,
          token: qrSnapshot.token 
        });
      }
      
      logger.info('Movement completed successfully', { 
        loteId: lote.id, 
        targetZoneId: zoneId,
        userId: req.user.id 
      });
      
      const response: any = { message: "Movimiento registrado correctamente" };
      if (qrSnapshot) {
        response.qrSnapshot = {
          id: qrSnapshot.id,
          token: qrSnapshot.token,
          url: `/trazabilidad/${qrSnapshot.token}`
        };
      }
      
      res.json(response);
    } catch (error: any) {
      logger.error('Movement failed', { 
        loteId: req.params.id, 
        organizationId: req.organizationId,
        error: error.message 
      });
      res.status(400).json({ message: error.message || "Error al mover lote" });
    }
  });

  // QR Traceability API
  app.post("/api/lotes/:id/generate-qr", requireAuth, async (req: any, res) => {
    try {
      const lote = await storage.getLote(req.params.id, req.organizationId);
      if (!lote) {
        return res.status(404).json({ message: "Lote no encontrado" });
      }
      
      const snapshotData = await generateSnapshotData(lote.id);
      const publicToken = randomUUID();
      
      const qrSnapshot = await storage.createQrSnapshot({
        loteId: lote.id,
        snapshotData,
        createdBy: req.user.id,
        publicToken
      });
      
      res.json({ 
        qrSnapshot,
        publicUrl: `${req.protocol}://${req.get('host')}/trace/${publicToken}`
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Error al generar QR" });
    }
  });

  app.get("/api/qr-snapshots", requireAuth, async (req: any, res) => {
    try {
      const snapshots = await storage.getQrSnapshotsByOrganization(req.organizationId);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener códigos QR" });
    }
  });

  // Rotate QR token
  app.put("/api/qr-snapshots/:id/rotate", requireAuth, async (req: any, res) => {
    try {
      const snapshot = await storage.getQrSnapshot(req.params.id);
      if (!snapshot) {
        return res.status(404).json({ message: "Código QR no encontrado" });
      }

      // Verify ownership through lote organization
      const lote = await storage.getLote(snapshot.loteId, req.organizationId);
      if (!lote) {
        return res.status(404).json({ message: "No autorizado para este código QR" });
      }

      const newToken = randomUUID();
      const updatedSnapshot = await storage.updateQrSnapshot(snapshot.id, { 
        token: newToken,
        scanCount: 0  // Reset scan count on rotation
      });

      // Audit log for token rotation
      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: 'qr_snapshot',
        entityId: snapshot.id,
        action: 'rotate',
        oldData: { token: snapshot.token, scanCount: snapshot.scanCount },
        newData: { token: newToken, scanCount: 0 }
      });

      logger.info('QR token rotated', { 
        snapshotId: snapshot.id,
        oldToken: snapshot.token,
        newToken 
      });

      res.json({ 
        ...updatedSnapshot,
        message: "Token rotado exitosamente",
        newUrl: `/trazabilidad/${newToken}`
      });
    } catch (error: any) {
      logger.error('Error rotating QR token', { 
        snapshotId: req.params.id, 
        error: error.message 
      });
      res.status(500).json({ message: "Error al rotar token" });
    }
  });

  // Revoke QR snapshot
  app.put("/api/qr-snapshots/:id/revoke", requireAuth, async (req: any, res) => {
    try {
      const snapshot = await storage.getQrSnapshot(req.params.id);
      if (!snapshot) {
        return res.status(404).json({ message: "Código QR no encontrado" });
      }

      // Verify ownership through lote organization
      const lote = await storage.getLote(snapshot.loteId, req.organizationId);
      if (!lote) {
        return res.status(404).json({ message: "No autorizado para este código QR" });
      }

      const updatedSnapshot = await storage.updateQrSnapshot(snapshot.id, { 
        isActive: false
      });

      // Audit log for revocation
      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: 'qr_snapshot',
        entityId: snapshot.id,
        action: 'revoke',
        oldData: { isActive: true },
        newData: { isActive: false }
      });

      logger.info('QR snapshot revoked', { 
        snapshotId: snapshot.id,
        token: snapshot.token 
      });

      res.json({ 
        ...updatedSnapshot,
        message: "Código QR revocado exitosamente"
      });
    } catch (error: any) {
      logger.error('Error revoking QR snapshot', { 
        snapshotId: req.params.id, 
        error: error.message 
      });
      res.status(500).json({ message: "Error al revocar código QR" });
    }
  });

  // Public traceability endpoint (no auth required)
  app.get("/api/trace/:token", async (req, res) => {
    try {
      const snapshot = await storage.getQrSnapshotByToken(req.params.token);
      if (!snapshot) {
        return res.status(404).json({ message: "Código QR no válido o revocado" });
      }
      
      // Increment scan count
      await storage.incrementScanCount(req.params.token);
      
      res.json(snapshot.snapshotData);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener trazabilidad" });
    }
  });

  // Dashboard API
  app.get("/api/dashboard", requireAuth, async (req: any, res) => {
    try {
      const zones = await storage.getZonesByOrganization(req.organizationId);
      const lotes = await storage.getLotesByOrganization(req.organizationId);
      const qrSnapshots = await storage.getQrSnapshotsByOrganization(req.organizationId);
      
      // Count lotes by stage and collect unassigned (excluding finished)
      const loteCounts = { cria: 0, engorde: 0, matadero: 0, secadero: 0, distribucion: 0, unassigned: 0 };
      const activeZones = new Set();
      const unassignedLotes = [];
      let totalAnimals = 0;
      let subloteCount = 0;
      
      for (const lote of lotes) {
        // Skip finished lotes entirely from dashboard summaries
        if (lote.status === 'finished') {
          continue;
        }
        
        // Count total animals (only from main lotes, not sublotes)
        if (!lote.parentLoteId) {
          totalAnimals += lote.initialAnimals;
        } else {
          subloteCount++;
        }
        
        if (lote.status === 'active') {
          const activeStay = await storage.getActiveStayByLote(lote.id);
          if (activeStay) {
            const zone = await storage.getZone(activeStay.zoneId, req.organizationId);
            if (zone && zone.stage in loteCounts) {
              loteCounts[zone.stage as keyof typeof loteCounts]++;
              activeZones.add(zone.id);
            }
          } else {
            // Lote without active stay = unassigned
            loteCounts.unassigned++;
            unassignedLotes.push({
              id: lote.id,
              identification: lote.identification,
              initialAnimals: lote.initialAnimals,
              createdAt: lote.createdAt,
              pieceType: lote.pieceType
            });
          }
        }
      }
      
      // Get latest readings for active zones
      const today = new Date();
      const zoneActivity = [];
      
      for (const zone of zones.filter(z => activeZones.has(z.id))) {
        const readings = await storage.getLatestReadingsByZone(zone.id, today);
        const lastActivity = readings.length > 0 
          ? Math.max(...readings.map(r => r.timestamp.getTime()))
          : null;
        
        zoneActivity.push({
          zone,
          readings,
          lastActivity: lastActivity ? new Date(lastActivity) : null
        });
      }
      
      res.json({
        loteCounts,
        totalAnimals,
        subloteCount,
        qrCount: qrSnapshots.filter(s => s.isActive).length,
        zoneActivity,
        unassignedLotes
      });
    } catch (error) {
      res.status(500).json({ message: "Error al cargar dashboard" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
