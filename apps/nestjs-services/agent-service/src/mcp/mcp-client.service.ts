import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ToolDefinition } from '../agent/tools';

/* eslint-disable @typescript-eslint/no-var-requires */

// MCP SDK has inconsistent exports across versions — load defensively
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _Client: any;
let _SSEClientTransport: unknown;

try {
  _Client = require('@modelcontextprotocol/sdk/client').Client as typeof _Client;
} catch {
  _Client = undefined;
}

try {
  _SSEClientTransport =
    require('@modelcontextprotocol/sdk/dist/cjs/client/sse.js').SSEClientTransport;
} catch {
  try {
    _SSEClientTransport =
      require('@modelcontextprotocol/sdk/client/sse').SSEClientTransport;
  } catch {
    _SSEClientTransport = undefined;
  }
}

/* eslint-enable @typescript-eslint/no-var-requires */

type SSEClientTransportCtor = new (url: URL) => unknown;

/**
 * Thin MCP client wrapper that connects to an external PostgreSQL MCP server
 * (crystaldba/postgres-mcp Docker container) via SSE transport.
 *
 * Responsibilities:
 *   - Connection lifecycle (connect, retry, disconnect)
 *   - Tool discovery — fetches native tools from the crystal server
 *   - SQL validation — blocks dangerous statements before execution
 *   - Forwarding — passes tool calls through to the crystal server via JSON-RPC
 *
 * Domain-level translation and vendor scoping live in ToolExecutorService.
 */
@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transport: any = null;
  private connected = false;
  private cachedNativeTools: ToolDefinition[] = [];

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    if (!_Client || !_SSEClientTransport) {
      this.logger.warn(
        'MCP SDK SSE transport unavailable — agent investigation tools will be unavailable. ' +
        'RAG chat and document endpoints work independently.',
      );
      return;
    }

    const ClientCtor = _Client;
    const TransportCtor = _SSEClientTransport as SSEClientTransportCtor;

    const mcpHost = this.configService.get<string>('MCP_SERVER_HOST') || 'localhost';
    const mcpPort = this.configService.get<string>('MCP_SERVER_PORT') || '3001';
    const url = new URL(`http://${mcpHost}:${mcpPort}/sse`);
    const maxRetries = 5;
    const baseDelayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.transport = new TransportCtor(url);

        this.client = new ClientCtor(
          { name: 'agent-service', version: '1.0.0' },
          { capabilities: {} },
        );

        await this.client.connect(this.transport);
        this.connected = true;

        this.cachedNativeTools = await this.discoverTools();
        this.logger.log(
          `MCP client connected to crystal-postgres-mcp at ${mcpHost}:${mcpPort}, ` +
          `discovered ${this.cachedNativeTools.length} native tool(s): ` +
          `${this.cachedNativeTools.map((t) => t.name).join(', ') || '(none)'}`,
        );
        return;
      } catch (error) {
        const isLast = attempt === maxRetries;
        if (isLast) {
          this.logger.error(
            `Failed to connect to crystal-postgres-mcp at ${mcpHost}:${mcpPort} ` +
            `after ${maxRetries} attempts. ` +
            `Ensure the Docker container is running: ` +
            `docker run -d --name crystal-mcp-server -p ${mcpPort}:8099 ` +
            `-e DATABASE_URI="postgresql://..." crystaldba/postgres-mcp --transport=sse --sse-port=8099 --access-mode=restricted`,
            error as Error,
          );
        } else {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `MCP connection attempt ${attempt}/${maxRetries} failed, ` +
            `retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        this.logger.warn('Error closing MCP client', error as Error);
      }
      this.connected = false;
      this.logger.log('MCP client disconnected');
    }
  }

  // ── Native tool discovery ─────────────────────────────────────────

  /** Return native tools from the crystal MCP server (prefixed with `db_`). */
  async discoverTools(): Promise<ToolDefinition[]> {
    if (!this.client) return [];
    const result = await this.client.listTools();
    return (
      result.tools as Array<{ name: string; description?: string; inputSchema: unknown }>
    ).map((t) => ({
      name: `db_${t.name}`,
      description: `[Database] ${t.description || 'Database query'}`,
      input_schema: t.inputSchema as ToolDefinition['input_schema'],
    }));
  }

  /** Native crystal tools (prefixed with `db_`), cached after connect. */
  getNativeTools(): ToolDefinition[] {
    return this.cachedNativeTools;
  }

  // ── SQL sanitization ──────────────────────────────────────────────

  private static readonly DANGEROUS_SQL = [
    { regex: /\bDROP\s+/i, name: 'DROP' },
    { regex: /\bDELETE\s+FROM\b/i, name: 'DELETE FROM' },
    { regex: /\bTRUNCATE\s+/i, name: 'TRUNCATE' },
    { regex: /\bINSERT\s+INTO\b/i, name: 'INSERT INTO' },
    { regex: /\bUPDATE\s+\w+\s+SET\b/i, name: 'UPDATE ... SET' },
    { regex: /\bALTER\s+/i, name: 'ALTER' },
    { regex: /\bCREATE\s+/i, name: 'CREATE' },
    { regex: /\bGRANT\s+/i, name: 'GRANT' },
    { regex: /\bREVOKE\s+/i, name: 'REVOKE' },
    { regex: /\bEXEC\s*\(/i, name: 'EXEC(...)' },
    { regex: /;\s*\w+\s/, name: 'stacked queries' },
    { regex: /\bUNION\s+SELECT\b/i, name: 'UNION SELECT injection' },
  ];

  private validateSql(sql: string): void {
    for (const { regex, name } of McpClientService.DANGEROUS_SQL) {
      if (regex.test(sql)) {
        const msg = `SQL sanitizer blocked "${name}" in query`;
        this.logger.warn(msg);
        throw new Error(msg);
      }
    }
  }

  // ── Tool execution ────────────────────────────────────────────────

  /**
   * Execute a validated SQL statement against the crystal server.
   * Domain tools should use this after building and scoping their SQL.
   */
  async executeSql(sql: string): Promise<string> {
    if (!this.client) throw new Error('MCP client not connected');

    this.validateSql(sql);

    const result = await this.client.callTool({
      name: 'execute_sql',
      arguments: { sql },
    });

    return JSON.stringify((result as { content: unknown }).content);
  }

  /**
   * Forward a native tool call to the crystal MCP server.
   * Strips the `db_` prefix from tool names before forwarding.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) throw new Error('MCP client not connected');

    const nativeName = name.startsWith('db_') ? name.slice(3) : name;

    // Gateway-level sanitization for SQL-bearing tools
    if (nativeName === 'execute_sql' && typeof args.sql === 'string') {
      this.validateSql(args.sql);
    }

    const result = await this.client.callTool({
      name: nativeName,
      arguments: args,
    });

    return JSON.stringify((result as { content: unknown }).content);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
