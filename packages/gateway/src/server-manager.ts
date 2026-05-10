import { spawn, type ChildProcess } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Logger } from "@mcp-gateway/shared";
import type { BackendServerConfig, LogLevel } from "@mcp-gateway/shared";

interface ManagedServer {
  readonly config: BackendServerConfig;
  readonly client: Client;
  readonly transport: StdioClientTransport;
  readonly process: ChildProcess;
}

export class ServerManager {
  private readonly servers = new Map<string, ManagedServer>();
  private readonly logger: Logger;

  constructor(logLevel: LogLevel = "info") {
    this.logger = new Logger("server-manager", logLevel);
  }

  async startServer(config: BackendServerConfig): Promise<Client> {
    this.logger.info("Starting backend server", {
      id: config.id,
      command: config.command,
    });

    const transport = new StdioClientTransport({
      command: config.command,
      args: [...config.args],
      env: { ...process.env, ...config.env } as Record<string, string>,
    });

    const client = new Client(
      { name: `gateway-client-${config.id}`, version: "1.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);

    const childProcess = (transport as unknown as { _process?: ChildProcess })
      ._process;

    if (!childProcess) {
      this.logger.warn("Could not access child process reference", {
        id: config.id,
      });
    }

    this.servers.set(config.id, {
      config,
      client,
      transport,
      process: childProcess as ChildProcess,
    });

    this.logger.info("Backend server started", { id: config.id });
    return client;
  }

  getClient(serverId: string): Client | undefined {
    return this.servers.get(serverId)?.client;
  }

  getAllClients(): Map<string, Client> {
    const clients = new Map<string, Client>();
    for (const [id, managed] of this.servers) {
      clients.set(id, managed.client);
    }
    return clients;
  }

  getServerConfigs(): BackendServerConfig[] {
    return Array.from(this.servers.values()).map((s) => s.config);
  }

  isServerConnected(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;
    return server.process ? !server.process.killed : true;
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down all backend servers");

    const shutdownPromises = Array.from(this.servers.entries()).map(
      async ([id, managed]) => {
        try {
          await managed.client.close();
          this.logger.info("Server shut down", { id });
        } catch (error) {
          this.logger.error("Error shutting down server", {
            id,
            error: String(error),
          });
        }
      },
    );

    await Promise.allSettled(shutdownPromises);
    this.servers.clear();
  }
}
