import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  parseEnv,
  expandHomePath,
  GatewayEnvSchema,
} from "@mcp-gateway/shared";
import { createVscodeServer } from "./server.js";

const env = parseEnv(GatewayEnvSchema);
const workspaceDir = expandHomePath(env.CURSOR_WORKSPACE_DIR);

const server = createVscodeServer(workspaceDir, env.LOG_LEVEL);
const transport = new StdioServerTransport();

await server.connect(transport);
