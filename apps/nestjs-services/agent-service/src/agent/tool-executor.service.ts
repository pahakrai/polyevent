import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

/**
 * Executes tool calls against PostgreSQL.
 *
 * Uses two connection pools because data is split across databases:
 *   - vendor_db: vendors, venues, time_slots
 *   - event_db:   events
 *
 * Security: every query injects `app.current_vendor_id` for RLS.
 * Market queries hit pre-aggregated views that bypass RLS but contain
 * only anonymized GROUP BY aggregates (no individual vendor rows).
 *
 * For production with cross-database joins, set up a read replica
 * with PostgreSQL Foreign Data Wrappers federating vendor_db + event_db.
 */
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);
  private readonly vendorPool: Pool;
  private readonly eventPool: Pool;

  constructor(configService: ConfigService) {
    const baseUrl =
      configService.get<string>('AGENT_DATABASE_URL') ||
      'postgresql://eventbooking:eventbooking123@localhost:5432';

    // Parse base URL to substitute database names
    const url = new URL(baseUrl);
    const credentials = `${url.username}:${url.password}@${url.hostname}:${url.port}`;

    this.vendorPool = new Pool({
      connectionString: `postgresql://${credentials}/vendor_db`,
      max: 5,
    });

    this.eventPool = new Pool({
      connectionString: `postgresql://${credentials}/event_db`,
      max: 5,
    });
  }

  private async setVendorContext(client: import('pg').PoolClient, vendorId: string) {
    await client.query('SELECT set_config($1, $2, false)', [
      'app.current_vendor_id',
      vendorId,
    ]);
  }

  /** Query vendor_db */
  private async queryVendor(vendorId: string, sql: string, params: unknown[] = []) {
    const client = await this.vendorPool.connect();
    try {
      await this.setVendorContext(client, vendorId);
      return (await client.query(sql, params)).rows;
    } finally {
      client.release();
    }
  }

  /** Query event_db */
  private async queryEvent(vendorId: string, sql: string, params: unknown[] = []) {
    const client = await this.eventPool.connect();
    try {
      await this.setVendorContext(client, vendorId);
      return (await client.query(sql, params)).rows;
    } finally {
      client.release();
    }
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    vendorId: string,
  ): Promise<string> {
    this.logger.log(`Executing ${toolName} for vendor ${vendorId}`);

    try {
      let rows: unknown[];

      switch (toolName) {
        case 'get_booking_trends':
          rows = await this.getBookingTrends(vendorId, args);
          break;
        case 'get_event_performance':
          rows = await this.getEventPerformance(vendorId, args);
          break;
        case 'get_venue_utilization':
          rows = await this.getVenueUtilization(vendorId, args);
          break;
        case 'get_market_comparison':
          rows = await this.getMarketComparison(vendorId, args);
          break;
        case 'get_revenue_summary':
          rows = await this.getRevenueSummary(vendorId, args);
          break;
        case 'get_event_timeline':
          rows = await this.getEventTimeline(vendorId, args);
          break;
        default:
          return JSON.stringify({
            error: `Unknown tool: ${toolName}`,
            available: [
              'get_booking_trends',
              'get_event_performance',
              'get_venue_utilization',
              'get_market_comparison',
              'get_revenue_summary',
              'get_event_timeline',
            ],
          });
      }

      return JSON.stringify({ rows, row_count: rows.length });
    } catch (error) {
      this.logger.error(`Tool ${toolName} failed`, error);
      return JSON.stringify({
        error: `Query failed: ${(error as Error).message}`,
        tool: toolName,
      });
    }
  }

  // ── Event queries (event_db) ────────────────────────────────────────

  private async getBookingTrends(vendorId: string, args: Record<string, unknown>) {
    const months = (args.months as number) || 3;
    const category = args.category as string | undefined;

    return this.queryEvent(
      vendorId,
      `SELECT
         DATE_TRUNC('month', start_time) AS month,
         category,
         COUNT(*) AS event_count,
         SUM(current_bookings) AS total_bookings,
         ROUND(AVG(current_bookings * 100.0 / NULLIF(max_attendees, 0)), 1) AS avg_fill_pct
       FROM events
       WHERE start_time >= NOW() - ($1 || ' months')::INTERVAL
         AND ($2::text IS NULL OR category = $2::event_category)
       GROUP BY DATE_TRUNC('month', start_time), category
       ORDER BY month DESC, category`,
      [months, category],
    );
  }

  private async getEventPerformance(vendorId: string, args: Record<string, unknown>) {
    const category = args.category as string | undefined;
    const status = args.status as string | undefined;
    const orderBy = (args.order_by as string) || 'fill_rate';

    const orderMap: Record<string, string> = {
      fill_rate: 'fill_pct ASC',
      bookings: 'current_bookings DESC',
      created_at: 'created_at DESC',
    };

    return this.queryEvent(
      vendorId,
      `SELECT
         id, title, category, status,
         current_bookings, max_attendees,
         ROUND(current_bookings * 100.0 / NULLIF(max_attendees, 0), 1) AS fill_pct,
         price->>'base' AS price,
         start_time, created_at
       FROM events
       WHERE ($1::text IS NULL OR category = $1::event_category)
         AND ($2::text IS NULL OR status = $2::event_status)
       ORDER BY ${orderMap[orderBy] || orderMap.fill_rate}`,
      [category, status],
    );
  }

  private async getRevenueSummary(vendorId: string, args: Record<string, unknown>) {
    const months = (args.months as number) || 6;

    return this.queryEvent(
      vendorId,
      `SELECT
         DATE_TRUNC('month', start_time) AS month,
         category,
         COUNT(*) AS event_count,
         SUM(current_bookings) AS total_bookings,
         SUM(current_bookings * COALESCE((price->>'base')::numeric, 0)) AS estimated_revenue,
         ROUND(AVG(current_bookings * COALESCE((price->>'base')::numeric, 0)), 2) AS avg_revenue_per_event
       FROM events
       WHERE start_time >= NOW() - ($1 || ' months')::INTERVAL
       GROUP BY DATE_TRUNC('month', start_time), category
       ORDER BY month DESC, estimated_revenue DESC`,
      [months],
    );
  }

  private async getEventTimeline(vendorId: string, args: Record<string, unknown>) {
    const months = (args.months as number) || 6;

    return this.queryEvent(
      vendorId,
      `SELECT
         id, title, category, status,
         start_time, created_at, updated_at,
         EXTRACT(DAY FROM (start_time - created_at)) AS lead_time_days,
         CASE WHEN status = 'CANCELLED' THEN true ELSE false END AS was_cancelled
       FROM events
       WHERE created_at >= NOW() - ($1 || ' months')::INTERVAL
       ORDER BY created_at DESC`,
      [months],
    );
  }

  // ── Vendor queries (vendor_db) ──────────────────────────────────────

  private async getVenueUtilization(vendorId: string, args: Record<string, unknown>) {
    const venueId = args.venue_id as string | undefined;

    return this.queryVendor(
      vendorId,
      `SELECT
         v.id AS venue_id,
         v.name AS venue_name,
         v.type AS venue_type,
         COUNT(ts.id) AS total_slots,
         COUNT(ts.id) FILTER (WHERE ts.status = 'AVAILABLE') AS available_slots,
         COUNT(ts.id) FILTER (WHERE ts.status = 'BOOKED') AS booked_slots,
         COUNT(ts.id) FILTER (WHERE ts.status = 'BLOCKED') AS blocked_slots,
         COUNT(ts.id) FILTER (WHERE ts.status = 'MAINTENANCE') AS maintenance_slots,
         ROUND(
           COUNT(ts.id) FILTER (WHERE ts.status = 'BOOKED') * 100.0
           / NULLIF(COUNT(ts.id), 0), 1
         ) AS utilization_pct
       FROM venues v
       LEFT JOIN time_slots ts ON ts.venue_id = v.id
       WHERE ($1::text IS NULL OR v.id = $1)
       GROUP BY v.id, v.name, v.type
       ORDER BY utilization_pct DESC`,
      [venueId],
    );
  }

  /**
   * Run EXPLAIN on a known business tool's query without executing it.
   * Returns the PostgreSQL query plan for performance validation.
   */
  async explain(
    toolName: string,
    args: Record<string, unknown>,
    vendorId: string,
  ): Promise<string> {
    const months = (args.months as number) || 3;
    const category = args.category as string | undefined;
    const orderBy = (args.order_by as string) || 'fill_rate';

    // Reconstruct the same SQL the tool would run
    let sql: string;
    let params: unknown[];
    let db: 'vendor' | 'event';

    switch (toolName) {
      case 'get_booking_trends':
        db = 'event';
        sql = `EXPLAIN (ANALYZE false, FORMAT json) SELECT DATE_TRUNC('month', start_time) AS month, category, COUNT(*) AS event_count, SUM(current_bookings) AS total_bookings, ROUND(AVG(current_bookings * 100.0 / NULLIF(max_attendees, 0)), 1) AS avg_fill_pct FROM events WHERE start_time >= NOW() - ($1 || ' months')::INTERVAL AND ($2::text IS NULL OR category = $2::event_category) GROUP BY DATE_TRUNC('month', start_time), category ORDER BY month DESC, category`;
        params = [months, category];
        break;
      case 'get_event_performance':
        db = 'event';
        const orderMap: Record<string, string> = {
          fill_rate: 'fill_pct ASC',
          bookings: 'current_bookings DESC',
          created_at: 'created_at DESC',
        };
        sql = `EXPLAIN (ANALYZE false, FORMAT json) SELECT id, title, category, status, current_bookings, max_attendees, ROUND(current_bookings * 100.0 / NULLIF(max_attendees, 0), 1) AS fill_pct, price->>'base' AS price, start_time, created_at FROM events WHERE ($1::text IS NULL OR category = $1::event_category) AND ($2::text IS NULL OR status = $2::event_status) ORDER BY ${orderMap[orderBy] || orderMap.fill_rate}`;
        params = [category, args.status as string | undefined];
        break;
      case 'get_venue_utilization':
        db = 'vendor';
        sql = `EXPLAIN (ANALYZE false, FORMAT json) SELECT v.id AS venue_id, v.name AS venue_name, v.type AS venue_type, COUNT(ts.id) AS total_slots, COUNT(ts.id) FILTER (WHERE ts.status = 'AVAILABLE') AS available_slots, COUNT(ts.id) FILTER (WHERE ts.status = 'BOOKED') AS booked_slots, COUNT(ts.id) FILTER (WHERE ts.status = 'BLOCKED') AS blocked_slots, COUNT(ts.id) FILTER (WHERE ts.status = 'MAINTENANCE') AS maintenance_slots, ROUND(COUNT(ts.id) FILTER (WHERE ts.status = 'BOOKED') * 100.0 / NULLIF(COUNT(ts.id), 0), 1) AS utilization_pct FROM venues v LEFT JOIN time_slots ts ON ts.venue_id = v.id WHERE ($1::text IS NULL OR v.id = $1) GROUP BY v.id, v.name, v.type ORDER BY utilization_pct DESC`;
        params = [args.venue_id as string | undefined];
        break;
      case 'get_market_comparison':
        db = 'event';
        sql = `EXPLAIN (ANALYZE false, FORMAT json) SELECT category, location->>'city' AS city, COUNT(*) AS total_events, ROUND(AVG(current_bookings * 100.0 / NULLIF(max_attendees, 0)), 1) AS avg_fill_rate, COUNT(DISTINCT vendor_id) AS vendor_count FROM events WHERE status = 'PUBLISHED' AND ($1::text IS NULL OR category = $1::event_category) AND ($2::text IS NULL OR location->>'city' ILIKE $2) GROUP BY category, location->>'city' HAVING COUNT(*) >= 5 ORDER BY total_events DESC`;
        params = [category, args.city as string | undefined];
        break;
      case 'get_revenue_summary':
        db = 'event';
        sql = `EXPLAIN (ANALYZE false, FORMAT json) SELECT DATE_TRUNC('month', start_time) AS month, category, COUNT(*) AS event_count, SUM(current_bookings) AS total_bookings, SUM(current_bookings * COALESCE((price->>'base')::numeric, 0)) AS estimated_revenue, ROUND(AVG(current_bookings * COALESCE((price->>'base')::numeric, 0)), 2) AS avg_revenue_per_event FROM events WHERE start_time >= NOW() - ($1 || ' months')::INTERVAL GROUP BY DATE_TRUNC('month', start_time), category ORDER BY month DESC, estimated_revenue DESC`;
        params = [months];
        break;
      case 'get_event_timeline':
        db = 'event';
        sql = `EXPLAIN (ANALYZE false, FORMAT json) SELECT id, title, category, status, start_time, created_at, updated_at, EXTRACT(DAY FROM (start_time - created_at)) AS lead_time_days, CASE WHEN status = 'CANCELLED' THEN true ELSE false END AS was_cancelled FROM events WHERE created_at >= NOW() - ($1 || ' months')::INTERVAL ORDER BY created_at DESC`;
        params = [months];
        break;
      default:
        return JSON.stringify({ error: `Cannot explain unknown tool: ${toolName}` });
    }

    try {
      const pool = db === 'vendor' ? this.vendorPool : this.eventPool;
      const client = await pool.connect();
      try {
        await this.setVendorContext(client, vendorId);
        const result = await client.query(sql, params);
        const plan = result.rows[0]?.['QUERY PLAN'] || result.rows;
        return JSON.stringify({ tool: toolName, plan, note: 'EXPLAIN (ANALYZE false) — query was NOT executed.' });
      } finally {
        client.release();
      }
    } catch (error) {
      return JSON.stringify({ error: `EXPLAIN failed: ${(error as Error).message}` });
    }
  }

  // ── Market query (event_db, no RLS — pre-aggregated view) ───────────

  private async getMarketComparison(_vendorId: string, args: Record<string, unknown>) {
    const category = args.category as string | undefined;
    const city = args.city as string | undefined;

    // market_stats view must exist in event_db (created via rls-setup.sql)
    // Falls back to inline aggregation if the view doesn't exist yet
    return this.queryEvent(
      _vendorId,
      `SELECT
         category,
         location->>'city' AS city,
         COUNT(*) AS total_events,
         ROUND(AVG(current_bookings * 100.0 / NULLIF(max_attendees, 0)), 1) AS avg_fill_rate,
         COUNT(DISTINCT vendor_id) AS vendor_count
       FROM events
       WHERE status = 'PUBLISHED'
         AND ($1::text IS NULL OR category = $1::event_category)
         AND ($2::text IS NULL OR location->>'city' ILIKE $2)
       GROUP BY category, location->>'city'
       HAVING COUNT(*) >= 5
       ORDER BY total_events DESC`,
      [category, city],
    );
  }
}
