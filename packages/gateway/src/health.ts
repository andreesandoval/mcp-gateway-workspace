import type { Request, Response, Express } from "express";
import type { ServerManager } from "./server-manager.js";
import type { Aggregator } from "./aggregator.js";
import type { HealthStatus, ServerHealthEntry } from "@mcp-gateway/shared";

const startTime = Date.now();

export function setupHealthCheck(
  app: Express,
  serverManager: ServerManager,
  aggregator: Aggregator,
): void {
  app.get("/health", (_req: Request, res: Response): void => {
    const configs = serverManager.getServerConfigs();

    const servers: ServerHealthEntry[] = configs.map((config) => ({
      id: config.id,
      name: config.name,
      status: serverManager.isServerConnected(config.id)
        ? ("connected" as const)
        : ("disconnected" as const),
      toolCount: 0,
      resourceCount: 0,
    }));

    const allConnected = servers.every((s) => s.status === "connected");
    const noneConnected = servers.every((s) => s.status !== "connected");

    const status: HealthStatus = {
      status: noneConnected
        ? "unhealthy"
        : allConnected
          ? "healthy"
          : "degraded",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      servers,
    };

    const httpStatus = status.status === "unhealthy" ? 503 : 200;
    res.status(httpStatus).json(status);
  });
}
