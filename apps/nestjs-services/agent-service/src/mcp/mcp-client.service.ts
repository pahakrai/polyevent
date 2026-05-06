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
 * MCP client that connects to an external PostgreSQL MCP server
 * (crystaldba/postgres-mcp Docker container) via SSE transport.
 *
 * The crystal MCP server exposes a `query` tool for read-only SQL execution.
 * This service translates our internal tool names to the crystal server's
 * `query` tool, so skills can use semantic names like `db_list_tables`.
 */
@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transport: any = null;
  private connected = false;

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

        const tools = await this.discoverTools();
        this.logger.log(
          `MCP client connected to crystal-postgres-mcp at ${mcpHost}:${mcpPort}, ` +
          `discovered ${tools.length} native tool(s)`,
        );
        return; // success — exit retry loop
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
          const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s, 16s
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

  /** Return native tools from the MCP server (prefixed with db_) */
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

  // ── SQL sanitization patterns (treat agent SQL as untrusted input) ──

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

  /**
   * Call a tool on the MCP server.
   *
   * Translates our internal tool names to the crystal server's `query` tool:
   *   db_run_select_query → query(sql)
   *   db_list_tables       → query("SELECT ... FROM information_schema.tables ...")
   *   db_describe_table    → query("SELECT ... FROM information_schema.columns ...")
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) throw new Error('MCP client not connected');

    const translated = this.translateTool(name, args);

    // Gateway-level sanitization: treat agent-generated SQL as untrusted input
    if (translated.name === 'execute_sql' && typeof translated.args.sql === 'string') {
      this.validateSql(translated.args.sql);
    }

    const result = await this.client.callTool({
      name: translated.name,
      arguments: translated.args,
    });

    return JSON.stringify((result as { content: unknown }).content);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Tool name translation ──────────────────────────────────────────

  private translateTool(
    name: string,
    args: Record<string, unknown>,
  ): { name: string; args: Record<string, unknown> } {
    const toolName = name.startsWith('db_') ? name.slice(3) : name;

    switch (toolName) {
      case 'run_select_query':
        // Pass SQL through to the crystal server's query tool
        return { name: 'execute_sql', args: { sql: args.sql as string } };

      case 'list_tables':
        return {
          name: 'execute_sql',
          args: {
            sql: `
              SELECT
                t.table_schema AS schema,
                t.table_name AS name,
                t.table_type AS type,
                COALESCE(s.n_live_tup, 0)::integer AS estimated_rows
              FROM information_schema.tables t
              LEFT JOIN pg_stat_user_tables s
                ON s.schemaname = t.table_schema
                AND s.relname = t.table_name
              WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
              ORDER BY t.table_type, t.table_name
            `.trim(),
          },
        };

      case 'describe_table':
        return {
          name: 'execute_sql',
          args: {
            sql: `
              SELECT column_name, data_type, is_nullable, column_default
              FROM information_schema.columns
              WHERE table_name = '${(args.table_name as string).replace(/'/g, "''")}'
              ORDER BY ordinal_position
            `.trim(),
          },
        };

      default:
        // Pass through unknown tool names directly
        return { name: toolName, args };
    }
  }
}
