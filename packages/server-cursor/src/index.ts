import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  parseEnv,
  expandHomePath,
  CursorServerEnvSchema,
} from "@mcp-gateway/shared";
import { createCursorServer } from "./server.js";

const env = parseEnv(CursorServerEnvSchema);
const configDir = expandHomePath(env.CURSOR_CONFIG_DIR);
const workspaceDir = expandHomePath(env.CURSOR_WORKSPACE_DIR);

const server = createCursorServer(configDir, workspaceDir, env.LOG_LEVEL);
const transport = new StdioServerTransport();

await server.connect(transport);
