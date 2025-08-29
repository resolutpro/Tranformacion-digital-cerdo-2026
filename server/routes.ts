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
      const lotes = await storage.getLotesByOrganization(req.organizationId);
      res.json(lotes);
    } catch (error) {
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
      
      const lote = await storage.createLote(loteData);
      res.status(201).json(lote);
    } catch (error: any) {
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
      const zones = stage 
        ? await storage.getZonesByStage(req.organizationId, stage as string)
        : await storage.getZonesByOrganization(req.organizationId);
      res.json(zones);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener zonas" });
    }
  });

  app.post("/api/zones", requireAuth, async (req: any, res) => {
    try {
      const zoneData = insertZoneSchema.parse({
        ...req.body,
        organizationId: req.organizationId
      });
      
      const zone = await storage.createZone(zoneData);
      res.status(201).json(zone);
    } catch (error: any) {
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
      const success = await storage.deleteZone(req.params.id, req.organizationId);
      if (!success) {
        return res.status(400).json({ message: "No se puede eliminar la zona (tiene estancias activas)" });
      }
      res.sendStatus(204);
    } catch (error) {
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
      
      const sensors = await storage.getSensorsByZone(req.params.zoneId);
      res.json(sensors);
    } catch (error) {
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
      
      const sensor = await storage.createSensor({
        ...sensorData,
        deviceId: mqtt.deviceId,
        mqttTopic: mqtt.topic,
        mqttUsername: mqtt.username,
        mqttPassword: mqtt.password
      });
      
      res.status(201).json(sensor);
    } catch (error: any) {
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
      
      const { value, mode, interval, duration } = req.body;
      
      if (mode === 'single') {
        const reading = await storage.createSensorReading({
          sensorId: req.params.id,
          value: value.toString(),
          timestamp: new Date(),
          isSimulated: true
        });
        res.json({ message: "Lectura simulada creada", reading });
      } else {
        // Burst mode - create multiple readings
        const intervalMs = (interval || 30) * 1000;
        const durationMs = (duration || 5) * 60 * 1000;
        const count = Math.floor(durationMs / intervalMs);
        
        const readings = [];
        for (let i = 0; i < count; i++) {
          const timestamp = new Date(Date.now() + i * intervalMs);
          const variance = (Math.random() - 0.5) * 0.1; // ±5% variance
          const adjustedValue = value * (1 + variance);
          
          const reading = await storage.createSensorReading({
            sensorId: req.params.id,
            value: adjustedValue.toString(),
            timestamp,
            isSimulated: true
          });
          readings.push(reading);
        }
        
        res.json({ message: `${readings.length} lecturas simuladas creadas`, count: readings.length });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Error al simular lecturas" });
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
      for (const lote of lotes.filter(l => l.status === 'active')) {
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
        }
      }
      
      // Add finished lotes
      board.finalizado.lotes = lotes.filter(l => l.status === 'finished');
      
      res.json(board);
    } catch (error) {
      res.status(500).json({ message: "Error al cargar tablero" });
    }
  });

  app.post("/api/lotes/:id/move", requireAuth, async (req: any, res) => {
    try {
      const { zoneId, entryTime, createSublotes, sublotes } = req.body;
      
      const lote = await storage.getLote(req.params.id, req.organizationId);
      if (!lote) {
        return res.status(404).json({ message: "Lote no encontrado" });
      }
      
      const targetZone = await storage.getZone(zoneId, req.organizationId);
      if (!targetZone) {
        return res.status(404).json({ message: "Zona no encontrada" });
      }
      
      // Close current stay if exists
      const currentStay = await storage.getActiveStayByLote(lote.id);
      if (currentStay) {
        await storage.closeStay(currentStay.id, new Date(entryTime));
      }
      
      // Handle sublote creation (Matadero → Secadero)
      if (createSublotes && sublotes && Array.isArray(sublotes) && sublotes.length > 0) {
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
        }
        
        // Mark parent lote as finished
        await storage.updateLote(lote.id, { status: 'finished' }, req.organizationId);
      } else {
        // Regular movement
        if (targetZone.stage === 'finalizado') {
          await storage.updateLote(lote.id, { status: 'finished' }, req.organizationId);
        } else {
          await storage.createStay({
            loteId: lote.id,
            zoneId,
            entryTime: new Date(entryTime),
            createdBy: req.user.id
          });
        }
      }
      
      res.json({ message: "Movimiento registrado correctamente" });
    } catch (error: any) {
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
      
      // Count lotes by stage
      const loteCounts = { cria: 0, engorde: 0, matadero: 0, secadero: 0, distribucion: 0 };
      const activeZones = new Set();
      
      for (const lote of lotes.filter(l => l.status === 'active')) {
        const activeStay = await storage.getActiveStayByLote(lote.id);
        if (activeStay) {
          const zone = await storage.getZone(activeStay.zoneId, req.organizationId);
          if (zone && zone.stage in loteCounts) {
            loteCounts[zone.stage as keyof typeof loteCounts]++;
            activeZones.add(zone.id);
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
        qrCount: qrSnapshots.filter(s => s.isActive).length,
        zoneActivity
      });
    } catch (error) {
      res.status(500).json({ message: "Error al cargar dashboard" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
