import { Injectable, Logger } from '@nestjs/common';
import { McpClientService } from '../mcp/mcp-client.service';
import type { McpConnection } from '../mcp/mcp-client.factory';
import { SqlGuardUtils } from './sql-guard.utils';

export interface ToolContext {
  vendorId: string;
  isSuperadmin: boolean;
}

/**
 * Central tool executor — the single choke point for all tool execution.
 *
 * Architecture:
 *   Agent (LLM) → calls tools → ToolExecutorService → SqlGuardUtils → MCP Server
 *
 * Two tool categories:
 *   Domain tools  — pre-built, parameterized business queries (get_booking_trends, etc.)
 *   Native tools  — db_* prefixed, forwarded to the crystal MCP server (db_execute_sql)
 *
 * An optional `mcpConnection` parameter on execute() routes to a per-investigation
 * MCP connection. When omitted, falls back to the singleton McpClientService.
 *
 * Defense in depth:
 *   Layer 1 (Guidance):   System prompt tells Agent to scope queries by vendor
 *   Layer 2 (Enforcement): SqlGuardUtils AST-injects vendor_id into every query
 *   Layer 3 (Database):   PostgreSQL RLS in the MCP container
 */
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(private readonly mcpClient: McpClientService) {}

  /** Single entry point — routes any tool name to the right backend.
   *  Pass `mcpConnection` for per-investigation MCP; omit for singleton fallback. */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
    mcpConnection?: McpConnection,
  ): Promise<string> {
    const mcp = mcpConnection ?? this.mcpClient;
    this.logger.log(
      `Executing ${toolName} for vendor ${ctx.vendorId}` +
      `${ctx.isSuperadmin ? ' [superadmin]' : ''}` +
      `${mcpConnection ? ' [scoped connection]' : ''}`,
    );

    // ── Native MCP tools (db_* prefix) — passthrough with scoping ──
    if (toolName.startsWith('db_')) {
      return this.executeNativeTool(toolName, args, ctx, mcp);
    }

    switch (toolName) {
      // ── Introspection ──────────────────────────────────────────
      case 'list_tables':
        return this.listTables(mcp);

      case 'describe_table':
        return this.describeTable(args.table_name as string, mcp);

      // ── Validation ─────────────────────────────────────────────
      case 'explain_tool':
        return this.explainTool(
          args.tool_name as string,
          (args.tool_args as Record<string, unknown>) || {},
          ctx,
          mcp,
        );

      // ── Business Analysis ──────────────────────────────────────
      case 'get_booking_trends':
      case 'get_event_performance':
      case 'get_venue_utilization':
      case 'get_market_comparison':
      case 'get_revenue_summary':
      case 'get_event_timeline':
        return this.runBusinessQuery(toolName, args, ctx, mcp);

      default:
        return JSON.stringify({
          error: `Unknown tool: ${toolName}`,
          available: [
            'list_tables', 'describe_table', 'explain_tool',
            'get_booking_trends', 'get_event_performance', 'get_venue_utilization',
            'get_market_comparison', 'get_revenue_summary', 'get_event_timeline',
            'db_execute_sql (native — raw SQL, vendor-scoped)',
          ],
        });
    }
  }

  // ── Native MCP tool passthrough ────────────────────────────────────

  private async executeNativeTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
    mcp: McpConnection | McpClientService,
  ): Promise<string> {
    const nativeName = toolName.slice(3); // strip db_ prefix

    if (nativeName === 'execute_sql' && typeof args.sql === 'string') {
      const securedSql = SqlGuardUtils.injectVendorScope(
        args.sql,
        ctx.vendorId,
        'db_execute_sql',
        ctx.isSuperadmin,
      );
      return mcp.callTool(toolName, { ...args, sql: securedSql });
    }

    return mcp.callTool(toolName, args);
  }

  // ── Introspection ──────────────────────────────────────────────────

  private async listTables(mcp: McpConnection | McpClientService): Promise<string> {
    try {
      const sql = `
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
      `.trim();
      return await mcp.executeSql(sql);
    } catch (error) {
      return JSON.stringify({ error: `list_tables failed: ${(error as Error).message}` });
    }
  }

  private async describeTable(
    tableName: string,
    mcp: McpConnection | McpClientService,
  ): Promise<string> {
    if (!tableName) {
      return JSON.stringify({ error: 'table_name is required' });
    }
    try {
      const sql = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '${tableName.replace(/'/g, "''")}'
        ORDER BY ordinal_position
      `.trim();
      return await mcp.executeSql(sql);
    } catch (error) {
      return JSON.stringify({ error: `describe_table failed: ${(error as Error).message}` });
    }
  }

  // ── Validation ─────────────────────────────────────────────────────

  private async explainTool(
    targetTool: string,
    toolArgs: Record<string, unknown>,
    ctx: ToolContext,
    mcp: McpConnection | McpClientService,
  ): Promise<string> {
    const validTools = [
      'get_booking_trends', 'get_event_performance', 'get_venue_utilization',
      'get_market_comparison', 'get_revenue_summary', 'get_event_timeline',
    ];

    if (!validTools.includes(targetTool)) {
      return JSON.stringify({
        error: `Cannot explain unknown tool: ${targetTool}`,
        available_tools: validTools,
        note: 'explain_tool only works with pre-built business analysis tools for security.',
      });
    }

    const params = this.buildQueryParams(targetTool, toolArgs);
    if ('error' in params) {
      return JSON.stringify(params);
    }

    const securedSql = SqlGuardUtils.injectVendorScope(
      params.sql,
      ctx.vendorId,
      targetTool,
      ctx.isSuperadmin,
    );
    const explainSql = `EXPLAIN (ANALYZE false, FORMAT json) ${securedSql}`;

    try {
      return await mcp.executeSql(explainSql);
    } catch (error) {
      return JSON.stringify({ error: `EXPLAIN failed: ${(error as Error).message}` });
    }
  }

  // ── Business Analysis ──────────────────────────────────────────────

  private async runBusinessQuery(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
    mcp: McpConnection | McpClientService,
  ): Promise<string> {
    const params = this.buildQueryParams(toolName, args);
    if ('error' in params) {
      return JSON.stringify(params);
    }

    const securedSql = SqlGuardUtils.injectVendorScope(
      params.sql,
      ctx.vendorId,
      toolName,
      ctx.isSuperadmin,
    );

    try {
      return await mcp.executeSql(securedSql);
    } catch (error) {
      this.logger.error(`Tool ${toolName} failed`, error as Error);
      return JSON.stringify({
        error: `Query failed: ${(error as Error).message}`,
        tool: toolName,
      });
    }
  }

  // ── SQL builders ───────────────────────────────────────────────────

  private buildQueryParams(
    toolName: string,
    args: Record<string, unknown>,
  ): { sql: string; database: string } | { error: string } {
    const months = (args.months as number) || 3;
    const category = args.category as string | undefined;

    switch (toolName) {
      case 'get_booking_trends':
        return {
          sql: `SELECT DATE_TRUNC('month', start_time) AS month, category, COUNT(*) AS event_count, SUM(current_bookings) AS total_bookings, ROUND(AVG(current_bookings * 100.0 / NULLIF(max_attendees, 0)), 1) AS avg_fill_pct FROM events WHERE start_time >= NOW() - ('${months} months')::INTERVAL ${category ? `AND category = '${category}'::event_category` : ''} GROUP BY DATE_TRUNC('month', start_time), category ORDER BY month DESC, category`,
          database: 'event_db',
        };

      case 'get_event_performance': {
        const status = args.status as string | undefined;
        const orderBy = (args.order_by as string) || 'fill_rate';
        const orderMap: Record<string, string> = {
          fill_rate: 'fill_pct ASC',
          bookings: 'current_bookings DESC',
          created_at: 'created_at DESC',
        };
        return {
          sql: `SELECT id, title, category, status, current_bookings, max_attendees, ROUND(current_bookings * 100.0 / NULLIF(max_attendees, 0), 1) AS fill_pct, price->>'base' AS price, start_time, created_at FROM events WHERE 1=1 ${category ? `AND category = '${category}'::event_category` : ''} ${status ? `AND status = '${status}'::event_status` : ''} ORDER BY ${orderMap[orderBy] || orderMap.fill_rate}`,
          database: 'event_db',
        };
      }

      case 'get_venue_utilization': {
        const venueId = args.venue_id as string | undefined;
        return {
          sql: `SELECT v.id AS venue_id, v.name AS venue_name, v.type AS venue_type, COUNT(ts.id) AS total_slots, COUNT(ts.id) FILTER (WHERE ts.status = 'AVAILABLE') AS available_slots, COUNT(ts.id) FILTER (WHERE ts.status = 'BOOKED') AS booked_slots, COUNT(ts.id) FILTER (WHERE ts.status = 'BLOCKED') AS blocked_slots, COUNT(ts.id) FILTER (WHERE ts.status = 'MAINTENANCE') AS maintenance_slots, ROUND(COUNT(ts.id) FILTER (WHERE ts.status = 'BOOKED') * 100.0 / NULLIF(COUNT(ts.id), 0), 1) AS utilization_pct FROM venues v LEFT JOIN time_slots ts ON ts.venue_id = v.id ${venueId ? `WHERE v.id = '${venueId}'` : ''} GROUP BY v.id, v.name, v.type ORDER BY utilization_pct DESC`,
          database: 'vendor_db',
        };
      }

      case 'get_market_comparison': {
        const city = args.city as string | undefined;
        return {
          sql: `SELECT category, location->>'city' AS city, COUNT(*) AS total_events, ROUND(AVG(current_bookings * 100.0 / NULLIF(max_attendees, 0)), 1) AS avg_fill_rate, COUNT(DISTINCT vendor_id) AS vendor_count FROM events WHERE status = 'PUBLISHED' ${category ? `AND category = '${category}'::event_category` : ''} ${city ? `AND location->>'city' ILIKE '${city}'` : ''} GROUP BY category, location->>'city' HAVING COUNT(*) >= 5 ORDER BY total_events DESC`,
          database: 'event_db',
        };
      }

      case 'get_revenue_summary':
        return {
          sql: `SELECT DATE_TRUNC('month', start_time) AS month, category, COUNT(*) AS event_count, SUM(current_bookings) AS total_bookings, SUM(current_bookings * COALESCE((price->>'base')::numeric, 0)) AS estimated_revenue, ROUND(AVG(current_bookings * COALESCE((price->>'base')::numeric, 0)), 2) AS avg_revenue_per_event FROM events WHERE start_time >= NOW() - ('${months} months')::INTERVAL GROUP BY DATE_TRUNC('month', start_time), category ORDER BY month DESC, estimated_revenue DESC`,
          database: 'event_db',
        };

      case 'get_event_timeline':
        return {
          sql: `SELECT id, title, category, status, start_time, created_at, updated_at, EXTRACT(DAY FROM (start_time - created_at)) AS lead_time_days, CASE WHEN status = 'CANCELLED' THEN true ELSE false END AS was_cancelled FROM events WHERE created_at >= NOW() - ('${months} months')::INTERVAL ORDER BY created_at DESC`,
          database: 'event_db',
        };

      default:
        return {
          error: `Unknown tool: ${toolName}. Available: get_booking_trends, get_event_performance, get_venue_utilization, get_market_comparison, get_revenue_summary, get_event_timeline`,
        };
    }
  }
}
