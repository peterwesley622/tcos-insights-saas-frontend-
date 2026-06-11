"use client";

import { useEffect, useState } from "react";
import { type Prospect } from "@/lib/api";
import { useApi } from "@/lib/api-browser";

/**
 * Admin "Prospects" list — Peter's self-serve review intake pipeline.
 *
 * Lifecycle visible here:
 *   1. Click "Generate intake link" → a new Prospect row is created with
 *      a fresh unguessable intake_token, status=pending_intake.
 *   2. Admin copies the link from the table and pastes it into GHL emails
 *      (or wherever the funnel sends it).
 *   3. As the prospect fills the form and connects systems, the status
 *      column updates: pending_intake → connecting → analysing →
 *      delivered.
 *   4. Once delivered, the analysis_url column links to the finished pack
 *      in Drive.
 */
export default function ProspectsPage() {
  const api = useApi();
  const [rows, setRows] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Public intake URLs live on the frontend domain at /review/{token}.
  // We compute them client-side so the table can show clickable links
  // without round-tripping through the backend.
  const reviewBase =
    typeof window !== "undefined" ? `${window.location.origin}/review/` : "/review/";

  async function load() {
    setLoading(true);
    try {
      const list = await api.listProspects();
      setRows(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    setCreating(true);
    setMsg(null);
    try {
      const created = await api.createProspect({
        notes: notes.trim() || undefined,
      });
      setNotes("");
      setRows((prev) => [created, ...prev]);
      // Auto-copy the new link so the next click pastes into GHL.
      try {
        await navigator.clipboard.writeText(`${reviewBase}${created.intake_token}`);
        setCopiedToken(created.intake_token);
        setMsg({ kind: "ok", text: "Intake link generated and copied to clipboard." });
      } catch {
        setMsg({ kind: "ok", text: "Intake link generated — copy it from the table below." });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCreating(false);
    }
  }

  async function onCopy(token: string) {
    try {
      await navigator.clipboard.writeText(`${reviewBase}${token}`);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 2500);
    } catch (e) {
      setMsg({ kind: "err", text: `Couldn't copy: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  async function onPurge(p: Prospect) {
    const label = p.business_name || p.contact_email || `prospect ${p.id}`;
    if (!confirm(`Permanently delete ${label}? This removes the intake row and any captured OAuth tokens.`)) {
      return;
    }
    try {
      await api.purgeProspect(p.id);
      setRows((prev) => prev.filter((r) => r.id !== p.id));
      setMsg({ kind: "ok", text: "Prospect deleted." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    }
  }

  if (loading && rows.length === 0) {
    return (
      <main className="min-h-screen bg-paper-warm p-8">
        <p className="text-ink-soft">Loading prospects…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper-warm p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="eyebrow mb-2">PROSPECTS</p>
          <h1 className="text-2xl font-bold text-ink">Self-serve reviews</h1>
          <p className="mt-1 text-sm text-muted">
            Generate an intake link, paste it into a GHL email, and the
            prospect connects their own Simpro + Xero. The finished
            review pack lands in your Drive for review before you send
            it to them.
          </p>
        </header>

        {/* New-prospect bar */}
        <section className="mb-6 rounded-lg border border-rule bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink-soft">
                Internal note (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. lead from GHL — All Clear Electrical, call Wed 4pm"
                className="mt-1 w-full rounded-md border border-rule px-3 py-2 text-sm focus:border-muted focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted">
                Not shown to the prospect — just a label to help you
                remember who this link was generated for.
              </p>
            </div>
            <button
              onClick={onCreate}
              disabled={creating}
              className="btn-accent shrink-0"
            >
              {creating ? "Creating…" : "Generate intake link"}
            </button>
          </div>
          {msg && (
            <div
              className={`mt-4 rounded-md p-3 text-sm ${
                msg.kind === "ok"
                  ? "bg-brand-green/10 text-brand-green"
                  : "bg-brand-red/10 text-brand-red"
              }`}
            >
              {msg.text}
            </div>
          )}
        </section>

        {error && (
          <div className="mb-4 rounded-md bg-brand-red/10 p-3 text-sm text-brand-red">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-rule bg-white shadow-sm">
          <table className="min-w-full divide-y divide-rule text-sm">
            <thead className="bg-paper-warm text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Prospect</th>
                <th className="px-4 py-3">Intake link</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/60">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No prospects yet. Click <strong>Generate intake link</strong>{" "}
                    above to create the first one.
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-paper-warm/60">
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1.5">
                      <ProspectStatusBadge status={p.status} />
                      <ConnectionChips
                        simpro={p.simpro_connected}
                        xero={p.xero_connected}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-ink">
                      {p.business_name || (
                        <span className="italic text-muted">Awaiting intake</span>
                      )}
                    </div>
                    {p.contact_email && (
                      <div className="text-xs text-muted">{p.contact_email}</div>
                    )}
                    {p.notes && (
                      <div className="mt-1 text-xs italic text-muted">
                        Note: {p.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <code className="truncate rounded bg-paper-cool px-2 py-1 text-xs text-ink-soft" style={{ maxWidth: 280 }}>
                        {reviewBase}{p.intake_token.slice(0, 8)}…
                      </code>
                      <button
                        type="button"
                        onClick={() => onCopy(p.intake_token)}
                        className="rounded-md border border-rule bg-white px-2 py-1 text-xs font-medium text-ink-soft hover:bg-paper-warm"
                      >
                        {copiedToken === p.intake_token ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-ink-soft">
                    {p.created_at ? fmtDate(p.created_at) : "—"}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <button
                      type="button"
                      onClick={() => onPurge(p)}
                      className="text-xs font-medium text-brand-red hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="mt-4 text-xs text-muted">
          v1 stops at intake + system-connection. Report extraction and
          Claude analysis are stubbed until the report list and analysis
          skill are finalised.
        </p>
      </div>
    </main>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProspectStatusBadge({ status }: { status: string }) {
  // Broad lifecycle stage. The granular Simpro/Xero connection state
  // is shown beneath this by <ConnectionChips/> — the badge here is
  // intentionally coarse so Peter can scan the column at a glance.
  const palette: Record<string, { bg: string; text: string; label: string }> = {
    pending_intake: { bg: "bg-paper-cool", text: "text-ink-soft", label: "Awaiting intake" },
    intake_completed: { bg: "bg-accent-soft", text: "text-accent-deep", label: "Connecting systems" },
    connecting: { bg: "bg-accent-soft", text: "text-accent-deep", label: "Connecting systems" },
    ready_for_analysis: { bg: "bg-brand-green/10", text: "text-brand-green", label: "Ready for review" },
    analysing: { bg: "bg-brand-amber/15", text: "text-brand-amber", label: "Analysing" },
    delivered: { bg: "bg-brand-green/10", text: "text-brand-green", label: "Delivered" },
    failed: { bg: "bg-brand-red/10", text: "text-brand-red", label: "Failed" },
  };
  const entry = palette[status] ?? {
    bg: "bg-paper-cool",
    text: "text-ink-soft",
    label: status,
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${entry.bg} ${entry.text}`}
    >
      {entry.label}
    </span>
  );
}

function ConnectionChips({ simpro, xero }: { simpro: boolean; xero: boolean }) {
  // Inline at-a-glance "did they connect both systems yet" indicator.
  // Tick = green when connected, hollow rule chip when not. Lets Peter
  // see WHY a prospect is stuck in "Connecting systems" without having
  // to open the row.
  return (
    <div className="flex gap-1">
      <ConnectionChip label="Simpro" connected={simpro} />
      <ConnectionChip label="Xero" connected={xero} />
    </div>
  );
}

function ConnectionChip({ label, connected }: { label: string; connected: boolean }) {
  const cls = connected
    ? "border-brand-green/40 bg-brand-green/10 text-brand-green"
    : "border-rule bg-white text-muted";
  const glyph = connected ? "✓" : "○";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      <span aria-hidden="true">{glyph}</span>
      {label}
    </span>
  );
}
