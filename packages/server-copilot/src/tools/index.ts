import { readdir, readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  AgentDefinition,
  SkillDefinition,
  InstructionDefinition,
} from "@mcp-gateway/shared";

function parseAgentFrontmatter(
  content: string,
  filePath: string,
): AgentDefinition {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      name: basename(filePath, extname(filePath)),
      description: "",
      tools: [],
      body: content,
      filePath,
    };
  }

  const yamlContent = frontmatterMatch[1] ?? "";
  const body = frontmatterMatch[2] ?? "";
  const parsed = parseYaml(yamlContent) as Record<string, unknown>;

  return {
    name: typeof parsed["name"] === "string" ? parsed["name"] : basename(filePath, extname(filePath)),
    description: typeof parsed["description"] === "string" ? parsed["description"] : "",
    tools: Array.isArray(parsed["tools"])
      ? (parsed["tools"] as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    body,
    filePath,
  };
}

export async function listAgents(assetsDir: string): Promise<AgentDefinition[]> {
  const agentsDir = join(assetsDir, "agents");
  const agents: AgentDefinition[] = [];

  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".agent.md")) continue;
      const filePath = join(agentsDir, entry.name);
      const content = await readFile(filePath, "utf-8");
      agents.push(parseAgentFrontmatter(content, filePath));
    }
  } catch {
    // Directory might not exist yet
  }

  return agents;
}

export async function readAgent(
  assetsDir: string,
  name: string,
): Promise<AgentDefinition | null> {
  const agents = await listAgents(assetsDir);
  return agents.find((a) => a.name === name) ?? null;
}

export async function listSkills(assetsDir: string): Promise<SkillDefinition[]> {
  const skillsDir = join(assetsDir, "skills");
  const skills: SkillDefinition[] = [];

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true, recursive: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name !== "SKILL.md" && !entry.name.endsWith(".skill.md")) continue;
      const filePath = join(entry.parentPath ?? entry.path ?? skillsDir, entry.name);
      const content = await readFile(filePath, "utf-8");
      skills.push({
        name: basename(entry.parentPath ?? entry.path ?? entry.name),
        content,
        filePath,
      });
    }
  } catch {
    // Directory might not exist yet
  }

  return skills;
}

export async function readSkill(
  assetsDir: string,
  name: string,
): Promise<SkillDefinition | null> {
  const skills = await listSkills(assetsDir);
  return skills.find((s) => s.name === name) ?? null;
}

export async function listInstructions(
  assetsDir: string,
): Promise<InstructionDefinition[]> {
  const instructionsDir = join(assetsDir, "instructions");
  const instructions: InstructionDefinition[] = [];

  try {
    const entries = await readdir(instructionsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const filePath = join(instructionsDir, entry.name);
      const content = await readFile(filePath, "utf-8");
      instructions.push({
        name: basename(entry.name, ".md"),
        content,
        filePath,
      });
    }
  } catch {
    // Directory might not exist yet
  }

  return instructions;
}

export async function readInstruction(
  assetsDir: string,
  name: string,
): Promise<InstructionDefinition | null> {
  const instructions = await listInstructions(assetsDir);
  return instructions.find((i) => i.name === name) ?? null;
}
