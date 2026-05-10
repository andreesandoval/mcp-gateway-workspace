import { z } from "zod";

export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${formatted}\n\nCheck your .env file or environment variables.`,
    );
  }

  return result.data as z.infer<T>;
}

export function expandHomePath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
    return filePath.replace("~", home);
  }
  return filePath;
}
