import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export async function readVscodeSettings(workspaceDir: string): Promise<string | null> {
  const settingsPath = join(workspaceDir, ".vscode", "settings.json");
  try {
    return await readFile(settingsPath, "utf-8");
  } catch {
    return null;
  }
}

export async function writeVscodeSettings(workspaceDir: string, content: string): Promise<void> {
  const vscodeDir = join(workspaceDir, ".vscode");
  if (!existsSync(vscodeDir)) {
    mkdirSync(vscodeDir, { recursive: true });
  }
  const settingsPath = join(vscodeDir, "settings.json");
  await writeFile(settingsPath, content, "utf-8");
}

export async function readVscodeTasks(workspaceDir: string): Promise<string | null> {
  const tasksPath = join(workspaceDir, ".vscode", "tasks.json");
  try {
    return await readFile(tasksPath, "utf-8");
  } catch {
    return null;
  }
}
