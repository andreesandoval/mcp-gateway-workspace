import type { Express, Request, Response, NextFunction } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Logger } from "@mcp-gateway/shared";
import type { LogLevel } from "@mcp-gateway/shared";

interface TransportConfig {
  readonly authToken: string;
  readonly logLevel: LogLevel;
}

const activeSseTransports = new Map<string, SSEServerTransport>();

function createAuthMiddleware(
  authToken: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!authToken) {
      next();
      return;
    }

    if (req.path === "/health") {
      next();
      return;
    }

    const authorization = req.headers["authorization"];
    if (!authorization || authorization !== `Bearer ${authToken}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}

export function setupTransport(
  app: Express,
  mcpServer: Server,
  config: TransportConfig,
): void {
  const logger = new Logger("transport", config.logLevel);

  if (config.authToken) {
    app.use(createAuthMiddleware(config.authToken));
    logger.info("Authentication middleware enabled");
  }

  app.get("/sse", async (req: Request, res: Response): Promise<void> => {
    logger.info("SSE connection established", {
      remoteAddress: req.socket.remoteAddress,
    });

    const transport = new SSEServerTransport("/messages", res);
    activeSseTransports.set(transport.sessionId, transport);

    res.on("close", () => {
      activeSseTransports.delete(transport.sessionId);
      logger.info("SSE connection closed", {
        sessionId: transport.sessionId,
      });
    });

    await mcpServer.connect(transport);
  });

  app.post("/messages", async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.query["sessionId"] as string | undefined;

    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId query parameter" });
      return;
    }

    const transport = activeSseTransports.get(sessionId);
    if (!transport) {
      res
        .status(404)
        .json({ error: `No active session found for sessionId: ${sessionId}` });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  logger.info("SSE transport configured on /sse and /messages");
}
