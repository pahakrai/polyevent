/**
 * Tool definitions — the "Calculator" layer.
 *
 * Architecture:
 *   Agent (LLM) reads Skills (text in system prompt) → calls these Tools → NestJS executes
 *
 * Skills are the "Textbook" (business rules as static text).
 * Tools are the "Calculator" (execution tools the Agent invokes).
 * They never talk to each other — the Agent is always the middleman.
 *
 * ReAct workflow the Agent follows:
 *   1. Read business skills from system prompt (churn/retention/revenue definitions)
 *   2. Introspect schema — list_tables, describe_table
 *   3. Validate — explain_tool before heavy queries
 *   4. Analyze — run pre-built parameterized business queries
 *   5. Report — synthesize findings into final report (LLM, no tool)
 */

// ── Tool definition type ──────────────────────────────────────────────

export type ToolCategory = 'introspection' | 'validation' | 'analysis' | 'reporting';

export interface SkillToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  category: ToolCategory;
  safeAutoExecute: boolean;
}

// ── Introspection tools — discover schema ─────────────────────────────

export const INTROSPECTION_TOOLS: SkillToolDefinition[] = [
  {
    name: 'list_tables',
    description:
      'List all tables and views available for investigation. ' +
      'Use this FIRST before querying anything to understand what data is available. ' +
      'Returns table names, types (table/view), and row count estimates.',
    input_schema: {
      type: 'object',
      properties: {
        schema: {
          type: 'string',
          description: 'Database schema to list (default: public)',
        },
      },
    },
    category: 'introspection',
    safeAutoExecute: true,
  },
  {
    name: 'describe_table',
    description:
      'Describe the columns, types, and constraints of a specific table. ' +
      'Use this BEFORE querying a table to verify column names and data types exist. ' +
      'Prevents "column not found" errors.',
    input_schema: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'Name of the table to describe (e.g. events, venues, time_slots)',
        },
        schema: {
          type: 'string',
          description: 'Database schema (default: public)',
        },
      },
      required: ['table_name'],
    },
    category: 'introspection',
    safeAutoExecute: true,
  },
];

// ── Validation tools — check before executing ──────────────────────────

export const VALIDATION_TOOLS: SkillToolDefinition[] = [
  {
    name: 'explain_tool',
    description:
      'Show the PostgreSQL query plan for a business analysis tool WITHOUT executing it. ' +
      'Use this to verify a query will be performant before running it. ' +
      'Takes a tool name + arguments and returns the EXPLAIN plan.',
    input_schema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'Business tool to explain: get_booking_trends, get_event_performance, get_venue_utilization, get_market_comparison, get_revenue_summary, get_event_timeline',
        },
        tool_args: {
          type: 'object',
          description: 'Arguments to pass to the tool being explained (same as the tool takes)',
        },
      },
      required: ['tool_name'],
    },
    category: 'validation',
    safeAutoExecute: true,
  },
];

// ── Business Analyst tools — pre-built parameterized queries ───────────

export const BUSINESS_ANALYST_TOOLS: SkillToolDefinition[] = [
  {
    name: 'get_booking_trends',
    description:
      'Get monthly booking counts for the current vendor, broken down by event category. ' +
      'Use this first when investigating booking declines. Shows the trend so you can spot ' +
      'which categories and which months changed.',
    input_schema: {
      type: 'object',
      properties: {
        months: {
          type: 'number',
          description: 'Number of past months to include (default: 3)',
        },
        category: {
          type: 'string',
          description: 'Optional: filter to a specific category (MUSIC, ART, SPORTS, ACTIVITIES, OTHER)',
        },
      },
    },
    category: 'analysis',
    safeAutoExecute: true,
  },
  {
    name: 'get_event_performance',
    description:
      'Get detailed performance for all events belonging to this vendor. ' +
      'Shows fill rate, booking count, capacity, price, and status for each event. ' +
      'Use this to identify which specific events are underperforming or overperforming.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional: filter by category',
        },
        status: {
          type: 'string',
          description: 'Optional: filter by status (PUBLISHED, COMPLETED, CANCELLED, DRAFT, POSTPONED)',
        },
        order_by: {
          type: 'string',
          description: 'Sort by: fill_rate, bookings, created_at (default: fill_rate ascending)',
        },
      },
    },
    category: 'analysis',
    safeAutoExecute: true,
  },
  {
    name: 'get_venue_utilization',
    description:
      'Get time slot utilization for this vendor\'s venues. Shows how many time slots ' +
      'are available, booked, blocked, or under maintenance. Use this when investigating ' +
      'supply-side issues — a drop in bookings might be because time slots became unavailable.',
    input_schema: {
      type: 'object',
      properties: {
        venue_id: {
          type: 'string',
          description: 'Optional: filter to a specific venue',
        },
      },
    },
    category: 'analysis',
    safeAutoExecute: true,
  },
  {
    name: 'get_market_comparison',
    description:
      'Get anonymized market averages for comparison. Returns aggregate statistics ' +
      '(avg fill rate, median rating, event count) grouped by category and city. ' +
      'No individual vendor data is exposed. Use this to compare the vendor\'s ' +
      'performance against the broader market.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional: compare within a specific category',
        },
        city: {
          type: 'string',
          description: 'Optional: compare within a specific city',
        },
      },
    },
    category: 'analysis',
    safeAutoExecute: true,
  },
  {
    name: 'get_revenue_summary',
    description:
      'Get revenue summary for this vendor. Shows total revenue, average per event, ' +
      'and breakdown by category for the specified time period.',
    input_schema: {
      type: 'object',
      properties: {
        months: {
          type: 'number',
          description: 'Number of past months to include (default: 6)',
        },
      },
    },
    category: 'analysis',
    safeAutoExecute: true,
  },
  {
    name: 'get_event_timeline',
    description:
      'Get a timeline of events created by this vendor, showing status progression ' +
      'and when events were published, completed, or cancelled. Use this to spot ' +
      'gaps in the event calendar or clusters of cancellations.',
    input_schema: {
      type: 'object',
      properties: {
        months: {
          type: 'number',
          description: 'Number of past months to include (default: 6)',
        },
      },
    },
    category: 'analysis',
    safeAutoExecute: true,
  },
];

// ── Combined — all tools the Agent can call ────────────────────────────

export const ALL_TOOLS: SkillToolDefinition[] = [
  ...INTROSPECTION_TOOLS,
  ...VALIDATION_TOOLS,
  ...BUSINESS_ANALYST_TOOLS,
];

// ── LLM-compatible flat tool list ──────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

function toLlmTool(t: SkillToolDefinition): ToolDefinition {
  return {
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  };
}

export const VENDOR_INVESTIGATION_TOOLS: ToolDefinition[] = ALL_TOOLS.map(toLlmTool);
