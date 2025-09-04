import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ---- Logger seguro para /api ----
function safeSerialize(obj: unknown): string | null {
  try {
    // Maneja BigInt y evita reventar con estructuras raras
    return JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
  } catch {
    return null;
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown | undefined = undefined;

  // Sólo intercepta JSON si realmente lo vamos a loguear
  const originalResJson = res.json.bind(res);
  res.json = (body: any, ...args: any[]) => {
    capturedJsonResponse = body;
    return originalResJson(body, ...args);
  };

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;

    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

    if (capturedJsonResponse !== undefined) {
      const serialized = safeSerialize(capturedJsonResponse);
      if (serialized) {
        let snippet = serialized;
        // Recorta para no hacer logs gigantes
        if (snippet.length > 300) snippet = snippet.slice(0, 299) + "…";
        logLine += ` :: ${snippet}`;
      } else {
        logLine += " :: [unserializable-json]";
      }
    }
    // Recorte final "por si acaso"
    if (logLine.length > 1000) logLine = logLine.slice(0, 999) + "…";

    log(logLine);
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // ---- Error middleware: no relanzar el error ----
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    console.error("[ERROR]", status, message, err?.stack);
    if (res.headersSent) return;
    res.status(status).json({ message });
  });

  // Vite en dev; estático en prod
  if (
    process.env.NODE_ENV === "development" ||
    app.get("env") === "development"
  ) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Puerto de PaaS
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
