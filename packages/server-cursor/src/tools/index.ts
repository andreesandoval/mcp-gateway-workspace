import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

interface McpServerEntry {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerEntry>;
}

export async function readCursorRules(
  workspaceDir: string,
): Promise<string | null> {
  const possiblePaths = [
    join(workspaceDir, ".cursorrules"),
    join(workspaceDir, ".cursor", "rules"),
  ];

  for (const rulePath of possiblePaths) {
    try {
      return await readFile(rulePath, "utf-8");
    } catch {
      continue;
    }
  }

  return null;
}

export async function writeCursorRules(
  workspaceDir: string,
  content: string,
): Promise<string> {
  const rulesPath = join(workspaceDir, ".cursorrules");
  await writeFile(rulesPath, content, "utf-8");
  return rulesPath;
}

export async function readMcpConfig(
  configDir: string,
): Promise<McpConfig | null> {
  const configPath = join(configDir, "mcp.json");

  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as McpConfig;
  } catch {
    return null;
  }
}

export async function addMcpServer(
  configDir: string,
  name: string,
  config: McpServerEntry,
): Promise<McpConfig> {
  const configPath = join(configDir, "mcp.json");
  let existing: McpConfig = { mcpServers: {} };

  try {
    const raw = await readFile(configPath, "utf-8");
    existing = JSON.parse(raw) as McpConfig;
  } catch {
    // File doesn't exist, start fresh
  }

  existing.mcpServers[name] = config;
  await writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
  return existing;
}

export async function removeMcpServer(
  configDir: string,
  name: string,
): Promise<McpConfig> {
  const configPath = join(configDir, "mcp.json");
  let existing: McpConfig = { mcpServers: {} };

  try {
    const raw = await readFile(configPath, "utf-8");
    existing = JSON.parse(raw) as McpConfig;
  } catch {
    // File doesn't exist
  }

  const { [name]: _, ...rest } = existing.mcpServers;
  existing.mcpServers = rest;
  await writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
  return existing;
}

export async function listWorkspaces(
  configDir: string,
): Promise<string[]> {
  const workspaceStoragePath = join(configDir, "User", "workspaceStorage");
  const workspaces: string[] = [];

  try {
    if (existsSync(workspaceStoragePath)) {
      const entries = await readdir(workspaceStoragePath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const wsInfoPath = join(
            workspaceStoragePath,
            entry.name,
            "workspace.json",
          );
          try {
            const raw = await readFile(wsInfoPath, "utf-8");
            const info = JSON.parse(raw) as { folder?: string };
            if (info.folder) {
              workspaces.push(info.folder);
            }
          } catch {
            // workspace.json might not exist
          }
        }
      }
    }
  } catch {
    // Storage directory might not exist
  }

  return workspaces;
}
