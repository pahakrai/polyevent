import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { Skill, SkillContext } from './skill.interface';
import { INTROSPECTION_TOOLS } from '../tools';

/**
 * Schema discovery skill — the "Architect" role.
 *
 * Provides list_tables and describe_table so the LLM can verify
 * column names and data types BEFORE it attempts business queries.
 * This prevents "column not found" errors and guides the investigation.
 *
 * Queries PostgreSQL information_schema directly for reliability.
 * Does NOT depend on MCP being connected.
 */
@Injectable()
export class IntrospectionSkill implements Skill {
  readonly id = 'introspection';
  readonly name = 'Schema Introspection';
  readonly category = 'introspection' as const;
  readonly description =
    'Use these tools FIRST to discover what tables and columns are available. ' +
    'Always describe a table before querying it to verify column names.';
  readonly tools = INTROSPECTION_TOOLS;

  private readonly logger = new Logger(IntrospectionSkill.name);
  private readonly vendorPool: Pool;
  private readonly eventPool: Pool;

  constructor(configService: ConfigService) {
    const baseUrl =
      configService.get<string>('AGENT_DATABASE_URL') ||
      'postgresql://eventbooking:eventbooking123@localhost:5432';
    const url = new URL(baseUrl);
    const credentials = `${url.username}:${url.password}@${url.hostname}:${url.port}`;

    this.vendorPool = new Pool({ connectionString: `postgresql://${credentials}/vendor_db`, max: 2 });
    this.eventPool = new Pool({ connectionString: `postgresql://${credentials}/event_db`, max: 2 });
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    _context: SkillContext,
  ): Promise<string> {
    switch (toolName) {
      case 'list_tables':
        return this.listTables(args.schema as string | undefined);
      case 'describe_table':
        return this.describeTable(args.table_name as string, args.schema as string | undefined);
      default:
        return JSON.stringify({ error: `Unknown introspection tool: ${toolName}` });
    }
  }

  /** List all tables/views in vendor_db and event_db */
  private async listTables(schema = 'public'): Promise<string> {
    const query = `
      SELECT table_schema, table_name, table_type,
             (SELECT n_live_tup FROM pg_stat_user_tables t2
              WHERE t2.schemaname = t.table_schema AND t2.relname = t.table_name) AS estimated_rows
      FROM information_schema.tables t
      WHERE table_schema = $1
        AND table_name NOT LIKE 'pg_%' AND table_name NOT LIKE '_drizzle%'
        AND table_name NOT LIKE 'drizzle_%'
      ORDER BY table_type, table_name
    `;

    try {
      const vendorTables = await this.vendorPool.query(query, [schema]);
      const eventTables = await this.eventPool.query(query, [schema]);

      return JSON.stringify({
        vendor_db: vendorTables.rows,
        event_db: eventTables.rows,
        note: 'vendor_db contains venue/vendor/time_slot data. event_db contains event/booking data.',
      });
    } catch (error) {
      this.logger.error('list_tables failed', error);
      return JSON.stringify({ error: `Schema discovery failed: ${(error as Error).message}` });
    }
  }

  /** Describe a specific table's columns from both databases */
  private async describeTable(tableName: string, schema = 'public'): Promise<string> {
    const query = `
      SELECT column_name, data_type, udt_name, is_nullable,
             column_default, character_maximum_length,
             ordinal_position
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;

    try {
      const vendorCols = await this.vendorPool.query(query, [schema, tableName]);
      const eventCols = await this.eventPool.query(query, [schema, tableName]);

      let found = '';
      if (vendorCols.rows.length > 0) {
        found = `vendor_db.public.${tableName}`;
      } else if (eventCols.rows.length > 0) {
        found = `event_db.public.${tableName}`;
      }

      if (!found) {
        // Try to suggest similar tables
        const suggestQuery = `
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = $1 AND table_name LIKE $2
        `;
        const vendorSuggest = await this.vendorPool.query(suggestQuery, [schema, `%${tableName}%`]);
        const eventSuggest = await this.eventPool.query(suggestQuery, [schema, `%${tableName}%`]);
        const suggestions = [...vendorSuggest.rows, ...eventSuggest.rows].map((r) => r.table_name);

        return JSON.stringify({
          error: `Table "${tableName}" not found in vendor_db or event_db.`,
          similar_tables: suggestions.length > 0 ? suggestions : undefined,
        });
      }

      return JSON.stringify({
        table: found,
        columns: [...vendorCols.rows, ...eventCols.rows],
      });
    } catch (error) {
      this.logger.error(`describe_table(${tableName}) failed`, error);
      return JSON.stringify({ error: `Describe failed: ${(error as Error).message}` });
    }
  }
}
