"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { type Client, type Target, type TargetCreate } from "@/lib/api";
import { useApi } from "@/lib/api-browser";

const NUMERIC_FIELDS = [
  "revenue",
  "materials",
  "subcontractors",
  "wages",
  "gross_profit",
  "overheads",
  "net_profit",
  "rev_per_worker",
] as const;

type NumericField = (typeof NUMERIC_FIELDS)[number];

const FIELD_LABELS: Record<NumericField, string> = {
  revenue: "Revenue",
  materials: "Materials",
  subcontractors: "Subcontractors",
  wages: "Wages",
  gross_profit: "Gross profit",
  overheads: "Overheads",
  net_profit: "Net profit",
  rev_per_worker: "Rev / worker",
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPeriod(t: Target) {
  return `${t.period_start} → ${t.period_end ?? "open"}`;
}

/**
 * A "standing" target is the one with no end date — it's the currently
 * active monthly target. Any target with a period_end has been closed
 * (replaced by a newer one) and lives in History only.
 */
function isStanding(t: Target) {
  return t.period_end === null || t.period_end === undefined;
}

function emptyForm(): Record<NumericField, number> {
  return {
    revenue: 0,
    materials: 0,
    subcontractors: 0,
    wages: 0,
    gross_profit: 0,
    overheads: 0,
    net_profit: 0,
    rev_per_worker: 0,
  };
}

export default function TargetsPage() {
  const params = useParams<{ id: string }>();
  const api = useApi();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<NumericField, number>>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([api.getClient(clientId), api.listTargets(clientId)])
      .then(([c, t]) => {
        setClient(c);
        setTargets(t);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [clientId]);

  const standing = targets.find(isStanding) ?? null;
  const history = targets.filter((t) => !isStanding(t));

  function startEdit() {
    setMsg(null);
    setEditing(true);
    if (standing) {
      setForm({
        revenue: standing.revenue,
        materials: standing.materials,
        subcontractors: standing.subcontractors,
        wages: standing.wages,
        gross_profit: standing.gross_profit,
        overheads: standing.overheads,
        net_profit: standing.net_profit,
        rev_per_worker: standing.rev_per_worker,
      });
    } else {
      setForm(emptyForm());
    }
  }

  function cancelEdit() {
    setEditing(false);
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      // Always POST a new standing target — backend auto-closes the
      // previous open one. We never PATCH a standing target in this
      // UI; the user "rolling forward" semantically means a new entry.
      const payload: TargetCreate = { ...form };
      const created = await api.createTarget(clientId, payload);
      // Refresh the full list so the freshly-closed previous standing
      // target shows up in History with its new period_end.
      const next = await api.listTargets(clientId);
      setTargets(next);
      setMsg({ kind: "ok", text: "Monthly target updated." });
      setEditing(false);
      void created;
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteHistorical(t: Target) {
    if (!confirm(`Delete the historical target for ${fmtPeriod(t)}? This won't affect the current standing target.`)) return;
    setMsg(null);
    try {
      await api.deleteTarget(clientId, t.id);
      setTargets((ts) => ts.filter((x) => x.id !== t.id));
      setMsg({ kind: "ok", text: "Historical target deleted." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-paper-warm p-8">
        <p className="text-ink-soft">Loading…</p>
      </main>
    );
  }

  if (error || !client) {
    return (
      <main className="min-h-screen bg-paper-warm p-8">
        <div className="mx-auto max-w-3xl">
          <Link href={`/clients/${clientId}`} className="text-sm text-ink-soft hover:text-ink">
            ← Back to client
          </Link>
          <div className="mt-4 rounded-md bg-brand-red/10 p-4 text-sm text-brand-red">
            {error ?? "Client not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper-warm p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Targets — {client.business_name}</h1>
            <p className="text-sm text-muted">
              One standing monthly target. The financial scorecard compares
              every month's actuals against this target — no need to set
              targets per month.
            </p>
          </div>
          <Link
            href={`/clients/${clientId}`}
            className="text-sm text-ink-soft hover:text-ink"
          >
            ← Back to client
          </Link>
        </div>

        {msg && (
          <div
            className={`mb-4 rounded-md p-3 text-sm ${
              msg.kind === "ok" ? "bg-brand-green/10 text-brand-green" : "bg-brand-red/10 text-brand-red"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Current standing target */}
        <div className="rounded-lg border border-rule bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Current monthly target
            </h2>
            {!editing && (
              <button
                onClick={startEdit}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-deep"
              >
                {standing ? "Update target" : "Set target"}
              </button>
            )}
          </div>

          {!editing && !standing && (
            <p className="text-sm text-muted italic">
              No standing target set. Click <strong>Set target</strong> to
              create one — the scorecard report can't run without it.
            </p>
          )}

          {!editing && standing && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              {NUMERIC_FIELDS.map((field) => (
                <div key={field}>
                  <dt className="text-xs uppercase tracking-wide text-muted">
                    {FIELD_LABELS[field]}
                  </dt>
                  <dd className="mt-0.5 font-medium text-ink">
                    {fmtMoney(standing[field])}
                  </dd>
                </div>
              ))}
              <div className="col-span-2 md:col-span-4 mt-1 text-xs text-muted">
                Active since {standing.period_start}.
              </div>
            </dl>
          )}

          {editing && (
            <form onSubmit={onSubmit} className="space-y-6">
              <p className="text-xs text-muted">
                Updating the target closes the current one as of yesterday
                and starts a new one today. The previous values are kept in
                History below.
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {NUMERIC_FIELDS.map((field) => (
                  <Field key={field} label={`${FIELD_LABELS[field]} (AUD)`}>
                    <input
                      type="number"
                      step="0.01"
                      value={form[field]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [field]: Number(e.target.value) }))
                      }
                      className={inputCls}
                    />
                  </Field>
                ))}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-rule pt-6">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md border border-rule bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-warm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save target"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-lg border border-rule bg-white shadow-sm">
            <div className="border-b border-rule px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                History
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Previous standing targets, closed when a newer one replaced
                them. Kept for reference.
              </p>
            </div>
            <table className="min-w-full divide-y divide-rule text-sm">
              <thead className="bg-paper-warm text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">GP</th>
                  <th className="px-4 py-2 text-right">Net profit</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-cool">
                {history.map((t) => (
                  <tr key={t.id} className="hover:bg-paper-warm">
                    <td className="px-4 py-3 font-medium text-ink">{fmtPeriod(t)}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">{fmtMoney(t.revenue)}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">{fmtMoney(t.gross_profit)}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">{fmtMoney(t.net_profit)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDeleteHistorical(t)}
                        className="text-sm font-medium text-brand-red hover:text-brand-red"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-md border border-rule px-3 py-2 text-sm focus:border-muted focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
