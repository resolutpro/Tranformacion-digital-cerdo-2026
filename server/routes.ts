import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import {
  insertLoteSchema,
  insertZoneSchema,
  insertSensorSchema,
  insertSensorReadingSchema,
  insertStaySchema,
  insertQrSnapshotSchema,
  insertZoneQrSchema,
  insertLoteTemplateSchema,
} from "@shared/schema";
import { randomUUID } from "crypto";

// Simple logger for diagnostics
const logger = {
  info: (message: string, data?: any) => {
    console.log(
      `[INFO] ${new Date().toISOString()} - ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      `[ERROR] ${new Date().toISOString()} - ${message}`,
      error?.message || error || "",
    );
  },
};

// Middleware to ensure user is authenticated and get organization
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "No autorizado" });
  }
  req.organizationId = req.user.organizationId;
  next();
}

// Helper para handlers async
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Generate MQTT credentials
function generateMqttCredentials(sensorName: string) {
  const deviceId = `SENSOR_${randomUUID().substring(0, 8).toUpperCase()}`;
  const topic = `sensors/${deviceId}/data`;
  const username = `sensor_${randomUUID().substring(0, 8)}`;
  const password = randomUUID();
  return { deviceId, topic, username, password };
}

// Generate QR snapshot data
async function generateSnapshotData(loteId: string, organizationId: string) {
  const lote = await storage.getLote(loteId, organizationId);
  if (!lote) throw new Error("Lote no encontrado");

  // For sublotes, also include parent lote's history
  let stays = await storage.getStaysByLote(loteId);
  const isSubLote = !!lote.parentLoteId;
  
  if (isSubLote) {
    const parentStays = await storage.getStaysByLote(lote.parentLoteId);
    logger.info("Sublote inheritance debug", {
      loteId,
      parentLoteId: lote.parentLoteId,
      subloteStays: stays.length,
      parentStays: parentStays.length,
    });
    // Combine parent stays with sublote stays, sorted by entry time
    stays = [...parentStays, ...stays].sort(
      (a, b) => a.entryTime.getTime() - b.entryTime.getTime(),
    );
    logger.info("Combined stays", { totalStays: stays.length });
  }

  const phases: any[] = [];

  // Group stays by stage
  const stageGroups = new Map();
  for (const stay of stays) {
    if (!stay.zoneId) continue;
    const zone = await storage.getZone(stay.zoneId, organizationId);
    if (!zone) continue;

    if (!stageGroups.has(zone.stage)) {
      stageGroups.set(zone.stage, []);
    }
    stageGroups.get(zone.stage).push({ stay, zone });
  }

  // Define stage order
  const stageOrder = [
    "cria",
    "engorde",
    "matadero",
    "secadero",
    "distribucion",
  ];

  // Sort stages by defined order
  const sortedStages = Array.from(stageGroups.entries()).sort((a, b) => {
    const indexA = stageOrder.indexOf(a[0]);
    const indexB = stageOrder.indexOf(b[0]);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  // Process each stage in order
  for (const [stage, stayZones] of sortedStages) {
    const startTime = Math.min(
      ...stayZones.map((sz: any) => sz.stay.entryTime.getTime()),
    );
    const endTime = Math.max(
      ...stayZones.map((sz: any) => sz.stay.exitTime?.getTime() || Date.now()),
    );
    const duration = Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24)); // days

    const zones = Array.from(new Set(stayZones.map((sz: any) => sz.zone.name)));
    
    // Get sensor data for each phase
    let sensorData = [];
    try {
      // For sublotes, use the parent lote ID for sensor data in pre-secadero stages
      // since the sensors were recording for the parent lote before division
      const loteIdForSensorData = isSubLote && ["cria", "engorde", "matadero"].includes(stage) 
        ? lote.parentLoteId 
        : loteId;
      
      sensorData = await storage.getSensorDataByLoteAndStage(
        loteIdForSensorData,
        stage,
        new Date(startTime),
        new Date(endTime),
      );
      console.log(`Retrieved ${sensorData.length} sensor readings for lote ${loteIdForSensorData} (original: ${loteId}), stage ${stage}`);
    } catch (error) {
      console.error(`Error fetching sensor data for phase ${stage}:`, error);
      console.error('Error stack:', error.stack);
    }

    // Calculate metrics
    const metrics: Record<string, any> = {};
    if (sensorData && sensorData.length > 0) {
      // Group by sensor type
      const sensorGroups = sensorData.reduce((acc, reading) => {
        const type = reading.sensorType || 'unknown';
        if (!acc[type]) acc[type] = [];
        if (reading.value != null && !isNaN(Number(reading.value))) {
          acc[type].push(Number(reading.value));
        }
        return acc;
      }, {} as Record<string, number[]>);

      // Calculate statistics for each sensor type
      Object.entries(sensorGroups).forEach(([type, values]) => {
        if (values.length > 0) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);

          // Calculate percentage in target range (example ranges)
          const targetRanges = {
            temperature: { min: 2, max: 8 },
            humidity: { min: 75, max: 85 },
          };

          const target = targetRanges[type as keyof typeof targetRanges];
          let pctInTarget;
          if (target) {
            const inTarget = values.filter(v => v >= target.min && v <= target.max).length;
            pctInTarget = Math.round((inTarget / values.length) * 100);
          }

          metrics[type] = {
            avg: Number(avg.toFixed(1)),
            min: Number(min.toFixed(1)),
            max: Number(max.toFixed(1)),
            ...(pctInTarget !== undefined ? { pctInTarget } : {}),
          };
        }
      });
    }

    phases.push({
      stage,
      zones,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration,
      metrics,
    });
  }

  return {
    lote: {
      id: lote.id,
      name: lote.identification,
      iberianPercentage: 100, // Default, could be in custom data
      regime: lote.foodRegime,
    },
    phases,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: "1.0",
    },
  };
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // SPA zone movement logger (el fallback real está en serveStatic)
  app.get("/zona-movimiento/*", (req, _res, next) => {
    const timestamp = new Date().toISOString();
    const token = req.path.split("/zona-movimiento/")[1];
    console.log(
      `[ZONA-MOVIMIENTO-ROUTE] ${timestamp} - Access ${token} from ${req.ip}`,
    );
    next();
  });

  // Health/status
  app.get("/api/health", (_req, res) => {
    console.log(`[API-HEALTH-CHECK] ${new Date().toISOString()}`);
    res.status(200).json({
      status: "healthy",
      api: "ready",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/status", (_req, res) => {
    res.status(200).json({
      message: "Livestock Traceability Management System API",
      status: "running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Favicon helper (en prod lo sirve serveStatic; aquí evitamos 502 si llega antes)
  app.get("/favicon.ico", (_req, res) => {
    res.type("image/x-icon").status(204).end();
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nAllow: /\n");
  });

  // --- Lotes API ---
  app.get(
    "/api/lotes",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      logger.info("GET /api/lotes", { organizationId: req.organizationId });
      const lotes = await storage.getLotesByOrganization(req.organizationId);
      res.json(lotes);
    }),
  );

  // Get sublotes for a specific lote
  app.get(
    "/api/lotes/:id/sublotes",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const sublotes = await storage.getSubLotes(
        req.params.id,
        req.organizationId,
      );
      res.json(sublotes);
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

      // Check unique identification within organization
      const existing = await storage.getLotesByOrganization(req.organizationId);
      if (existing.some((l) => l.identification === loteData.identification)) {
        return res
          .status(400)
          .json({ message: "La identificación del lote ya existe" });
      }

      // Ensure new lotes start as active
      const loteWithStatus = { ...loteData, status: "active" as const };
      logger.info("POST /api/lotes", {
        organizationId: req.organizationId,
        payload: loteWithStatus,
      });
      const lote = await storage.createLote(loteWithStatus);
      logger.info("Lote created", { loteId: lote.id, status: lote.status });
      res.status(201).json(lote);
    }),
  );

  app.put(
    "/api/lotes/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const loteData = insertLoteSchema.partial().parse(req.body);
      const lote = await storage.updateLote(
        req.params.id,
        loteData,
        req.organizationId,
      );
      if (!lote) return res.status(404).json({ message: "Lote no encontrado" });
      res.json(lote);
    }),
  );

  app.delete(
    "/api/lotes/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const success = await storage.deleteLote(
        req.params.id,
        req.organizationId,
      );
      if (!success)
        return res.status(404).json({ message: "Lote no encontrado" });
      res.sendStatus(204);
    }),
  );

  app.get(
    "/api/lotes/:id/active-stay",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const lote = await storage.getLote(req.params.id, req.organizationId);
      if (!lote) return res.status(404).json({ message: "Lote no encontrado" });
      const activeStay = await storage.getActiveStayByLote(req.params.id);
      if (!activeStay)
        return res.status(404).json({ message: "No hay estancia activa" });
      res.json(activeStay);
    }),
  );

  // --- Lote Templates API ---
  app.get(
    "/api/lote-template",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const template = await storage.getLoteTemplate(req.organizationId);
      res.json(template || { customFields: [] });
    }),
  );

  app.put(
    "/api/lote-template",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      logger.info("PUT /api/lote-template", {
        organizationId: req.organizationId,
        customFields: req.body.customFields,
        fieldsCount: req.body.customFields?.length,
      });

      const templateData = insertLoteTemplateSchema.parse({
        ...req.body,
        organizationId: req.organizationId,
      });

      const template = await storage.updateLoteTemplate(templateData);

      logger.info("Template updated successfully", {
        templateId: template.id,
        fieldsCount: template.customFields?.length,
      });

      res.json(template);
    }),
  );

  // --- Zone QR (privado) ---
  app.get(
    "/api/zones/:zoneId/qr",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      logger.info("GET /api/zones/:zoneId/qr", {
        zoneId: req.params.zoneId,
        organizationId: req.organizationId,
        hasAuth: !!req.user,
      });

      const zone = await storage.getZone(req.params.zoneId, req.organizationId);
      if (!zone) return res.status(404).json({ message: "Zona no encontrada" });

      let zoneQr = await storage.getZoneQr(zone.id);
      if (!zoneQr) {
        const publicToken = randomUUID();
        logger.info("Creating new zone QR", { zoneId: zone.id, publicToken });
        zoneQr = await storage.createZoneQr({ zoneId: zone.id, publicToken });
      }

      // Generate URL: use replit.app for deployment, replit.dev for development
      const getPublicUrl = (token: string) => {
        const host = req.get('host');

        // Check if we're in deployment (production) by checking the host domain
        if (host && host.includes('.replit.app')) {
          // Already in deployment, use the current host
          return `https://${host}/zona-movimiento/${token}`;
        } else if (host && host.includes('.replit.dev') && process.env.NODE_ENV === 'production') {
          // In deployment but still showing .dev domain, replace with .app
          const deployHost = host.replace('.replit.dev', '.replit.app');
          return `https://${deployHost}/zona-movimiento/${token}`;
        }

        // Development: use REPLIT_DEV_DOMAIN or fallback to request host
        return `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get("host")}`}/zona-movimiento/${token}`;
      };

      const publicUrl = getPublicUrl(zoneQr.publicToken);

      const QRCode = await import("qrcode");
      const qrUrl = await QRCode.default.toDataURL(publicUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      logger.info("Zone QR generated successfully", {
        zoneId: zone.id,
        publicUrl,
      });

      res.json({
        zoneQr,
        publicUrl,
        qrUrl,
        zone: {
          id: zone.id,
          name: zone.name,
          stage: zone.stage,
        },
      });
    }),
  );

  // ---------- Zone QR público (sin auth) ----------
  // Handlers compartidos para alias :publicToken / :token

  const handlePublicZoneQrGet = async (req: any, res: any) => {
    const publicToken = String(
      req.params.publicToken ?? req.params.token ?? "",
    ).trim();
    console.log(
      `[ZONE-QR-PUBLIC] ${new Date().toISOString()} - GET ${publicToken} from ${req.ip}`,
    );

    const zoneQr = await storage.getZoneQrByToken(publicToken);
    if (!zoneQr)
      return res
        .status(404)
        .json({ message: "Token de QR no válido o expirado" });

    const zone = await storage.getZoneById(zoneQr.zoneId);
    if (!zone) return res.status(404).json({ message: "Zona no encontrada" });

    const stageOrder = [
      "sinUbicacion",
      "cria",
      "engorde",
      "matadero",
      "secadero",
      "distribucion",
    ];
    const currentStageIndex = stageOrder.indexOf(zone.stage);
    const previousStage =
      currentStageIndex > 0
        ? stageOrder[currentStageIndex - 1]
        : "sinUbicacion";

    const availableLotes: any[] = [];
    if (previousStage === "sinUbicacion") {
      const allLotes = await storage.getLotesByOrganization(
        zone.organizationId,
      );
      for (const lote of allLotes.filter((l) => l.status === "active")) {
        const activeStay = await storage.getActiveStayByLote(lote.id);
        if (!activeStay) {
          availableLotes.push({
            id: lote.id,
            identification: lote.identification,
            quantity: lote.initialAnimals,
            currentZone: "Sin ubicación",
            stayId: null,
          });
        }
      }
    } else {
      const previousZones = await storage.getZonesByStage(
        zone.organizationId,
        previousStage,
      );
      for (const prevZone of previousZones) {
        const activeStays = await storage.getActiveStaysByZone(prevZone.id);
        for (const stay of activeStays) {
          const lote = await storage.getLote(stay.loteId, zone.organizationId);
          if (lote && lote.status === "active") {
            availableLotes.push({
              id: lote.id,
              identification: lote.identification,
              quantity: lote.initialAnimals,
              currentZone: prevZone.name,
              stayId: stay.id,
            });
          }
        }
      }
    }

    res.json({
      zone: {
        id: zone.id,
        name: zone.name,
        stage: zone.stage,
        organizationId: zone.organizationId,
      },
      availableLotes,
      previousStage,
      canSplit: zone.stage === "secadero",
      canGenerateQr: zone.stage === "distribucion",
    });
  };

  const handlePublicZoneQrMove = async (req: any, res: any) => {
    const publicToken = String(
      req.params.publicToken ?? req.params.token ?? "",
    ).trim();
    const { loteId, entryTime, sublotes, shouldGenerateQr } = req.body || {};
    console.log(
      `[ZONE-MOVE-PUBLIC] ${new Date().toISOString()} - token=${publicToken}, loteId=${loteId} from ${req.ip}`,
    );

    if (!loteId || !entryTime) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    const zoneQr = await storage.getZoneQrByToken(publicToken);
    if (!zoneQr)
      return res
        .status(404)
        .json({ message: "Token de QR no válido o expirado" });

    const zone = await storage.getZoneById(zoneQr.zoneId);
    if (!zone) return res.status(404).json({ message: "Zona no encontrada" });

    // Derivar organizationId de la zona
    const organizationId = zone.organizationId;

    // Cargar lote dentro de la misma organización
    const lote = await storage.getLote(loteId, organizationId);
    if (!lote) return res.status(404).json({ message: "Lote no encontrado" });

    // Validación de fechas
    const entryDate = new Date(entryTime);
    const now = new Date();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );
    if (entryDate > endOfToday) {
      return res
        .status(400)
        .json({
          message: "La fecha de entrada no puede ser posterior al día de hoy",
        });
    }

    const currentStay = await storage.getActiveStayByLote(loteId);
    const stageOrder = [
      "sinUbicacion",
      "cria",
      "engorde",
      "matadero",
      "secadero",
      "distribucion",
    ];
    const currentStageIndex = stageOrder.indexOf(zone.stage);
    const previousStage =
      currentStageIndex > 0
        ? stageOrder[currentStageIndex - 1]
        : "sinUbicacion";

    if (!currentStay && previousStage !== "sinUbicacion") {
      return res
        .status(400)
        .json({ message: "El lote no tiene una estancia activa" });
    }

    if (currentStay) {
      const currentStayDate = new Date(currentStay.entryTime);
      currentStayDate.setHours(0, 0, 0, 0);
      const entryDateStart = new Date(entryDate);
      entryDateStart.setHours(0, 0, 0, 0);

      if (entryDateStart < currentStayDate) {
        return res.status(400).json({
          message: `La fecha de entrada no puede ser anterior al ${currentStayDate.toLocaleDateString("es-ES")}`,
        });
      }
      if (currentStay.exitTime && entryDate < currentStay.exitTime) {
        return res.status(400).json({
          message: `La fecha de entrada no puede ser anterior a la fecha de salida anterior (${currentStay.exitTime.toLocaleString("es-ES")})`,
        });
      }
      // Cerrar estancia actual
      await storage.updateStay(currentStay.id, { exitTime: entryDate });
    }

    // User de sistema para movimientos QR - crear o encontrar usuario del sistema
    let systemUserId = "626d9faf-69ff-44b3-b35d-387fd7919537";

    // Verificar si el usuario del sistema existe, si no, crear uno o usar el primer usuario de la organización
    try {
      const systemUser = await storage.getUser(systemUserId);
      if (!systemUser) {
        // Buscar cualquier usuario de la organización para usar como fallback
        const orgUsers = await storage.getUsersByOrganization?.(organizationId);
        if (orgUsers && orgUsers.length > 0) {
          systemUserId = orgUsers[0].id;
        } else {
          // Como último recurso, crear un usuario del sistema
          const newSystemUser = await storage.createUser({
            username: "sistema_qr",
            email: "sistema@qr.local",
            password: "sistema123", // Password temporal
            organizationId: organizationId,
          });
          systemUserId = newSystemUser.id;
        }
      }
    } catch (error) {
      console.error("Error handling system user:", error);
      // Como fallback, intentar usar NULL o el primer usuario disponible
      systemUserId = null as any;
    }

    // División en sublotes (matadero -> secadero)
    if (sublotes && Array.isArray(sublotes) && zone.stage === "secadero") {
      const createdSublotes: any[] = [];
      for (const subloteData of sublotes) {
        const qty = Number(subloteData?.quantity ?? 0);
        const ident = String(subloteData?.identification ?? "").trim();
        if (!ident || qty <= 0) continue;

        const sublote = await storage.createLote({
          identification: ident, // Use provided identification for sublote
          initialAnimals: qty,
          finalAnimals: qty,
          status: "active",
          organizationId, // <- derivado de la zona
          parentLoteId: loteId,
          customData: lote.customData ?? {}, // evitar undefined en JSONB
        });

        await storage.createStay({
          loteId: sublote.id,
          zoneId: zone.id,
          entryTime: entryDate,
          exitTime: null,
          createdBy: systemUserId || "system",
        });

        createdSublotes.push(sublote);
      }

      // Marcar lote padre como finalizado si se crean sublotes
      if (createdSublotes.length > 0) {
        await storage.updateLote(
          loteId,
          { status: "finished" },
          organizationId,
        );
      }

      return res.json({
        message: `Lote dividido en ${createdSublotes.length} sublotes y movido a ${zone.name}`,
        sublotes: createdSublotes,
      });
    }

    // Movimiento normal (sin dividir)
    const newStay = await storage.createStay({
      loteId,
      zoneId: zone.id,
      entryTime: entryDate,
      exitTime: null,
      createdBy: systemUserId || "system",
    });

    // Generación de QR final (secadero -> distribucion)
    if (shouldGenerateQr && zone.stage === "distribucion") {
      const snapshot = await storage.createQrSnapshot({
        loteId,
        publicToken: randomUUID(),
        snapshotData: await generateSnapshotData(lote.id, organizationId),
        createdBy: systemUserId,
      });
      return res.json({
        message: `Lote movido a ${zone.name} y QR de trazabilidad generado`,
        qrToken: snapshot.publicToken,
      });
    }

    res.json({
      message: `Lote movido exitosamente a ${zone.name}`,
      stay: newStay,
      success: true,
    });
  };

  // Registro de rutas públicas (GET y POST) con alias legacy
  app.get("/api/zone-qr/:publicToken", asyncHandler(handlePublicZoneQrGet));
  app.get("/api/zone-qr/:token", asyncHandler(handlePublicZoneQrGet)); // alias legacy

  app.post(
    "/api/zone-qr/:publicToken/move-lote",
    asyncHandler(handlePublicZoneQrMove),
  );
  app.post(
    "/api/zone-qr/:token/move-lote",
    asyncHandler(handlePublicZoneQrMove),
  ); // alias legacy

  // --- Zones API ---
  app.get(
    "/api/zones",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const { stage } = req.query;
      logger.info("GET /api/zones", {
        organizationId: req.organizationId,
        stage,
      });
      const zones = stage
        ? await storage.getZonesByStage(req.organizationId, stage as string)
        : await storage.getZonesByOrganization(req.organizationId);
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

      logger.info("POST /api/zones", {
        organizationId: req.organizationId,
        payload: zoneData,
      });
      const zone = await storage.createZone(zoneData);

      // Generate QR for zone movement
      const publicToken = randomUUID();
      await storage.createZoneQr({ zoneId: zone.id, publicToken });

      // Audit log
      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: "zone",
        entityId: zone.id,
        action: "create",
        oldData: null,
        newData: { name: zone.name, stage: zone.stage },
      });

      logger.info("Zone created with QR", {
        zoneId: zone.id,
        qrToken: publicToken,
      });
      res.status(201).json({
        ...zone,
        qrToken: publicToken,
        qrUrl: (() => {
          const host = req.get('host');

          // Check if we're in deployment (production) by checking the host domain
          if (host && host.includes('.replit.app')) {
            // Already in deployment, use the current host
            return `https://${host}/zona-movimiento/${publicToken}`;
          } else if (host && host.includes('.replit.dev') && process.env.NODE_ENV === 'production') {
            // In deployment but still showing .dev domain, replace with .app
            const deployHost = host.replace('.replit.dev', '.replit.app');
            return `https://${deployHost}/zona-movimiento/${publicToken}`;
          }

          // Development: use REPLIT_DEV_DOMAIN or fallback to request host
          return `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get("host")}`}/zona-movimiento/${publicToken}`;
        })(),
      });
    }),
  );

  app.get(
    "/api/zones/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zone = await storage.getZone(req.params.id, req.organizationId);
      if (!zone) return res.status(404).json({ message: "Zona no encontrada" });
      res.json(zone);
    }),
  );

  app.put(
    "/api/zones/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zoneData = insertZoneSchema.partial().parse(req.body);
      const zone = await storage.updateZone(
        req.params.id,
        zoneData,
        req.organizationId,
      );
      if (!zone) return res.status(404).json({ message: "Zona no encontrada" });
      res.json(zone);
    }),
  );

  app.delete(
    "/api/zones/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      logger.info("DELETE /api/zones/:id", {
        zoneId: req.params.id,
        organizationId: req.organizationId,
      });
      const zone = await storage.getZone(req.params.id, req.organizationId);
      if (!zone) return res.status(404).json({ message: "Zona no encontrada" });

      const success = await storage.deleteZone(
        req.params.id,
        req.organizationId,
      );
      if (!success) {
        logger.error("Cannot delete zone", {
          zoneId: req.params.id,
          reason: "active_stays",
        });
        return res
          .status(400)
          .json({
            message: "No se puede eliminar la zona (tiene estancias activas)",
          });
      }

      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: "zone",
        entityId: req.params.id,
        action: "delete",
        oldData: { name: zone.name, stage: zone.stage, isActive: true },
        newData: { isActive: false },
      });

      logger.info("Zone deleted", { zoneId: req.params.id });
      res.sendStatus(204);
    }),
  );

  // --- Sensors API ---
  app.get(
    "/api/zones/:zoneId/sensors",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zone = await storage.getZone(req.params.zoneId, req.organizationId);
      if (!zone) return res.status(404).json({ message: "Zona no encontrada" });
      logger.info("GET /api/zones/:zoneId/sensors", {
        organizationId: req.organizationId,
        zoneId: req.params.zoneId,
      });
      const sensors = await storage.getSensorsByZone(req.params.zoneId);
      res.json(sensors);
    }),
  );

  app.post(
    "/api/sensors",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zone = await storage.getZone(req.body.zoneId, req.organizationId);
      if (!zone) return res.status(404).json({ message: "Zona no encontrada" });

      const mqtt = generateMqttCredentials(req.body.name);
      const sensorData = insertSensorSchema.parse({
        ...req.body,
        organizationId: req.organizationId,
      });
      logger.info("POST /api/sensors", {
        organizationId: req.organizationId,
        payload: sensorData,
        mqttCredentials: mqtt,
      });
      const sensor = await storage.createSensor({
        ...sensorData,
        deviceId: mqtt.deviceId,
        mqttTopic: mqtt.topic,
        mqttUsername: mqtt.username,
        mqttPassword: mqtt.password,
      });

      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: "sensor",
        entityId: sensor.id,
        action: "create",
        oldData: null,
        newData: {
          name: sensor.name,
          zoneId: sensor.zoneId,
          sensorType: sensor.sensorType,
          deviceId: sensor.deviceId,
        },
      });

      logger.info("Sensor created", { sensorId: sensor.id });
      res.status(201).json(sensor);
    }),
  );

  app.put(
    "/api/sensors/:id/rotate-credentials",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor)
        return res.status(404).json({ message: "Sensor no encontrado" });
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone)
        return res.status(404).json({ message: "Sensor no encontrado" });
      const credentials = await storage.rotateSensorCredentials(req.params.id);
      res.json(credentials);
    }),
  );

  app.delete(
    "/api/sensors/:id",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor)
        return res.status(404).json({ message: "Sensor no encontrado" });
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone)
        return res.status(404).json({ message: "Sensor no encontrado" });
      await storage.deleteSensor(req.params.id);
      res.json({ message: "Sensor eliminado correctamente" });
    }),
  );

  // --- Sensor Readings ---
  app.get(
    "/api/sensors/:id/readings",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor)
        return res.status(404).json({ message: "Sensor no encontrado" });
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone)
        return res.status(404).json({ message: "Sensor no encontrado" });

      const { startTime, endTime, includeSimulated } = req.query;
      const readings = await storage.getSensorReadings(
        req.params.id,
        startTime ? new Date(startTime as string) : undefined,
        endTime ? new Date(endTime as string) : undefined,
        includeSimulated === "true",
      );
      res.json(readings);
    }),
  );

  app.post(
    "/api/sensors/:id/simulate",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const sensor = await storage.getSensor(req.params.id);
      if (!sensor)
        return res.status(404).json({ message: "Sensor no encontrado" });
      const zone = await storage.getZone(sensor.zoneId, req.organizationId);
      if (!zone)
        return res.status(404).json({ message: "Sensor no encontrado" });

      const {
        value,
        mode,
        interval,
        duration,
        count,
        minValue,
        maxValue,
        addNoise,
        markAsSimulated,
        useRealtime,
        customTimestamp,
      } = req.body;

      if (mode === "single") {
        const timestamp = customTimestamp
          ? new Date(customTimestamp)
          : new Date();
        const reading = await storage.createSensorReading({
          sensorId: req.params.id,
          value: value.toString(),
          timestamp,
          isSimulated: markAsSimulated !== false,
        });
        res.json({ message: "Lectura simulada creada", reading });
        return;
      }
      if (mode === "range") {
        const min = parseFloat(minValue);
        const max = parseFloat(maxValue);
        const randomValue = Math.random() * (max - min) + min;
        const finalValue = addNoise
          ? randomValue * (1 + (Math.random() - 0.5) * 0.1)
          : randomValue;
        const timestamp = customTimestamp
          ? new Date(customTimestamp)
          : new Date();
        const reading = await storage.createSensorReading({
          sensorId: req.params.id,
          value: finalValue.toString(),
          timestamp,
          isSimulated: markAsSimulated !== false,
        });
        res.json({ message: "Lectura aleatoria creada", reading });
        return;
      }
      if (mode === "burst") {
        const burstCount =
          count ||
          Math.floor(((duration || 5) * 60 * 1000) / ((interval || 30) * 1000));
        const intervalMs = (interval || 30) * 1000;
        const readings = [];
        const baseTime = customTimestamp
          ? new Date(customTimestamp).getTime()
          : Date.now() - (burstCount - 1) * intervalMs;
        for (let i = 0; i < burstCount; i++) {
          const timestamp = new Date(baseTime + i * intervalMs);
          let simulatedValue = value;
          if (addNoise) {
            const variance = (Math.random() - 0.5) * 0.2; // ±10%
            simulatedValue = value * (1 + variance);
          }
          const reading = await storage.createSensorReading({
            sensorId: req.params.id,
            value: simulatedValue.toString(),
            timestamp,
            isSimulated: markAsSimulated !== false,
          });
          readings.push(reading);
        }
        res.json({
          message: `${readings.length} lecturas en ráfaga creadas`,
          count: readings.length,
        });
        return;
      }
      res.status(400).json({ message: "Modo de simulación no válido" });
    }),
  );

  // Direct HTTP reading endpoint for external devices
  app.post(
    "/api/sensors/:id/reading",
    asyncHandler(async (req: any, res) => {
      const { deviceId, value, timestamp } = req.body;
      const sensor =
        (await storage.getSensorByDeviceId(deviceId)) ||
        (await storage.getSensor(req.params.id));
      if (!sensor)
        return res.status(404).json({ message: "Sensor no encontrado" });
      const reading = await storage.createSensorReading({
        sensorId: sensor.id,
        value: value.toString(),
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        isSimulated: false,
      });
      res
        .status(201)
        .json({ message: "Lectura recibida correctamente", reading });
    }),
  );

  // --- Tracking / Dashboard ---
  app.get(
    "/api/tracking/board",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zones = await storage.getZonesByOrganization(req.organizationId);
      const lotes = await storage.getLotesByOrganization(req.organizationId);

      const board: any = {
        sinUbicacion: { zones: [], lotes: [] },
        cria: { zones: zones.filter((z) => z.stage === "cria"), lotes: [] },
        engorde: {
          zones: zones.filter((z) => z.stage === "engorde"),
          lotes: [],
        },
        matadero: {
          zones: zones.filter((z) => z.stage === "matadero"),
          lotes: [],
        },
        secadero: {
          zones: zones.filter((z) => z.stage === "secadero"),
          lotes: [],
        },
        distribucion: {
          zones: zones.filter((z) => z.stage === "distribucion"),
          lotes: [],
        },
        finalizado: { zones: [], lotes: [] },
      };

      const activeLotes = lotes.filter((l) => l.status === "active");
      const finishedLotes = lotes.filter((l) => l.status === "finished");

      // Populate lotes in their respective stages
      for (const lote of activeLotes) {
        const activeStay = await storage.getActiveStayByLote(lote.id);
        if (activeStay && activeStay.zoneId) {
          const zone = await storage.getZone(activeStay.zoneId, req.organizationId);
          if (zone) {
            const extendedLote = {
              ...lote,
              currentZone: zone,
              totalDays: Math.floor((Date.now() - activeStay.entryTime.getTime()) / (1000 * 60 * 60 * 24))
            };

            if (zone.stage in board) {
              board[zone.stage].lotes.push(extendedLote);
            }
          }
        } else {
          // Lotes without location go to sinUbicacion
          board.sinUbicacion.lotes.push({
            ...lote,
            currentZone: null,
            totalDays: 0
          });
        }
      }

      // Add finished lotes to finalizado stage
      for (const lote of finishedLotes) {
        board.finalizado.lotes.push({
          ...lote,
          currentZone: null,
          totalDays: 0
        });
      }

      // Calculate statistics for dashboard compatibility
      const loteCounts = {
        cria: board.cria.lotes.length,
        engorde: board.engorde.lotes.length,
        matadero: board.matadero.lotes.length,
        secadero: board.secadero.lotes.length,
        distribucion: board.distribucion.lotes.length,
        unassigned: board.sinUbicacion.lotes.length,
      };

      const animalCounts = {
        cria: board.cria.lotes.reduce((sum: number, l: any) => sum + l.initialAnimals, 0),
        engorde: board.engorde.lotes.reduce((sum: number, l: any) => sum + l.initialAnimals, 0),
        matadero: board.matadero.lotes.reduce((sum: number, l: any) => sum + l.initialAnimals, 0),
        secadero: board.secadero.lotes.reduce((sum: number, l: any) => sum + l.initialAnimals, 0),
        distribucion: board.distribucion.lotes.reduce((sum: number, l: any) => sum + l.initialAnimals, 0),
        unassigned: board.sinUbicacion.lotes.reduce((sum: number, l: any) => sum + l.initialAnimals, 0),
      };

      let totalAnimals = 0;
      let subloteCount = 0;
      for (const lote of lotes) {
        if (lote.status === "finished") continue;
        if (!lote.parentLoteId) totalAnimals += lote.initialAnimals;
        else subloteCount++;
      }

      const activeZones = new Set();
      Object.values(board).forEach((stage: any) => {
        stage.lotes.forEach((lote: any) => {
          if (lote.currentZone) activeZones.add(lote.currentZone.id);
        });
      });

      const today = new Date();
      const zoneActivity = [];
      for (const zone of zones.filter((z) => activeZones.has(z.id))) {
        const readings = await storage.getLatestReadingsByZone(zone.id, today);
        const lastActivity =
          readings.length > 0
            ? Math.max(...readings.map((r) => r.timestamp.getTime()))
            : null;
        zoneActivity.push({
          zone,
          readings,
          lastActivity: lastActivity ? new Date(lastActivity) : null,
        });
      }

      // Return the board structure that the frontend expects
      res.json({
        ...board,
        loteCounts,
        animalCounts,
        totalAnimals,
        subloteCount,
        qrCount: (
          await storage.getQrSnapshotsByOrganization(req.organizationId)
        ).filter((s) => s.isActive).length,
        zoneActivity,
        unassignedLotes: board.sinUbicacion.lotes,
      });
    }),
  );

  app.post(
    "/api/lotes/:id/move",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      logger.info("POST /api/lotes/:id/move", {
        loteId: req.params.id,
        organizationId: req.organizationId,
        payload: req.body,
      });

      const { zoneId, entryTime, exitTime, subLotes, generateQR } = req.body;
      const lote = await storage.getLote(req.params.id, req.organizationId);
      if (!lote) return res.status(404).json({ message: "Lote no encontrado" });

      const targetZone =
        zoneId !== "finalizado"
          ? await storage.getZone(zoneId, req.organizationId)
          : null;
      if (!targetZone && zoneId !== "finalizado") {
        return res.status(404).json({ message: "Zona no encontrada" });
      }

      // Sequential stage validation
      const stageOrder = [
        "sinUbicacion",
        "cria",
        "engorde",
        "matadero",
        "secadero",
        "distribucion",
        "finalizado",
      ];
      const currentStay = await storage.getActiveStayByLote(lote.id);
      let currentStage = "sinUbicacion";
      if (currentStay?.zoneId) {
        const currentZone = await storage.getZone(
          currentStay.zoneId,
          req.organizationId,
        );
        currentStage = currentZone?.stage || "sinUbicacion";
      }
      const targetStage = targetZone?.stage || "finalizado";
      const currentIndex = stageOrder.indexOf(currentStage);
      const targetIndex = stageOrder.indexOf(targetStage);
      if (targetIndex <= currentIndex) {
        return res.status(400).json({
          message:
            "Movimiento no permitido: solo se pueden hacer movimientos hacia adelante en la secuencia de producción",
        });
      }

      // Date validation
      if (entryTime) {
        const newEntryDate = new Date(entryTime);
        const allStays = await storage.getStaysByLote(lote.id);
        const sortedStays = allStays.sort(
          (a, b) =>
            (b.exitTime || b.entryTime).getTime() -
            (a.exitTime || a.entryTime).getTime(),
        );
        if (sortedStays.length > 0) {
          const mostRecentStay = sortedStays[0];
          const mostRecentExitTime =
            mostRecentStay.exitTime || mostRecentStay.entryTime;
          if (newEntryDate < mostRecentExitTime) {
            return res.status(400).json({
              message:
                "Fecha no válida: la fecha de entrada debe ser igual o posterior a la fecha de salida anterior",
            });
          }
        }
      }

      if (currentStay) {
        const closeTime = exitTime ? new Date(exitTime) : new Date(entryTime);
        await storage.closeStay(currentStay.id, closeTime);
        await storage.createAuditLog({
          organizationId: req.organizationId,
          userId: req.user.id,
          entityType: "stay",
          entityId: currentStay.id,
          action: "close",
          oldData: { exitTime: null },
          newData: { exitTime: closeTime },
        });
      }

      // Handle sublote creation (Matadero → Secadero)
      if (subLotes && Array.isArray(subLotes) && subLotes.length > 0) {
        const createdSublotes: any[] = [];
        for (const subloteData of subLotes) {
          if (!subloteData.name || !subloteData.pieces) continue;
          const sublote = await storage.createLote({
            organizationId: req.organizationId,
            identification: `${lote.identification}-${subloteData.name}`, // Correctly name the sublote
            initialAnimals: subloteData.pieces,
            finalAnimals: subloteData.pieces,
            foodRegime: lote.foodRegime,
            parentLoteId: lote.id,
            pieceType: subloteData.name,
            status: "active",
            customData: { ...lote.customData, pieceType: subloteData.name },
          });
          if (zoneId !== "finalizado") {
            await storage.createStay({
              loteId: sublote.id,
              zoneId,
              entryTime: new Date(entryTime),
              createdBy: req.user.id,
            });
          }
          await storage.createAuditLog({
            organizationId: req.organizationId,
            userId: req.user.id,
            entityType: "lote",
            entityId: sublote.id,
            action: "create",
            oldData: null,
            newData: {
              type: "sublote",
              parentId: lote.id,
              piece: subloteData.name,
            },
          });
          createdSublotes.push(sublote);
        }
        await storage.updateLote(
          lote.id,
          { status: "finished" },
          req.organizationId,
        );
        await storage.createAuditLog({
          organizationId: req.organizationId,
          userId: req.user.id,
          entityType: "lote",
          entityId: lote.id,
          action: "finish",
          oldData: { status: "active" },
          newData: { status: "finished", reason: "sublotes_created" },
        });
      } else {
        if (targetZone?.stage === "finalizado" || zoneId === "finalizado") {
          await storage.updateLote(
            lote.id,
            { status: "finished" },
            req.organizationId,
          );
          await storage.createAuditLog({
            organizationId: req.organizationId,
            userId: req.user.id,
            entityType: "lote",
            entityId: lote.id,
            action: "finish",
            oldData: { status: "active" },
            newData: { status: "finished" },
          });
        } else {
          const newStay = await storage.createStay({
            loteId: lote.id,
            zoneId,
            entryTime: new Date(entryTime),
            createdBy: req.user.id,
          });
          await storage.createAuditLog({
            organizationId: req.organizationId,
            userId: req.user.id,
            entityType: "stay",
            entityId: newStay.id,
            action: "create",
            oldData: null,
            newData: { loteId: lote.id, zoneId, entryTime },
          });
        }
      }

      // QR final si se mueve a distribución
      let qrSnapshot = null;
      const targetZoneFinal =
        zoneId !== "finalizado"
          ? await storage.getZone(zoneId, req.organizationId)
          : null;
      if (generateQR && targetZoneFinal?.stage === "distribucion") {
        const snapshotData = await generateSnapshotData(
          lote.id,
          req.organizationId,
        );
        qrSnapshot = await storage.createQrSnapshot({
          loteId: lote.id,
          publicToken: randomUUID(),
          snapshotData,
          createdBy: req.user.id,
        });
        logger.info("QR snapshot created", {
          loteId: lote.id,
          snapshotId: qrSnapshot.id,
          token: qrSnapshot.publicToken,
        });
      }

      logger.info("Movement completed successfully", {
        loteId: lote.id,
        targetZoneId: zoneId,
        userId: req.user.id,
      });

      const response: any = { message: "Movimiento registrado correctamente" };
      if (qrSnapshot) {
        response.qrSnapshot = {
          id: qrSnapshot.id,
          token: qrSnapshot.publicToken,
          url: `/trazabilidad/${qrSnapshot.publicToken}`,
        };
      }
      res.json(response);
    }),
  );

  // QR Snapshots (privado)
  app.get(
    "/api/qr-snapshots",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const snapshots = await storage.getQrSnapshotsByOrganization(
        req.organizationId,
      );
      res.json(snapshots);
    }),
  );

  app.put(
    "/api/qr-snapshots/:id/rotate",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const snapshot = await storage.getQrSnapshot(req.params.id);
      if (!snapshot)
        return res.status(404).json({ message: "Código QR no encontrado" });

      const lote = await storage.getLote(snapshot.loteId, req.organizationId);
      if (!lote)
        return res
          .status(404)
          .json({ message: "No autorizado para este código QR" });

      const newToken = randomUUID();
      const updatedSnapshot = await storage.updateQrSnapshot(snapshot.id, {
        publicToken: newToken,
        scanCount: 0,
      });

      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: "qr_snapshot",
        entityId: snapshot.id,
        action: "rotate",
        oldData: {
          publicToken: snapshot.publicToken,
          scanCount: snapshot.scanCount,
        },
        newData: { publicToken: newToken, scanCount: 0 },
      });

      logger.info("QR token rotated", {
        snapshotId: snapshot.id,
        oldToken: snapshot.publicToken,
        newToken,
      });

      res.json({
        ...updatedSnapshot,
        message: "Token rotado exitosamente",
        newUrl: `/trazabilidad/${newToken}`,
      });
    }),
  );

  app.put(
    "/api/qr-snapshots/:id/revoke",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const snapshot = await storage.getQrSnapshot(req.params.id);
      if (!snapshot)
        return res.status(404).json({ message: "Código QR no encontrado" });

      const lote = await storage.getLote(snapshot.loteId, req.organizationId);
      if (!lote)
        return res
          .status(404)
          .json({ message: "No autorizado para este código QR" });

      const updatedSnapshot = await storage.updateQrSnapshot(snapshot.id, {
        isActive: false,
      });

      await storage.createAuditLog({
        organizationId: req.organizationId,
        userId: req.user.id,
        entityType: "qr_snapshot",
        entityId: snapshot.id,
        action: "revoke",
        oldData: { isActive: true },
        newData: { isActive: false },
      });

      logger.info("QR snapshot revoked", {
        snapshotId: snapshot.id,
        publicToken: snapshot.publicToken,
      });
      res.json({
        ...updatedSnapshot,
        message: "Código QR revocado exitosamente",
      });
    }),
  );

  // Public traceability endpoint (no auth required)
  app.get(
    "/api/trace/:token",
    asyncHandler(async (req, res) => {
      const snapshot = await storage.getQrSnapshotByToken(req.params.token);
      if (!snapshot)
        return res
          .status(404)
          .json({ message: "Código QR no válido o revocado" });
      await storage.incrementScanCount(req.params.token);
      res.json(snapshot.snapshotData);
    }),
  );

  // Dashboard
  app.get(
    "/api/dashboard",
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const zones = await storage.getZonesByOrganization(req.organizationId);
      const lotes = await storage.getLotesByOrganization(req.organizationId);
      const qrSnapshots = await storage.getQrSnapshotsByOrganization(
        req.organizationId,
      );

      const loteCounts = {
        cria: 0,
        engorde: 0,
        matadero: 0,
        secadero: 0,
        distribucion: 0,
        unassigned: 0,
      };
      const animalCounts = {
        cria: 0,
        engorde: 0,
        matadero: 0,
        secadero: 0,
        distribucion: 0,
        unassigned: 0,
      };
      const activeZones = new Set();
      const unassignedLotes: any[] = [];
      let totalAnimals = 0;
      let subloteCount = 0;

      for (const lote of lotes) {
        if (lote.status === "finished") continue;
        if (!lote.parentLoteId) totalAnimals += lote.initialAnimals;
        else subloteCount++;
        if (lote.status === "active") {
          const activeStay = await storage.getActiveStayByLote(lote.id);
          if (activeStay?.zoneId) {
            const zone = await storage.getZone(
              activeStay.zoneId,
              req.organizationId,
            );
            if (zone && zone.stage in loteCounts) {
              loteCounts[zone.stage as keyof typeof loteCounts]++;
              animalCounts[zone.stage as keyof typeof animalCounts] +=
                lote.initialAnimals;
              activeZones.add(zone.id);
            }
          } else {
            loteCounts.unassigned++;
            animalCounts.unassigned += lote.initialAnimals;
            unassignedLotes.push({
              id: lote.id,
              identification: lote.identification,
              initialAnimals: lote.initialAnimals,
              createdAt: lote.createdAt,
              pieceType: lote.pieceType,
            });
          }
        }
      }

      const today = new Date();
      const zoneActivity = [];
      for (const zone of zones.filter((z) => activeZones.has(z.id))) {
        const readings = await storage.getLatestReadingsByZone(zone.id, today);
        const lastActivity =
          readings.length > 0
            ? Math.max(...readings.map((r) => r.timestamp.getTime()))
            : null;
        zoneActivity.push({
          zone,
          readings,
          lastActivity: lastActivity ? new Date(lastActivity) : null,
        });
      }

      res.json({
        loteCounts,
        animalCounts,
        totalAnimals,
        subloteCount,
        qrCount: qrSnapshots.filter((s) => s.isActive).length,
        zoneActivity,
        unassignedLotes,
      });
    }),
  );

  const httpServer = createServer(app);
  return httpServer;
}