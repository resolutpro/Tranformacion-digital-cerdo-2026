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

  const httpServer = createServer(app);
  return httpServer;
}
