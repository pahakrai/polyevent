'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  startInvestigation,
  continueInvestigation,
  redirectInvestigation,
  type InvestigationSession,
  type InvestigationStep,
} from '@/lib/agent-api';

type UiState =
  | { phase: 'idle' }
  | { phase: 'loading_vendor' }
  | { phase: 'ready'; vendorId: string; vendorName: string }
  | { phase: 'investigating'; session: InvestigationSession; redirectInput: string }
  | { phase: 'error'; message: string };

const EXAMPLE_QUESTIONS = [
  'Why are my bookings down this month?',
  'How do my jazz events compare to the market?',
  'Which of my venues has the lowest utilization?',
  'What is my revenue trend over the last 6 months?',
  'Are my time slots priced competitively?',
];

export default function InsightsPage() {
  const [state, setState] = useState<UiState>({ phase: 'loading_vendor' });
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const autoGoalRef = useRef<string | null>(null);

  // Load vendor profile on mount
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return setState({ phase: 'error', message: 'Not authenticated.' });
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.sub;
        const { data: vendor } = await api.get(`/vendors/user/${userId}`);
        if (!vendor?.id) return setState({ phase: 'error', message: 'Vendor profile not found. Complete onboarding first.' });
        setState({ phase: 'ready', vendorId: vendor.id, vendorName: vendor.businessName });
      } catch {
        setState({ phase: 'error', message: 'Could not load vendor profile.' });
      }
    })();
  }, []);

  // Read goal from URL query param for one-click reports from dashboard
  useEffect(() => {
    const goalParam = searchParams.get('goal');
    if (goalParam && !autoGoalRef.current) {
      autoGoalRef.current = goalParam;
      setGoal(goalParam);
    }
  }, [searchParams]);

  // Auto-start investigation when goal param is present and vendor is ready
  useEffect(() => {
    if (autoGoalRef.current && state.phase === 'ready' && !loading) {
      const goalText = autoGoalRef.current;
      autoGoalRef.current = null;
      setLoading(true);
      (async () => {
        try {
          const session = await startInvestigation(goalText, (state as any).vendorId);
          setState({ phase: 'investigating', session, redirectInput: '' });
        } catch (err: any) {
          setState({ phase: 'error', message: err?.message || 'Failed to start investigation.' });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [state.phase, loading]);

  // Auto-scroll to latest step
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.phase === 'investigating' ? (state as any).session?.steps?.length : 0]);

  const handleStart = async () => {
    if (!goal.trim() || state.phase !== 'ready') return;
    setLoading(true);
    try {
      const session = await startInvestigation(goal.trim(), (state as any).vendorId);
      setState({ phase: 'investigating', session, redirectInput: '' });
    } catch (err: any) {
      setState({ phase: 'error', message: err?.message || 'Failed to start investigation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (state.phase !== 'investigating') return;
    setLoading(true);
    try {
      const session = await continueInvestigation(state.session.sessionId);
      setState({ phase: 'investigating', session, redirectInput: state.redirectInput });
    } catch (err: any) {
      setState({ phase: 'error', message: err?.message || 'Investigation step failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRedirect = async () => {
    if (state.phase !== 'investigating' || !state.redirectInput.trim()) return;
    setLoading(true);
    try {
      const session = await redirectInvestigation(state.session.sessionId, state.redirectInput.trim());
      setState({ phase: 'investigating', session, redirectInput: '' });
    } catch (err: any) {
      setState({ phase: 'error', message: err?.message || 'Redirect failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setState((prev) =>
      prev.phase === 'ready' || prev.phase === 'investigating'
        ? { phase: 'ready', vendorId: (prev as any).vendorId, vendorName: (prev as any).vendorName }
        : prev,
    );
    setGoal('');
  };

  // ── Render ──────────────────────────────────────────────────────────

  if (state.phase === 'loading_vendor') {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">{state.message}</p>
        <a href="/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to Dashboard
        </a>
      </div>
    );
  }

  // ── Ready: show prompt input ────────────────────────────────────────

  if (state.phase === 'ready' || state.phase === 'idle') {
    const vendorName = state.phase === 'ready' ? state.vendorName : '';
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-2 text-2xl font-bold">Business Insights</h2>
        <p className="mb-8 text-sm text-muted-foreground">
          {vendorName ? `Ask anything about ${vendorName}'s performance. ` : ''}
          The agent investigates your data step by step and gives you a report with root cause analysis.
        </p>

        <div className="rounded-lg border bg-card p-6">
          <label htmlFor="goal" className="mb-2 block text-sm font-medium">
            What do you want to know?
          </label>
          <textarea
            id="goal"
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            placeholder="E.g. Why are my bookings down this month?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleStart();
              }
            }}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => setGoal(q)}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>

          <button
            onClick={handleStart}
            disabled={!goal.trim() || loading}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Investigate'}
          </button>
        </div>
      </div>
    );
  }

  // ── Investigating: show steps + controls ────────────────────────────

  if (state.phase === 'investigating') {
    const { session, redirectInput } = state;
    const isComplete = session.status === 'completed';
    const isWaiting = session.status === 'waiting_confirmation';
    const hasError = session.status === 'error';

    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Investigation</h2>
            <p className="text-xs text-muted-foreground">{session.steps.length} steps so far</p>
          </div>
          <button
            onClick={handleReset}
            className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            New Question
          </button>
        </div>

        {/* Goal summary */}
        <div className="mb-6 rounded-lg border bg-muted/30 p-3 text-sm">
          <span className="font-medium">Goal:</span> {session.steps.length > 0 ? '' : goal}
        </div>

        {/* Steps */}
        <div ref={scrollRef} className="mb-6 max-h-[60vh] space-y-3 overflow-y-auto pr-2">
          {session.steps.map((step) => (
            <StepCard key={step.id} step={step} />
          ))}

          {loading && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Agent is reasoning...</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {hasError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Investigation error: {session.error || 'Unknown error'}
            </div>
          )}

          {isComplete && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <p className="font-medium text-green-800">Investigation complete</p>
              <button
                onClick={handleReset}
                className="mt-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
              >
                Ask Another Question
              </button>
            </div>
          )}

          {isWaiting && !loading && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleContinue}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Continue Investigation
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                  placeholder="Or redirect: e.g. compare against last quarter instead..."
                  value={redirectInput}
                  onChange={(e) =>
                    setState({ ...state, redirectInput: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRedirect();
                  }}
                />
                <button
                  onClick={handleRedirect}
                  disabled={!redirectInput.trim()}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Redirect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ── Step Card Component ──────────────────────────────────────────────

function StepCard({ step }: { step: InvestigationStep }) {
  const { type, content, toolName, toolArgs, toolResult, stepNumber } = step;

  switch (type) {
    case 'reasoning':
      return (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {stepNumber}
            </span>
            <span className="text-xs font-medium text-muted-foreground">Agent Reasoning</span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      );

    case 'tool_call':
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
              {stepNumber}
            </span>
            <span className="text-xs font-medium text-blue-700">Querying Data</span>
          </div>
          <p className="text-sm font-medium text-blue-800">{toolName}</p>
          {toolArgs && (
            <pre className="mt-1 text-xs text-blue-600">
              {JSON.stringify(toolArgs, null, 2)}
            </pre>
          )}
        </div>
      );

    case 'tool_result':
      let preview = '';
      let rowCount: number | null = null;
      try {
        const parsed = JSON.parse(toolResult || '{}');
        preview = JSON.stringify(parsed.rows?.slice(0, 3) || parsed, null, 2);
        rowCount = parsed.row_count ?? null;
      } catch {
        preview = (toolResult || '').slice(0, 300);
      }

      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-700">
              {stepNumber}
            </span>
            <span className="text-xs font-medium text-green-700">
              Query Result{rowCount !== null ? ` (${rowCount} rows)` : ''}
            </span>
          </div>
          <pre className="max-h-32 overflow-y-auto text-xs text-green-800">{preview}</pre>
        </div>
      );

    case 'redirected':
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <span className="font-medium">Redirection:</span> {content}
          </p>
        </div>
      );

    case 'final_report':
      return (
        <div className="rounded-lg border-2 border-primary/20 bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              ✓
            </span>
            <span className="text-sm font-semibold">Final Report</span>
          </div>
          <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>
      );

    case 'waiting':
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">{content}</p>
        </div>
      );

    default:
      return null;
  }
}
