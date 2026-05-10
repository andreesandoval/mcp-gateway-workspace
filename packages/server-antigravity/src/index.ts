import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  parseEnv,
  expandHomePath,
  AntigravityServerEnvSchema,
} from "@mcp-gateway/shared";
import { createAntigravityServer } from "./server.js";

const env = parseEnv(AntigravityServerEnvSchema);
const dataDir = expandHomePath(env.ANTIGRAVITY_DATA_DIR);

const server = createAntigravityServer(dataDir, env.LOG_LEVEL);
const transport = new StdioServerTransport();

await server.connect(transport);
