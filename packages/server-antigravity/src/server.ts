import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  listKnowledgeItems,
  readKnowledgeItem,
  listConversations,
  readConversation,
  searchKnowledge,
} from "./tools/index.js";
import { Logger } from "@mcp-gateway/shared";
import type { LogLevel } from "@mcp-gateway/shared";

export function createAntigravityServer(
  dataDir: string,
  logLevel: LogLevel = "info",
): Server {
  const logger = new Logger("server-antigravity", logLevel);
  const server = new Server(
    { name: "antigravity-server", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing tools");
    return {
      tools: [
        {
          name: "list_knowledge_items",
          description:
            "List all Antigravity knowledge items with their metadata summaries",
          inputSchema: { type: "object" as const, properties: {} },
        },
        {
          name: "read_knowledge_item",
          description:
            "Read a specific Antigravity knowledge item including its metadata and artifact contents",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: {
                type: "string",
                description: "ID of the knowledge item to read",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "list_conversations",
          description:
            "List recent Antigravity conversation logs with preview text",
          inputSchema: { type: "object" as const, properties: {} },
        },
        {
          name: "read_conversation",
          description:
            "Read the full overview of a specific Antigravity conversation",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: {
                type: "string",
                description: "Conversation ID to read",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "search_knowledge",
          description:
            "Search across Antigravity knowledge items by keyword, matching against ID, summary, and references",
          inputSchema: {
            type: "object" as const,
            properties: {
              query: {
                type: "string",
                description: "Search query to match against knowledge items",
              },
            },
            required: ["query"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    logger.debug("Calling tool", { name, args });

    switch (name) {
      case "list_knowledge_items": {
        const items = await listKnowledgeItems(dataDir);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(items, null, 2) },
          ],
        };
      }

      case "read_knowledge_item": {
        const id = z.string().parse(args["id"]);
        const item = await readKnowledgeItem(dataDir, id);
        if (!item) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Knowledge item "${id}" not found`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(item, null, 2) },
          ],
        };
      }

      case "list_conversations": {
        const conversations = await listConversations(dataDir);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(conversations, null, 2),
            },
          ],
        };
      }

      case "read_conversation": {
        const id = z.string().parse(args["id"]);
        const conversation = await readConversation(dataDir, id);
        if (!conversation) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Conversation "${id}" not found`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(conversation, null, 2),
            },
          ],
        };
      }

      case "search_knowledge": {
        const query = z.string().parse(args["query"]);
        const results = await searchKnowledge(dataDir, query);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
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

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const items = await listKnowledgeItems(dataDir);
    const conversations = await listConversations(dataDir);

    return {
      resources: [
        ...items.map((item) => ({
          uri: `antigravity://knowledge/${item.id}`,
          name: `Knowledge: ${item.id}`,
          description: item.summary || `Knowledge item ${item.id}`,
          mimeType: "application/json",
        })),
        ...conversations.map((conv) => ({
          uri: `antigravity://conversations/${conv.id}`,
          name: `Conversation: ${conv.id}`,
          description:
            conv.overview.slice(0, 100) || `Conversation ${conv.id}`,
          mimeType: "text/plain",
        })),
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.debug("Reading resource", { uri });

    const kiMatch = uri.match(/^antigravity:\/\/knowledge\/(.+)$/);
    if (kiMatch) {
      const id = kiMatch[1]!;
      const item = await readKnowledgeItem(dataDir, id);
      if (!item) throw new Error(`Knowledge item "${id}" not found`);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(item, null, 2),
          },
        ],
      };
    }

    const convMatch = uri.match(/^antigravity:\/\/conversations\/(.+)$/);
    if (convMatch) {
      const id = convMatch[1]!;
      const conversation = await readConversation(dataDir, id);
      if (!conversation) throw new Error(`Conversation "${id}" not found`);
      return {
        contents: [
          { uri, mimeType: "text/plain", text: conversation.overview },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  logger.info("Antigravity server created", { dataDir });
  return server;
}
