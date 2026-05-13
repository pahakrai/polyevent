import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ToolDefinition } from '../agent/tools';

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
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
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */

type SSEClientTransportCtor = new (url: URL) => unknown;

export interface McpConnection {
  discoverTools(): Promise<ToolDefinition[]>;
  executeSql(sql: string): Promise<string>;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

/**
 * Creates per-investigation MCP connections to crystaldba/postgres-mcp.
 *
 * Unlike McpClientService (NestJS singleton), this factory produces
 * standalone connections that are created when an investigation starts
 * and destroyed when it completes. Each connection is an independent
 * SSE transport to the MCP server.
 */
@Injectable()
export class McpClientFactory {
  private readonly logger = new Logger(McpClientFactory.name);
  private readonly mcpHost: string;
  private readonly mcpPort: string;

  constructor(configService: ConfigService) {
    this.mcpHost =
      configService.get<string>('MCP_SERVER_HOST') || 'localhost';
    this.mcpPort = configService.get<string>('MCP_SERVER_PORT') || '3001';
  }

  async create(): Promise<McpConnection> {
    if (!_Client || !_SSEClientTransport) {
      throw new Error('MCP SDK SSE transport unavailable');
    }

    const ClientCtor = _Client;
    const TransportCtor = _SSEClientTransport as SSEClientTransportCtor;
    const url = new URL(`http://${this.mcpHost}:${this.mcpPort}/sse`);

    const transport = new TransportCtor(url);
    const client = new ClientCtor(
      { name: 'agent-service', version: '1.0.0' },
      { capabilities: {} },
    );

    await client.connect(transport);

    const nativeTools = await (async () => {
      const result = await client.listTools();
      return (
        result.tools as Array<{
          name: string;
          description?: string;
          inputSchema: unknown;
        }>
      ).map((t) => ({
        name: `db_${t.name}`,
        description: `[Database] ${t.description || 'Database query'}`,
        input_schema: t.inputSchema as ToolDefinition['input_schema'],
      }));
    })();

    this.logger.log(
      `MCP connection created — ${nativeTools.length} native tools`,
    );

    const validateSql = (sql: string): void => {
      const dangerous = [
        /\bDROP\s+/i,
        /\bDELETE\s+FROM\b/i,
        /\bTRUNCATE\s+/i,
        /\bINSERT\s+INTO\b/i,
        /\bUPDATE\s+\w+\s+SET\b/i,
        /\bALTER\s+/i,
        /\bCREATE\s+/i,
        /\bGRANT\s+/i,
        /\bREVOKE\s+/i,
        /\bEXEC\s*\(/i,
      ];
      for (const regex of dangerous) {
        if (regex.test(sql)) {
          throw new Error(`SQL sanitizer blocked dangerous statement`);
        }
      }
    };

    return {
      discoverTools: async () => nativeTools,

      executeSql: async (sql: string) => {
        validateSql(sql);
        const result = await client.callTool({
          name: 'execute_sql',
          arguments: { sql },
        });
        return JSON.stringify((result as { content: unknown }).content);
      },

      callTool: async (name: string, args: Record<string, unknown>) => {
        const nativeName = name.startsWith('db_') ? name.slice(3) : name;
        if (nativeName === 'execute_sql' && typeof args.sql === 'string') {
          validateSql(args.sql);
        }
        const result = await client.callTool({
          name: nativeName,
          arguments: args,
        });
        return JSON.stringify((result as { content: unknown }).content);
      },

      close: async () => {
        await client.close();
        this.logger.log('MCP connection closed');
      },
    };
  }
}
