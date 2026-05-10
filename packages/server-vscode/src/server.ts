import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readVscodeSettings, writeVscodeSettings, readVscodeTasks } from "./tools/index.js";
import { Logger } from "@mcp-gateway/shared";
import type { LogLevel } from "@mcp-gateway/shared";

export function createVscodeServer(
  workspaceDir: string,
  logLevel: LogLevel = "info",
): Server {
  const logger = new Logger("server-vscode", logLevel);
  const server = new Server(
    { name: "vscode-server", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "read_settings",
        description: "Read VSCode workspace settings",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "write_settings",
        description: "Write or update VSCode workspace settings",
        inputSchema: {
          type: "object",
          properties: {
            content: { type: "string", description: "JSON string of settings" },
          },
          required: ["content"],
        },
      },
      {
        name: "read_tasks",
        description: "Read VSCode workspace tasks",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    switch (name) {
      case "read_settings":
        const settings = await readVscodeSettings(workspaceDir);
        return { content: [{ type: "text", text: settings ?? "{}" }] };
      case "write_settings":
        const content = z.string().parse(args["content"]);
        await writeVscodeSettings(workspaceDir, content);
        return { content: [{ type: "text", text: "Settings updated" }] };
      case "read_tasks":
        const tasks = await readVscodeTasks(workspaceDir);
        return { content: [{ type: "text", text: tasks ?? "{}" }] };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
