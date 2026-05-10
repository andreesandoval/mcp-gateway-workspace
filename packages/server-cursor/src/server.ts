import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  readCursorRules,
  writeCursorRules,
  readMcpConfig,
  addMcpServer,
  removeMcpServer,
  listWorkspaces,
} from "./tools/index.js";
import { Logger } from "@mcp-gateway/shared";
import type { LogLevel } from "@mcp-gateway/shared";

export function createCursorServer(
  configDir: string,
  workspaceDir: string,
  logLevel: LogLevel = "info",
): Server {
  const logger = new Logger("server-cursor", logLevel);
  const server = new Server(
    { name: "cursor-server", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing tools");
    return {
      tools: [
        {
          name: "read_cursor_rules",
          description:
            "Read the current .cursorrules file from the workspace",
          inputSchema: { type: "object" as const, properties: {} },
        },
        {
          name: "write_cursor_rules",
          description:
            "Write or update the .cursorrules file in the workspace",
          inputSchema: {
            type: "object" as const,
            properties: {
              content: {
                type: "string",
                description: "New content for the cursor rules file",
              },
            },
            required: ["content"],
          },
        },
        {
          name: "read_mcp_config",
          description:
            "Read the current Cursor MCP server configuration from mcp.json",
          inputSchema: { type: "object" as const, properties: {} },
        },
        {
          name: "add_mcp_server",
          description:
            "Add a new MCP server entry to Cursor's mcp.json configuration",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: {
                type: "string",
                description: "Unique name for the MCP server",
              },
              url: {
                type: "string",
                description:
                  "URL for remote MCP servers (Streamable HTTP or SSE)",
              },
              command: {
                type: "string",
                description:
                  "Command to run for stdio-based MCP servers",
              },
              args: {
                type: "array",
                items: { type: "string" },
                description: "Arguments for the command",
              },
            },
            required: ["name"],
          },
        },
        {
          name: "remove_mcp_server",
          description:
            "Remove an MCP server entry from Cursor's mcp.json configuration",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: {
                type: "string",
                description: "Name of the MCP server to remove",
              },
            },
            required: ["name"],
          },
        },
        {
          name: "list_workspaces",
          description:
            "List all known workspace paths from Cursor's workspace storage",
          inputSchema: { type: "object" as const, properties: {} },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    logger.debug("Calling tool", { name, args });

    switch (name) {
      case "read_cursor_rules": {
        const rules = await readCursorRules(workspaceDir);
        if (rules === null) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No .cursorrules file found in the workspace",
              },
            ],
          };
        }
        return {
          content: [{ type: "text" as const, text: rules }],
        };
      }

      case "write_cursor_rules": {
        const content = z.string().parse(args["content"]);
        const path = await writeCursorRules(workspaceDir, content);
        return {
          content: [
            {
              type: "text" as const,
              text: `Cursor rules written to ${path}`,
            },
          ],
        };
      }

      case "read_mcp_config": {
        const config = await readMcpConfig(configDir);
        if (!config) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No mcp.json configuration found",
              },
            ],
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(config, null, 2) },
          ],
        };
      }

      case "add_mcp_server": {
        const serverName = z.string().parse(args["name"]);
        const url =
          typeof args["url"] === "string" ? args["url"] : undefined;
        const command =
          typeof args["command"] === "string" ? args["command"] : undefined;
        const serverArgs = Array.isArray(args["args"])
          ? (args["args"] as unknown[]).filter(
              (a): a is string => typeof a === "string",
            )
          : undefined;

        const entry: Record<string, unknown> = {};
        if (url) entry["url"] = url;
        if (command) entry["command"] = command;
        if (serverArgs) entry["args"] = serverArgs;

        const updated = await addMcpServer(
          configDir,
          serverName,
          entry as { url?: string; command?: string; args?: string[] },
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Server "${serverName}" added. Updated config:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      }

      case "remove_mcp_server": {
        const serverName = z.string().parse(args["name"]);
        const updated = await removeMcpServer(configDir, serverName);
        return {
          content: [
            {
              type: "text" as const,
              text: `Server "${serverName}" removed. Updated config:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      }

      case "list_workspaces": {
        const workspaces = await listWorkspaces(configDir);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(workspaces, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            { type: "text" as const, text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "cursor://rules",
        name: "Cursor Rules",
        description: "Current .cursorrules file content",
        mimeType: "text/plain",
      },
      {
        uri: "cursor://mcp-config",
        name: "Cursor MCP Config",
        description: "Current MCP server configuration",
        mimeType: "application/json",
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.debug("Reading resource", { uri });

    if (uri === "cursor://rules") {
      const rules = await readCursorRules(workspaceDir);
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: rules ?? "No .cursorrules file found",
          },
        ],
      };
    }

    if (uri === "cursor://mcp-config") {
      const config = await readMcpConfig(configDir);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: config
              ? JSON.stringify(config, null, 2)
              : "No mcp.json found",
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  logger.info("Cursor server created", { configDir, workspaceDir });
  return server;
}
