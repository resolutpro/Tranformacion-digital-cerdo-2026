import { z } from "zod";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { lotes, loteTemplates } from "@shared/schema";
import type { Express, Request, Response } from "express";
import { db } from "./db"; // o tu instancia
import { storage } from "./storage"; // si usas storage.* para abstraer

// ---------- LOTE TEMPLATE ----------

// Devuelve siempre un array en customFields
export async function getLoteTemplateHandler(req: Request, res: Response) {
  const user = (req as any).user;
  const organizationId = user?.organizationId;
  if (!organizationId)
    return res.status(400).json({ message: "Organización requerida" });

  const tpl = await storage.getLoteTemplate(organizationId);
  return res.json({
    ...(tpl ?? {}),
    customFields: Array.isArray((tpl as any)?.customFields)
      ? (tpl as any).customFields
      : [],
  });
}

// Valida y guarda customFields (array)
const templateUpdateSchema = z.object({
  customFields: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(["text", "number", "select", "date"]),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
        defaultValue: z.any().optional(),
      }),
    )
    .default([]),
});

export async function putLoteTemplateHandler(req: Request, res: Response) {
  const user = (req as any).user;
  const organizationId = user?.organizationId;
  if (!organizationId)
    return res.status(400).json({ message: "Organización requerida" });

  const parsed = templateUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Datos inválidos", details: parsed.error.flatten() });
  }

  const saved = await storage.updateLoteTemplate({
    organizationId,
    // guarda SOLO customFields; storage se encarga de upsert
    customFields: parsed.data.customFields,
  } as any);

  return res.json(saved);
}

// ---------- LOTES (usa customFields como array de valores) ----------

const loteBodySchema = z.object({
  identification: z.string().min(1),
  initialAnimals: z.number().int().nonnegative().default(0),
  foodRegime: z.string().nullable().optional(),
  customFields: z
    .array(
      z.object({
        key: z.string(),
        label: z.string().optional(),
        type: z.enum(["text", "number", "select", "date"]).optional(),
        value: z.any(),
      }),
    )
    .default([]),
});

export async function postLoteHandler(req: Request, res: Response) {
  const user = (req as any).user;
  const organizationId = user?.organizationId;
  if (!organizationId)
    return res.status(400).json({ message: "Organización requerida" });

  const parsed = loteBodySchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Datos inválidos", details: parsed.error.flatten() });

  const data = parsed.data;

  const inserted = await db
    .insert(lotes)
    .values({
      id: randomUUID(),
      organizationId,
      identification: data.identification.trim(),
      initialAnimals: data.initialAnimals ?? 0,
      foodRegime: data.foodRegime ?? null,
      customFields: data.customFields ?? [], // <--- guarda array de valores
      status: "active",
      createdBy: user.id,
    })
    .returning();

  return res.json({ id: inserted[0].id });
}

export async function putLoteHandler(req: Request, res: Response) {
  const user = (req as any).user;
  const organizationId = user?.organizationId;
  if (!organizationId)
    return res.status(400).json({ message: "Organización requerida" });

  const parsed = loteBodySchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Datos inválidos", details: parsed.error.flatten() });

  const updates: any = {};
  if (parsed.data.identification !== undefined)
    updates.identification = parsed.data.identification.trim();
  if (parsed.data.initialAnimals !== undefined)
    updates.initialAnimals = parsed.data.initialAnimals;
  if (parsed.data.foodRegime !== undefined)
    updates.foodRegime = parsed.data.foodRegime ?? null;
  if (parsed.data.customFields !== undefined)
    updates.customFields = parsed.data.customFields;

  const updated = await db
    .update(lotes)
    .set(updates)
    .where(eq(lotes.id, req.params.id))
    .returning();

  if (!updated.length)
    return res.status(404).json({ message: "Lote no encontrado" });
  return res.json({ ok: true });
}

// En tu bootstrap principal, monta las rutas:
// app.get("/api/lote-template", getLoteTemplateHandler);
// app.put("/api/lote-template", putLoteTemplateHandler);
// app.post("/api/lotes", postLoteHandler);
// app.put("/api/lotes/:id", putLoteHandler);
