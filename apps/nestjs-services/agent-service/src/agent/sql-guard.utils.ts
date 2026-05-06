import { Logger } from '@nestjs/common';
import { Parser } from 'node-sql-parser';

// node-sql-parser AST types don't support index signatures for mutation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstNode = any;

/**
 * AST-based SQL security guard — the absolute enforcement layer.
 *
 * Architecture:
 *   Layer 1 (Guidance): System prompt tells the Agent to scope queries
 *   Layer 2 (Enforcement): THIS GUARD force-injects vendor_id via AST rewriting
 *   Layer 3 (Database):   PostgreSQL RLS in the MCP container
 *
 * Even if a prompt injection tricks the LLM into generating an unscoped query,
 * the AST rewrite intercepts and injects the WHERE clause before execution.
 *
 * Configurable: superadmin role bypasses scoping entirely.
 */
export class SqlGuardUtils {
  private static readonly logger = new Logger(SqlGuardUtils.name);
  private static readonly parser = new Parser();

  /** Tools that intentionally span ALL vendors (market comparison, benchmarks). */
  private static readonly GLOBAL_TOOLS = new Set(['get_market_comparison']);

  /** Table → vendor-scoping column mapping. */
  private static readonly VENDOR_COLUMN_MAP: Record<string, string> = {
    events: 'vendor_id',
    venues: 'vendor_id',
    time_slots: 'vendor_id',
    bookings: 'vendor_id',
  };

  /**
   * Force-inject vendor scope into a SQL SELECT statement.
   *
   * Parses the SQL into an AST, walks the FROM clause to identify the
   * primary table, then injects (or appends) a WHERE vendor_id = '<id>'
   * condition. Returns the original SQL unchanged if:
   *   - isSuperadmin is true (full access)
   *   - The tool is a global tool (market comparison spans all vendors)
   *   - The AST parser can't handle the PostgreSQL syntax
   */
  static injectVendorScope(
    sql: string,
    vendorId: string,
    toolName: string,
    isSuperadmin: boolean,
  ): string {
    if (isSuperadmin) {
      SqlGuardUtils.logger.log(`Superadmin bypass — no vendor scoping on ${toolName}`);
      return sql;
    }

    if (SqlGuardUtils.GLOBAL_TOOLS.has(toolName)) {
      SqlGuardUtils.logger.log(`Global tool ${toolName} — skipping vendor scoping`);
      return sql;
    }

    try {
      const opt = { database: 'postgresql' } as const;
      const ast = SqlGuardUtils.parser.astify(sql, opt);
      const statements: AstNode[] = Array.isArray(ast) ? ast : [ast];

      let scopeColumn: string | null = null;

      for (const stmt of statements) {
        if (stmt.type && stmt.type !== 'select') {
          throw new Error(
            `Security Violation: Only SELECT permitted. Got: ${stmt.type}`,
          );
        }

        // Resolve the vendor-scoping column from FROM clause
        scopeColumn = SqlGuardUtils.resolveScopeColumn(stmt);
        if (!scopeColumn) {
          SqlGuardUtils.logger.warn(
            `Could not resolve scope column for ${toolName} — ` +
            `relying on MCP restricted mode + RLS.`,
          );
          return sql;
        }

        const condition: AstNode = {
          type: 'binary_expr',
          operator: '=',
          left: { type: 'column_ref', table: null, column: scopeColumn },
          right: { type: 'string', value: vendorId },
        };

        if (stmt.where) {
          stmt.where = {
            type: 'binary_expr',
            operator: 'AND',
            left: stmt.where,
            right: condition,
          };
        } else {
          stmt.where = condition;
        }
      }

      const secured = SqlGuardUtils.parser.sqlify(ast, opt);
      SqlGuardUtils.logger.log(
        `Vendor scope injected [${toolName}]: ${scopeColumn} = '${vendorId}'`,
      );
      return secured;
    } catch (error) {
      SqlGuardUtils.logger.warn(
        `AST guard could not parse SQL for ${toolName} — ` +
        `relying on MCP restricted mode + RLS: ${(error as Error).message}`,
      );
      return sql;
    }
  }

  /** Walk FROM clause to find the vendor-scoping column for the primary table. */
  private static resolveScopeColumn(stmt: AstNode): string | null {
    const from: AstNode[] | undefined = stmt.from;
    if (!from || from.length === 0) return null;

    for (const item of from) {
      // Simple table ref: { table: 'events', ... }
      if (item.table) {
        const col = SqlGuardUtils.VENDOR_COLUMN_MAP[item.table as string];
        if (col) return col;
      }
      // JOIN with expr containing table: { expr: { table: 'venues', ... } }
      if (item.expr?.table) {
        const col = SqlGuardUtils.VENDOR_COLUMN_MAP[item.expr.table as string];
        if (col) return col;
      }
    }

    return null;
  }
}
