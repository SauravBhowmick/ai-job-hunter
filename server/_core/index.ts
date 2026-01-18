import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Railway provides PORT, fallback to 3000 for local dev
  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  
  // Skip port availability check in production (Railway assigns the port)
  const port = process.env.NODE_ENV === "production" 
    ? preferredPort 
    : await findAvailablePort(preferredPort);
  
  if (port !== preferredPort && process.env.NODE_ENV !== "production") {
    console.log(`⚠️  Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Listen on 0.0.0.0 for Railway (not just localhost)
  server.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    if (process.env.NODE_ENV === "development") {
      console.log(`🌐 Local: http://localhost:${port}/`);
    } else {
      console.log(`🌐 Production server started`);
    }
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error("❌ Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
