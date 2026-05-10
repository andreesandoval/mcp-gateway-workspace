import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Logger } from "@mcp-gateway/shared";
import type { LogLevel } from "@mcp-gateway/shared";

interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

interface ToolRouteEntry {
  readonly originalName: string;
  readonly serverId: string;
  readonly namespace: string;
}

interface ResourceRouteEntry {
  readonly originalUri: string;
  readonly serverId: string;
}

interface PromptRouteEntry {
  readonly originalName: string;
  readonly serverId: string;
  readonly namespace: string;
}

export class Aggregator {
  private readonly toolRoutes = new Map<string, ToolRouteEntry>();
  private readonly resourceRoutes = new Map<string, ResourceRouteEntry>();
  private readonly promptRoutes = new Map<string, PromptRouteEntry>();
  private readonly logger: Logger;

  constructor(logLevel: LogLevel = "info") {
    this.logger = new Logger("aggregator", logLevel);
  }

  async aggregateTools(
    clients: Map<string, Client>,
    namespaces: Map<string, string>,
  ): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];
    this.toolRoutes.clear();

    for (const [serverId, client] of clients) {
      const namespace = namespaces.get(serverId) ?? serverId;

      try {
        const result = await client.listTools();

        for (const tool of result.tools) {
          const namespacedName = `${namespace}_${tool.name}`;

          this.toolRoutes.set(namespacedName, {
            originalName: tool.name,
            serverId,
            namespace,
          });

          tools.push({
            name: namespacedName,
            description: tool.description
              ? `[${namespace}] ${tool.description}`
              : `[${namespace}] ${tool.name}`,
            inputSchema: tool.inputSchema as Record<string, unknown>,
          });
        }

        this.logger.info("Aggregated tools from server", {
          serverId,
          count: result.tools.length,
        });
      } catch (error) {
        this.logger.error("Failed to list tools from server", {
          serverId,
          error: String(error),
        });
      }
    }

    return tools;
  }

  async aggregateResources(
    clients: Map<string, Client>,
    namespaces: Map<string, string>,
  ): Promise<ResourceDefinition[]> {
    const resources: ResourceDefinition[] = [];
    this.resourceRoutes.clear();

    for (const [serverId, client] of clients) {
      const namespace = namespaces.get(serverId) ?? serverId;

      try {
        const result = await client.listResources();

        for (const resource of result.resources) {
          this.resourceRoutes.set(resource.uri, {
            originalUri: resource.uri,
            serverId,
          });

          resources.push({
            uri: resource.uri,
            name: `[${namespace}] ${resource.name}`,
            description: resource.description,
            mimeType: resource.mimeType,
          });
        }

        this.logger.info("Aggregated resources from server", {
          serverId,
          count: result.resources.length,
        });
      } catch (error) {
        this.logger.error("Failed to list resources from server", {
          serverId,
          error: String(error),
        });
      }
    }

    return resources;
  }

  async aggregatePrompts(
    clients: Map<string, Client>,
    namespaces: Map<string, string>,
  ): Promise<PromptDefinition[]> {
    const prompts: PromptDefinition[] = [];
    this.promptRoutes.clear();

    for (const [serverId, client] of clients) {
      const namespace = namespaces.get(serverId) ?? serverId;

      try {
        const result = await client.listPrompts();

        for (const prompt of result.prompts) {
          const namespacedName = `${namespace}_${prompt.name}`;

          this.promptRoutes.set(namespacedName, {
            originalName: prompt.name,
            serverId,
            namespace,
          });

          prompts.push({
            name: namespacedName,
            description: prompt.description
              ? `[${namespace}] ${prompt.description}`
              : undefined,
            arguments: prompt.arguments,
          });
        }

        this.logger.info("Aggregated prompts from server", {
          serverId,
          count: result.prompts.length,
        });
      } catch (error) {
        this.logger.error("Failed to list prompts from server", {
          serverId,
          error: String(error),
        });
      }
    }

    return prompts;
  }

  resolveToolRoute(namespacedName: string): ToolRouteEntry | undefined {
    return this.toolRoutes.get(namespacedName);
  }

  resolveResourceRoute(uri: string): ResourceRouteEntry | undefined {
    return this.resourceRoutes.get(uri);
  }

  resolvePromptRoute(namespacedName: string): PromptRouteEntry | undefined {
    return this.promptRoutes.get(namespacedName);
  }

  getToolCount(): number {
    return this.toolRoutes.size;
  }

  getResourceCount(): number {
    return this.resourceRoutes.size;
  }

  getPromptCount(): number {
    return this.promptRoutes.size;
  }
}
