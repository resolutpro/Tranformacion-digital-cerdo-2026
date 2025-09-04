import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- blindaje de proceso ---
process.on("unhandledRejection", (err: any) => {
  console.error("[unhandledRejection]", err?.message, err?.stack);
});
process.on("uncaughtException", (err: any) => {
  console.error("[uncaughtException]", err?.message, err?.stack);
});

// --- logger /api seguro (no peta con BigInt) ---
function safeSerialize(obj: unknown): string | null {
  try {
    return JSON.stringify(obj, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
  } catch {
    return null;
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown;

  const originalResJson = res.json.bind(res);
  res.json = (body: any, ...args: any[]) => {
    capturedJsonResponse = body;
    return originalResJson(body, ...args);
  };

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;
    const duration = Date.now() - start;

    let line = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse !== undefined) {
      const s = safeSerialize(capturedJsonResponse) ?? "[unserializable-json]";
      const snippet = s.length > 300 ? s.slice(0, 299) + "…" : s;
      line += ` :: ${snippet}`;
    }
    if (line.length > 1000) line = line.slice(0, 999) + "…";
    log(line);
  });

  next();
});

// evita ruido de 502 en favicon si el server aún no está listo
app.get("/favicon.ico", (_req, res) => res.status(204).end());

(async () => {
  const server = await registerRoutes(app);

  // manejador de errores (no relanzar)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    console.error("[ERROR]", status, message, err?.stack);
    if (!res.headersSent) res.status(status).json({ message });
  });

  if (
    process.env.NODE_ENV === "development" ||
    app.get("env") === "development"
  ) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () =>
    log(`serving on port ${port}`),
  );
})();
