import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import {
  insertLoteSchema,
  insertZoneSchema,
  insertSensorSchema,
  sensorMqttConfigSchema,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { mqttService } from "./mqtt-service";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "No autorizado" });
  }
  req.organizationId = req.user.organizationId;
  next();
}

const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // --- Alertas API ---
  app.get(
    "/api/alerts",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const alerts = await storage.getAlerts(req.organizationId);
      res.json(alerts);
    }),
  );

  app.get(
    "/api/alerts/unread-count",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const count = await storage.getUnreadAlertsCount(req.organizationId);
      res.json({ count });
    }),
  );

  app.patch(
    "/api/alerts/:id/read",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      await storage.markAlertAsRead(req.params.id, req.organizationId);
      res.sendStatus(204);
    }),
  );

  // --- Lotes API ---
  app.get(
    "/api/lotes",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const lotes = await storage.getLotesByOrganization(req.organizationId);
      res.json(lotes);
    }),
  );

  app.post(
    "/api/lotes",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const loteData = insertLoteSchema.parse({
        ...req.body,
        organizationId: req.organizationId,
      });
      const lote = await storage.createLote({ ...loteData, status: "active" });
      res.status(201).json(lote);
    }),
  );

  // --- Zones API ---
  app.get(
    "/api/zones/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zoneId = req.params.id;
      console.log(
        `[DEBUG] Buscando zona ${zoneId} para org ${req.organizationId}`,
      );

      const zone = await storage.getZone(zoneId, req.organizationId);

      if (!zone) {
        console.warn(
          `[WARN] Zona ${zoneId} no encontrada o no pertenece a la org`,
        );
        return res.status(404).json({ message: "Zona no encontrada" });
      }

      res.json(zone);
    }),
  );

  app.get(
    "/api/zones",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zones = await storage.getZonesByOrganization(req.organizationId);
      res.json(zones);
    }),
  );

  app.post(
    "/api/zones",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zoneData = insertZoneSchema.parse({
        ...req.body,
        organizationId: req.organizationId,
      });
      const zone = await storage.createZone(zoneData);
      res.status(201).json(zone);
    }),
  );

  // --- Sensors API ---
  app.get(
    "/api/zones/:zoneId/sensors",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const sensors = await storage.getSensorsByZone(req.params.zoneId);
      res.json(sensors);
    }),
  );

  app.get(
    "/api/sensors/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor) return res.status(404).json({ message: "Sensor no encontrado" });
      
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone) return res.status(403).json({ message: "No autorizado" });
      
      res.json(sensor);
    }),
  );

  app.post(
    "/api/sensors",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const deviceId = `SENSOR_${randomUUID().substring(0, 8).toUpperCase()}`;
      const sensor = await storage.createSensor({
        ...insertSensorSchema.parse({
          ...req.body,
          organizationId: req.organizationId,
        }),
        deviceId,
        mqttTopic: `sensors/${deviceId}/data`,
        mqttUsername: `u_${randomUUID().substring(0, 8)}`,
        mqttPassword: randomUUID(),
      });
      res.status(201).json(sensor);
    }),
  );

  app.patch(
    "/api/sensors/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor)
        return res.status(404).json({ message: "Sensor no encontrado" });

      // Verificamos que el sensor pertenezca a la zona de la organización
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone) return res.status(403).json({ message: "No autorizado" });

      const updated = await storage.updateSensor(req.params.id, req.body);
      res.json(updated);
    }),
  );

  app.put(
    "/api/sensors/:id/mqtt-config",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const mqttConfig = sensorMqttConfigSchema.parse(req.body);
      const updated = await storage.updateSensorMqttConfig(
        req.params.id,
        mqttConfig,
      );
      if (!updated) return res.status(404).json({ message: "No encontrado" });
      await mqttService.forceRefresh();
      res.json(updated);
    }),
  );

  app.get(
    "/api/sensors/:id/readings/latest",
    requireAuth,
    asyncHandler(async (req: any, res: any) => {
      const reading = await storage.getLatestReadingBySensor(req.params.id);
      if (!reading) return res.status(404).json({ message: "No hay lecturas" });
      res.json(reading);
    }),
  );

  app.get(
    "/api/sensors/:id/readings",
    requireAuth,
    asyncHandler(async (req: any, res: any) => {
      const startTime = req.query.startTime ? new Date(req.query.startTime as string) : undefined;
      const endTime = req.query.endTime ? new Date(req.query.endTime as string) : undefined;
      const includeSimulated = req.query.includeSimulated === 'true';
      const readings = await storage.getSensorReadings(req.params.id, startTime, endTime, includeSimulated);
      res.json(readings);
    }),
  );

  app.post(
    "/api/sensors/:id/simulate",
    requireAuth,
    asyncHandler(async (req: any, res: any) => {
      const sensorId = req.params.id;
      const sensor = await storage.getSensor(sensorId);
      if (!sensor) return res.status(404).json({ message: "Sensor no encontrado" });

      const { mode, value, minValue, maxValue, interval, duration, count, addNoise, markAsSimulated, useRealtime } = req.body;

      const readings = [];
      const now = new Date();
      const baseTime = useRealtime ? now.getTime() : now.getTime();

      // Ensure values are numbers
      const baseValue = parseFloat(value) || 0;
      const minVal = parseFloat(minValue) || 0;
      const maxVal = parseFloat(maxValue) || 0;

      if (mode === 'single') {
        const val = addNoise ? baseValue + (Math.random() - 0.5) * (baseValue * 0.05) : baseValue;
        readings.push({
          sensorId,
          value: val.toFixed(2),
          timestamp: new Date(baseTime),
          isSimulated: markAsSimulated
        });
      } else if (mode === 'range') {
        const val = Math.random() * (maxVal - minVal) + minVal;
        readings.push({
          sensorId,
          value: val.toFixed(2),
          timestamp: new Date(baseTime),
          isSimulated: markAsSimulated
        });
      } else if (mode === 'burst') {
        const totalReadings = parseInt(count) || 10;
        const timeGap = (parseInt(interval) || 30) * 1000;
        for (let i = 0; i < totalReadings; i++) {
          const val = baseValue + (Math.random() - 0.5) * (baseValue * 0.1);
          readings.push({
            sensorId,
            value: val.toFixed(2),
            timestamp: new Date(baseTime - (totalReadings - 1 - i) * timeGap),
            isSimulated: markAsSimulated
          });
        }
      }

      const createdReadings = [];
      for (const r of readings) {
        createdReadings.push(await storage.createSensorReading(r));
      }

      res.json({ message: "Simulación completada", count: createdReadings.length });
    }),
  );

  const httpServer = createServer(app);
  return httpServer;
}
