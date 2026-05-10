import { z } from "zod";

export const LogLevel = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevel>;

export interface ServerCapability {
  readonly name: string;
  readonly version: string;
  readonly description: string;
}

export interface BackendServerConfig {
  readonly id: string;
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly namespace: string;
}

export interface NamespacedTool {
  readonly originalName: string;
  readonly namespacedName: string;
  readonly serverId: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface HealthStatus {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly uptime: number;
  readonly servers: readonly ServerHealthEntry[];
}

export interface ServerHealthEntry {
  readonly id: string;
  readonly name: string;
  readonly status: "connected" | "disconnected" | "error";
  readonly toolCount: number;
  readonly resourceCount: number;
}

export const GatewayEnvSchema = z.object({
  GATEWAY_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  GATEWAY_AUTH_TOKEN: z.string().optional().default(""),
  COPILOT_ASSETS_DIR: z.string().min(1).default("./copilot-assets"),
  ANTIGRAVITY_DATA_DIR: z.string().min(1).default("~/.gemini/antigravity"),
  CURSOR_CONFIG_DIR: z.string().min(1).default("~/.cursor"),
  CURSOR_WORKSPACE_DIR: z.string().min(1).default("."),
  LOG_LEVEL: LogLevel.default("info"),
});

export type GatewayEnv = z.infer<typeof GatewayEnvSchema>;

export const CopilotServerEnvSchema = z.object({
  COPILOT_ASSETS_DIR: z.string().min(1).default("./copilot-assets"),
  LOG_LEVEL: LogLevel.default("info"),
});

export type CopilotServerEnv = z.infer<typeof CopilotServerEnvSchema>;

export const AntigravityServerEnvSchema = z.object({
  ANTIGRAVITY_DATA_DIR: z.string().min(1).default("~/.gemini/antigravity"),
  LOG_LEVEL: LogLevel.default("info"),
});

export type AntigravityServerEnv = z.infer<typeof AntigravityServerEnvSchema>;

export const CursorServerEnvSchema = z.object({
  CURSOR_CONFIG_DIR: z.string().min(1).default("~/.cursor"),
  CURSOR_WORKSPACE_DIR: z.string().min(1).default("."),
  LOG_LEVEL: LogLevel.default("info"),
});

export type CursorServerEnv = z.infer<typeof CursorServerEnvSchema>;

export interface AgentDefinition {
  readonly name: string;
  readonly description: string;
  readonly tools: readonly string[];
  readonly body: string;
  readonly filePath: string;
}

export interface SkillDefinition {
  readonly name: string;
  readonly content: string;
  readonly filePath: string;
}

export interface InstructionDefinition {
  readonly name: string;
  readonly content: string;
  readonly filePath: string;
}

export interface KnowledgeItemMetadata {
  readonly id: string;
  readonly summary: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly references: readonly string[];
}

export interface KnowledgeItem {
  readonly metadata: KnowledgeItemMetadata;
  readonly artifacts: readonly string[];
}

export interface ConversationSummary {
  readonly id: string;
  readonly overview: string;
}
