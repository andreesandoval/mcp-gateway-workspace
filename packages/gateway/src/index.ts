import express from "express";
import {
  parseEnv,
  GatewayEnvSchema,
  Logger,
} from "@mcp-gateway/shared";
import { createGateway } from "./gateway.js";
import { setupTransport } from "./transport.js";
import { setupHealthCheck } from "./health.js";

const env = parseEnv(GatewayEnvSchema);
const logger = new Logger("main", env.LOG_LEVEL);

logger.info("Starting MCP Gateway", { port: env.GATEWAY_PORT });

const { server: mcpServer, serverManager, aggregator } =
  await createGateway(env);

const app = express();
app.use(express.json());

setupHealthCheck(app, serverManager, aggregator);
setupTransport(app, mcpServer, {
  authToken: env.GATEWAY_AUTH_TOKEN,
  logLevel: env.LOG_LEVEL,
});

const httpServer = app.listen(env.GATEWAY_PORT, () => {
  logger.info("MCP Gateway is running", {
    port: env.GATEWAY_PORT,
    endpoints: {
      sse: `http://localhost:${env.GATEWAY_PORT}/sse`,
      messages: `http://localhost:${env.GATEWAY_PORT}/messages`,
      health: `http://localhost:${env.GATEWAY_PORT}/health`,
    },
  });
});

async function gracefulShutdown(): Promise<void> {
  logger.info("Graceful shutdown initiated");

  httpServer.close();
  await serverManager.shutdown();

  logger.info("Gateway shut down complete");
  process.exit(0);
}

process.on("SIGINT", () => void gracefulShutdown());
process.on("SIGTERM", () => void gracefulShutdown());
