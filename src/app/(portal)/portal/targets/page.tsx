"use client";

import { useEffect, useState } from "react";
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

export default function PortalTargetsPage() {
  const api = useApi();

  const [client, setClient] = useState<Client | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<NumericField, number>>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // /api/clients is filtered to just-this-client by the backend's
    // authz layer when the caller has role="client", so list[0] is "me".
    api
      .listClients()
      .then(async (list) => {
        const me = list[0] ?? null;
        setClient(me);
        if (me) {
          const t = await api.listTargets(me.id);
          setTargets(t);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api]);

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
    if (!client) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: TargetCreate = { ...form };
      await api.createTarget(client.id, payload);
      const next = await api.listTargets(client.id);
      setTargets(next);
      setMsg({ kind: "ok", text: "Monthly target updated." });
      setEditing(false);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (error || !client) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl">
          <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error ?? "Couldn't load your client record."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Your monthly targets</h1>
          <p className="text-sm text-slate-500">
            Set one standing monthly target. Your weekly scorecard report
            compares every month's actuals to it and colour-codes each
            metric green / amber / red.
          </p>
        </header>

        {msg && (
          <div
            className={`mb-4 rounded-md p-3 text-sm ${
              msg.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Current standing target */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Current monthly target
            </h2>
            {!editing && (
              <button
                onClick={startEdit}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                {standing ? "Update target" : "Set target"}
              </button>
            )}
          </div>

          {!editing && !standing && (
            <p className="text-sm text-slate-500 italic">
              No standing target set yet. Click <strong>Set target</strong> to
              create one — your scorecard report can't run without it.
            </p>
          )}

          {!editing && standing && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              {NUMERIC_FIELDS.map((field) => (
                <div key={field}>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    {FIELD_LABELS[field]}
                  </dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {fmtMoney(standing[field])}
                  </dd>
                </div>
              ))}
              <div className="col-span-2 md:col-span-4 mt-1 text-xs text-slate-500">
                Active since {standing.period_start}.
              </div>
            </dl>
          )}

          {editing && (
            <form onSubmit={onSubmit} className="space-y-6">
              <p className="text-xs text-slate-500">
                Saving these numbers closes your previous target and starts
                a new one today. Past targets stay in History for reference.
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
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save target"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                History
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Previous targets, closed when a newer one replaced them.
              </p>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">GP</th>
                  <th className="px-4 py-2 text-right">Net profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{fmtPeriod(t)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(t.revenue)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(t.gross_profit)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(t.net_profit)}</td>
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
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
