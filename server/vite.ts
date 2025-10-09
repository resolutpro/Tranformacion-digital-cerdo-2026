import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

// Asegurar que los archivos públicos se sirvan correctamente
      app.use(vite.middlewares);
    } else {
      // En producción, servir archivos estáticos desde client/public
      app.use(express.static('client/public'));
    }

    return vite;
  }

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // 1) estáticos
  app.use(express.static(distPath));

  // 2) favicon: sirve si existe; si no, 204
  app.get("/favicon.ico", (_req, res) => {
    const fav = path.join(distPath, "favicon.ico");
    if (fs.existsSync(fav)) return res.sendFile(fav);
    return res.status(204).end();
  });

  // 3) fallback SPA sólo para rutas que NO son /api/*
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}