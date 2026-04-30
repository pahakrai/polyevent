import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ToolDefinition } from '../agent/tools';

/* eslint-disable @typescript-eslint/no-var-requires */
// MCP SDK uses package.json "exports" which requires Node16 module resolution.
// The agent-service uses CommonJS (module: commonjs, moduleResolution: node).
// We use require() so TypeScript skips static type-checking on these imports.
const mcpSdk = require('@modelcontextprotocol/sdk/client');
const Client = mcpSdk.Client;
const StdioClientTransport = require('@modelcontextprotocol/sdk/client/stdio').StdioClientTransport;
/* eslint-enable @typescript-eslint/no-var-requires */

@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private client: InstanceType<typeof Client> | null = null;
  private transport: InstanceType<typeof StdioClientTransport> | null = null;
  private connected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const dbUrl = this.configService.get<string>('AGENT_DATABASE_URL');
    if (!dbUrl) {
      this.logger.warn('AGENT_DATABASE_URL not set — MCP will not connect.');
      return;
    }

    try {
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@anthropic/mcp-server-postgres', dbUrl],
      });

      this.client = new Client(
        { name: 'agent-service', version: '1.0.0' },
        { capabilities: {} },
      );

      await this.client.connect(this.transport);
      this.connected = true;
      this.logger.log('MCP PostgreSQL client connected');
    } catch (error) {
      this.logger.error('Failed to connect MCP PostgreSQL client', error);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      this.logger.log('MCP PostgreSQL client disconnected');
    }
  }

  async discoverTools(): Promise<ToolDefinition[]> {
    if (!this.client) return [];
    const result = await this.client.listTools();
    return (result.tools as Array<{ name: string; description?: string; inputSchema: unknown }>).map(
      (t) => ({
        name: `db_${t.name}`,
        description: `[Database] ${t.description || 'Database query'}`,
        input_schema: t.inputSchema as ToolDefinition['input_schema'],
      }),
    );
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) throw new Error('MCP client not connected');
    const result = await this.client.callTool({ name, arguments: args });
    return JSON.stringify((result as { content: unknown }).content);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
