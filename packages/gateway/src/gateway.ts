import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger, expandHomePath } from "@mcp-gateway/shared";
import type {
  GatewayEnv,
  BackendServerConfig,
  LogLevel,
} from "@mcp-gateway/shared";
import { ServerManager } from "./server-manager.js";
import { Aggregator } from "./aggregator.js";

const NAMESPACES = new Map<string, string>([
  ["copilot", "copilot"],
  ["antigravity", "antigravity"],
  ["cursor", "cursor"],
  ["vscode", "vscode"],
]);

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = resolve(CURRENT_DIR, "..", "..");

function serverEntryPath(serverName: string): string {
  return join(PACKAGES_DIR, serverName, "dist", "index.js");
}

function buildServerConfigs(env: GatewayEnv): BackendServerConfig[] {
  const copilotAssetsDir = resolve(expandHomePath(env.COPILOT_ASSETS_DIR));
  const antigravityDataDir = resolve(expandHomePath(env.ANTIGRAVITY_DATA_DIR));
  const cursorConfigDir = resolve(expandHomePath(env.CURSOR_CONFIG_DIR));
  const cursorWorkspaceDir = resolve(expandHomePath(env.CURSOR_WORKSPACE_DIR));

  return [
    {
      id: "copilot",
      name: "GitHub Copilot Server",
      command: "node",
      args: [serverEntryPath("server-copilot")],
      env: {
        COPILOT_ASSETS_DIR: copilotAssetsDir,
        LOG_LEVEL: env.LOG_LEVEL,
      },
      namespace: "copilot",
    },
    {
      id: "antigravity",
      name: "Antigravity Server",
      command: "node",
      args: [serverEntryPath("server-antigravity")],
      env: {
        ANTIGRAVITY_DATA_DIR: antigravityDataDir,
        LOG_LEVEL: env.LOG_LEVEL,
      },
      namespace: "antigravity",
    },
    {
      id: "cursor",
      name: "Cursor Server",
      command: "node",
      args: [serverEntryPath("server-cursor")],
      env: {
        CURSOR_CONFIG_DIR: cursorConfigDir,
        CURSOR_WORKSPACE_DIR: cursorWorkspaceDir,
        LOG_LEVEL: env.LOG_LEVEL,
      },
      namespace: "cursor",
    },
    {
      id: "vscode",
      name: "VSCode Server",
      command: "node",
      args: [serverEntryPath("server-vscode")],
      env: {
        CURSOR_WORKSPACE_DIR: cursorWorkspaceDir,
        LOG_LEVEL: env.LOG_LEVEL,
      },
      namespace: "vscode",
    },
  ];
}

export async function createGateway(env: GatewayEnv): Promise<{
  server: Server;
  serverManager: ServerManager;
  aggregator: Aggregator;
}> {
  const logger = new Logger("gateway", env.LOG_LEVEL);
  const serverManager = new ServerManager(env.LOG_LEVEL);
  const aggregator = new Aggregator(env.LOG_LEVEL);

  logger.info("Initializing MCP Gateway");

  const configs = buildServerConfigs(env);

  for (const config of configs) {
    try {
      await serverManager.startServer(config);
      logger.info("Backend server connected", { id: config.id });
    } catch (error) {
      logger.error("Failed to start backend server", {
        id: config.id,
        error: String(error),
      });
    }
  }

  const clients = serverManager.getAllClients();
  const tools = await aggregator.aggregateTools(clients, NAMESPACES);
  const resources = await aggregator.aggregateResources(clients, NAMESPACES);
  const prompts = await aggregator.aggregatePrompts(clients, NAMESPACES);

  logger.info("Aggregation complete", {
    tools: tools.length,
    resources: resources.length,
    prompts: prompts.length,
  });

  const server = new Server(
    { name: "mcp-gateway", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const route = aggregator.resolveToolRoute(name);

    if (!route) {
      return {
        content: [
          { type: "text" as const, text: `Unknown tool: ${name}` },
        ],
        isError: true,
      };
    }

    const client = serverManager.getClient(route.serverId);
    if (!client) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Server "${route.serverId}" is not connected`,
          },
        ],
        isError: true,
      };
    }

    logger.debug("Routing tool call", {
      namespacedName: name,
      originalName: route.originalName,
      serverId: route.serverId,
    });

    const result = await client.callTool({
      name: route.originalName,
      arguments: request.params.arguments,
    });

    return result as {
      content: Array<{ type: "text"; text: string }>;
      isError?: boolean;
    };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources,
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const route = aggregator.resolveResourceRoute(uri);

    if (!route) {
      throw new Error(`Unknown resource: ${uri}`);
    }

    const client = serverManager.getClient(route.serverId);
    if (!client) {
      throw new Error(`Server "${route.serverId}" is not connected`);
    }

    logger.debug("Routing resource read", {
      uri,
      serverId: route.serverId,
    });

    const result = await client.readResource({ uri: route.originalUri });
    return result as {
      contents: Array<{ uri: string; mimeType?: string; text?: string }>;
    };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts,
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    const route = aggregator.resolvePromptRoute(name);

    if (!route) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    const client = serverManager.getClient(route.serverId);
    if (!client) {
      throw new Error(`Server "${route.serverId}" is not connected`);
    }

    logger.debug("Routing prompt request", {
      namespacedName: name,
      originalName: route.originalName,
      serverId: route.serverId,
    });

    const result = await client.getPrompt({
      name: route.originalName,
      arguments: request.params.arguments,
    });

    return result as {
      description?: string;
      messages: Array<{
        role: "user" | "assistant";
        content: { type: "text"; text: string };
      }>;
    };
  });

  logger.info("MCP Gateway initialized");
  return { server, serverManager, aggregator };
}
