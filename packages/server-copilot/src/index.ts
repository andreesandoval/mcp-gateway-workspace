import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseEnv, expandHomePath, CopilotServerEnvSchema } from "@mcp-gateway/shared";
import { createCopilotServer } from "./server.js";

const env = parseEnv(CopilotServerEnvSchema);
const assetsDir = expandHomePath(env.COPILOT_ASSETS_DIR);

const server = createCopilotServer(assetsDir, env.LOG_LEVEL);
const transport = new StdioServerTransport();

await server.connect(transport);
