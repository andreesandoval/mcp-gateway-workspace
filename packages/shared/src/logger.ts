import type { LogLevel } from "./types.js";

interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly component: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
}

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private readonly minLevel: number;

  constructor(
    private readonly component: string,
    level: LogLevel = "info",
  ) {
    this.minLevel = LOG_PRIORITY[level];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (LOG_PRIORITY[level] < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      ...(data ? { data } : {}),
    };

    // Write to stderr to avoid interfering with stdio MCP transport
    process.stderr.write(JSON.stringify(entry) + "\n");
  }
}
