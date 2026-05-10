import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  listAgents,
  readAgent,
  listSkills,
  readSkill,
  listInstructions,
  readInstruction,
} from "./tools/index.js";
import { Logger } from "@mcp-gateway/shared";
import type { LogLevel } from "@mcp-gateway/shared";

export function createCopilotServer(
  assetsDir: string,
  logLevel: LogLevel = "info",
): Server {
  const logger = new Logger("server-copilot", logLevel);
  const server = new Server(
    { name: "copilot-server", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing tools");
    return {
      tools: [
        {
          name: "list_agents",
          description:
            "List all custom GitHub Copilot agents available in the assets directory",
          inputSchema: { type: "object" as const, properties: {} },
        },
        {
          name: "read_agent",
          description:
            "Read a specific GitHub Copilot agent definition including YAML frontmatter and instructions",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: {
                type: "string",
                description: "Name of the agent to read",
              },
            },
            required: ["name"],
          },
        },
        {
          name: "list_skills",
          description:
            "List all custom GitHub Copilot skills from the assets directory",
          inputSchema: { type: "object" as const, properties: {} },
        },
        {
          name: "read_skill",
          description: "Read a specific GitHub Copilot skill definition",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: {
                type: "string",
                description: "Name of the skill to read",
              },
            },
            required: ["name"],
          },
        },
        {
          name: "list_instructions",
          description:
            "List all custom GitHub Copilot instructions from the assets directory",
          inputSchema: { type: "object" as const, properties: {} },
        },
        {
          name: "read_instruction",
          description: "Read a specific GitHub Copilot instruction file",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: {
                type: "string",
                description: "Name of the instruction to read",
              },
            },
            required: ["name"],
          },
        },
        {
          name: "apply_agent_context",
          description:
            "Get the full context (system prompt, tools, and instructions) for a specific Copilot agent, ready to be injected into an AI conversation",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: {
                type: "string",
                description: "Name of the agent whose context to apply",
              },
            },
            required: ["name"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    logger.debug("Calling tool", { name, args });

    switch (name) {
      case "list_agents": {
        const agents = await listAgents(assetsDir);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                agents.map((a) => ({
                  name: a.name,
                  description: a.description,
                  tools: a.tools,
                })),
                null,
                2,
              ),
            },
          ],
        };
      }

      case "read_agent": {
        const agentName = z.string().parse(args["name"]);
        const agent = await readAgent(assetsDir, agentName);
        if (!agent) {
          return {
            content: [
              { type: "text" as const, text: `Agent "${agentName}" not found` },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(agent, null, 2) },
          ],
        };
      }

      case "list_skills": {
        const skills = await listSkills(assetsDir);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                skills.map((s) => ({ name: s.name, filePath: s.filePath })),
                null,
                2,
              ),
            },
          ],
        };
      }

      case "read_skill": {
        const skillName = z.string().parse(args["name"]);
        const skill = await readSkill(assetsDir, skillName);
        if (!skill) {
          return {
            content: [
              { type: "text" as const, text: `Skill "${skillName}" not found` },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(skill, null, 2) },
          ],
        };
      }

      case "list_instructions": {
        const instructions = await listInstructions(assetsDir);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                instructions.map((i) => ({
                  name: i.name,
                  filePath: i.filePath,
                })),
                null,
                2,
              ),
            },
          ],
        };
      }

      case "read_instruction": {
        const instrName = z.string().parse(args["name"]);
        const instruction = await readInstruction(assetsDir, instrName);
        if (!instruction) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Instruction "${instrName}" not found`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(instruction, null, 2),
            },
          ],
        };
      }

      case "apply_agent_context": {
        const ctxName = z.string().parse(args["name"]);
        const agent = await readAgent(assetsDir, ctxName);
        if (!agent) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Agent "${ctxName}" not found`,
              },
            ],
            isError: true,
          };
        }
        const context = [
          `# Agent: ${agent.name}`,
          agent.description ? `\nDescription: ${agent.description}` : "",
          agent.tools.length > 0
            ? `\nAvailable tools: ${agent.tools.join(", ")}`
            : "",
          `\n## Instructions\n\n${agent.body}`,
        ]
          .filter(Boolean)
          .join("\n");
        return {
          content: [{ type: "text" as const, text: context }],
        };
      }

      default:
        return {
          content: [
            { type: "text" as const, text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const agents = await listAgents(assetsDir);
    const skills = await listSkills(assetsDir);
    const instructions = await listInstructions(assetsDir);

    return {
      resources: [
        ...agents.map((a) => ({
          uri: `copilot://agents/${a.name}`,
          name: `Agent: ${a.name}`,
          description: a.description || `Copilot agent ${a.name}`,
          mimeType: "text/markdown",
        })),
        ...skills.map((s) => ({
          uri: `copilot://skills/${s.name}`,
          name: `Skill: ${s.name}`,
          description: `Copilot skill ${s.name}`,
          mimeType: "text/markdown",
        })),
        ...instructions.map((i) => ({
          uri: `copilot://instructions/${i.name}`,
          name: `Instruction: ${i.name}`,
          description: `Copilot instruction ${i.name}`,
          mimeType: "text/markdown",
        })),
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.debug("Reading resource", { uri });

    const agentMatch = uri.match(/^copilot:\/\/agents\/(.+)$/);
    if (agentMatch) {
      const agentName = agentMatch[1]!;
      const agent = await readAgent(assetsDir, agentName);
      if (!agent) throw new Error(`Agent "${agentName}" not found`);
      return {
        contents: [
          { uri, mimeType: "text/markdown", text: agent.body },
        ],
      };
    }

    const skillMatch = uri.match(/^copilot:\/\/skills\/(.+)$/);
    if (skillMatch) {
      const skillName = skillMatch[1]!;
      const skill = await readSkill(assetsDir, skillName);
      if (!skill) throw new Error(`Skill "${skillName}" not found`);
      return {
        contents: [
          { uri, mimeType: "text/markdown", text: skill.content },
        ],
      };
    }

    const instrMatch = uri.match(/^copilot:\/\/instructions\/(.+)$/);
    if (instrMatch) {
      const instrName = instrMatch[1]!;
      const instruction = await readInstruction(assetsDir, instrName);
      if (!instruction) throw new Error(`Instruction "${instrName}" not found`);
      return {
        contents: [
          { uri, mimeType: "text/markdown", text: instruction.content },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: "copilot-agent-prompt",
        description:
          "Generate a system prompt pre-configured with a specific Copilot agent context",
        arguments: [
          {
            name: "agent_name",
            description: "Name of the agent to use",
            required: true,
          },
        ],
      },
      {
        name: "copilot-review-prompt",
        description:
          "Generate a code review prompt following Copilot conventions",
        arguments: [
          {
            name: "language",
            description: "Programming language for the review",
            required: false,
          },
        ],
      },
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    const promptArgs = (request.params.arguments ?? {}) as Record<
      string,
      string
    >;

    switch (name) {
      case "copilot-agent-prompt": {
        const agentName = promptArgs["agent_name"];
        if (!agentName) throw new Error("agent_name argument is required");

        const agent = await readAgent(assetsDir, agentName);
        if (!agent) throw new Error(`Agent "${agentName}" not found`);

        return {
          description: `System prompt for Copilot agent: ${agent.name}`,
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: [
                  `You are acting as the "${agent.name}" agent.`,
                  agent.description
                    ? `\nDescription: ${agent.description}`
                    : "",
                  agent.tools.length > 0
                    ? `\nYou have access to these tools: ${agent.tools.join(", ")}`
                    : "",
                  `\n\n${agent.body}`,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            },
          ],
        };
      }

      case "copilot-review-prompt": {
        const language = promptArgs["language"] ?? "any language";
        return {
          description: "Code review prompt following Copilot conventions",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: [
                  `Please review the following ${language} code using GitHub Copilot best practices:`,
                  "",
                  "1. Check for potential bugs and edge cases",
                  "2. Evaluate code readability and naming conventions",
                  "3. Suggest performance improvements",
                  "4. Verify error handling completeness",
                  "5. Check for security vulnerabilities",
                  "6. Ensure adherence to SOLID principles",
                  "",
                  "Provide specific, actionable feedback with code examples where appropriate.",
                ].join("\n"),
              },
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  logger.info("Copilot server created", { assetsDir });
  return server;
}
