import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import type {
  KnowledgeItem,
  KnowledgeItemMetadata,
  ConversationSummary,
} from "@mcp-gateway/shared";

interface RawMetadata {
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  references?: unknown[];
}

function parseMetadata(raw: unknown, id: string): KnowledgeItemMetadata {
  const data = (typeof raw === "object" && raw !== null ? raw : {}) as RawMetadata;
  return {
    id,
    summary: data.summary ?? "",
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt ?? "",
    references: Array.isArray(data.references)
      ? data.references.filter((r): r is string => typeof r === "string")
      : [],
  };
}

export async function listKnowledgeItems(
  dataDir: string,
): Promise<KnowledgeItemMetadata[]> {
  const knowledgeDir = join(dataDir, "knowledge");
  const items: KnowledgeItemMetadata[] = [];

  try {
    const entries = await readdir(knowledgeDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const metadataPath = join(knowledgeDir, entry.name, "metadata.json");
      try {
        const raw = await readFile(metadataPath, "utf-8");
        const parsed: unknown = JSON.parse(raw);
        items.push(parseMetadata(parsed, entry.name));
      } catch {
        items.push({
          id: entry.name,
          summary: "",
          createdAt: "",
          updatedAt: "",
          references: [],
        });
      }
    }
  } catch {
    // Knowledge directory might not exist
  }

  return items;
}

export async function readKnowledgeItem(
  dataDir: string,
  id: string,
): Promise<KnowledgeItem | null> {
  const itemDir = join(dataDir, "knowledge", id);
  const metadataPath = join(itemDir, "metadata.json");

  try {
    const raw = await readFile(metadataPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const metadata = parseMetadata(parsed, id);

    const artifactsDir = join(itemDir, "artifacts");
    const artifacts: string[] = [];

    try {
      const entries = await readdir(artifactsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const content = await readFile(
            join(artifactsDir, entry.name),
            "utf-8",
          );
          artifacts.push(content);
        }
      }
    } catch {
      // Artifacts directory might not exist
    }

    return { metadata, artifacts };
  } catch {
    return null;
  }
}

export async function listConversations(
  dataDir: string,
): Promise<ConversationSummary[]> {
  const brainDir = join(dataDir, "brain");
  const conversations: ConversationSummary[] = [];

  try {
    const entries = await readdir(brainDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const overviewPath = join(
        brainDir,
        entry.name,
        ".system_generated",
        "logs",
        "overview.txt",
      );

      let overview = "";
      try {
        const content = await readFile(overviewPath, "utf-8");
        overview = content.slice(0, 500);
      } catch {
        // Overview might not exist
      }

      conversations.push({ id: entry.name, overview });
    }
  } catch {
    // Brain directory might not exist
  }

  return conversations;
}

export async function readConversation(
  dataDir: string,
  id: string,
): Promise<ConversationSummary | null> {
  const overviewPath = join(
    dataDir,
    "brain",
    id,
    ".system_generated",
    "logs",
    "overview.txt",
  );

  try {
    const content = await readFile(overviewPath, "utf-8");
    return { id, overview: content };
  } catch {
    return null;
  }
}

export async function searchKnowledge(
  dataDir: string,
  query: string,
): Promise<KnowledgeItemMetadata[]> {
  const items = await listKnowledgeItems(dataDir);
  const lowerQuery = query.toLowerCase();

  return items.filter((item) => {
    const searchableText = [item.id, item.summary, ...item.references]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(lowerQuery);
  });
}

export async function listSkillFiles(dataDir: string): Promise<string[]> {
  const skillsDir = join(dataDir, "skills");
  const files: string[] = [];

  try {
    const entries = await readdir(skillsDir, {
      withFileTypes: true,
      recursive: true,
    });
    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(basename(entry.name));
      }
    }
  } catch {
    // Skills directory might not exist
  }

  return files;
}
