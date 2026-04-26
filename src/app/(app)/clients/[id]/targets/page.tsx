"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Client, type Target, type TargetCreate } from "@/lib/api";

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

function defaultPeriod() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    period_start: first.toISOString().slice(0, 10),
    period_end: last.toISOString().slice(0, 10),
  };
}

function fmtPeriod(target: Target) {
  return `${target.period_start} → ${target.period_end ?? "open"}`;
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function TargetsPage() {
  const params = useParams<{ id: string }>();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<TargetCreate>(() => ({
    ...defaultPeriod(),
    revenue: 0,
    materials: 0,
    subcontractors: 0,
    wages: 0,
    gross_profit: 0,
    overheads: 0,
    net_profit: 0,
    rev_per_worker: 0,
  }));
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

  function startNew() {
    setEditingId("new");
    setMsg(null);
    setForm({
      ...defaultPeriod(),
      revenue: 0,
      materials: 0,
      subcontractors: 0,
      wages: 0,
      gross_profit: 0,
      overheads: 0,
      net_profit: 0,
      rev_per_worker: 0,
    });
  }

  function startEdit(t: Target) {
    setEditingId(t.id);
    setMsg(null);
    setForm({
      period_start: t.period_start,
      period_end: t.period_end ?? "",
      revenue: t.revenue,
      materials: t.materials,
      subcontractors: t.subcontractors,
      wages: t.wages,
      gross_profit: t.gross_profit,
      overheads: t.overheads,
      net_profit: t.net_profit,
      rev_per_worker: t.rev_per_worker,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const payload: TargetCreate = {
        ...form,
        period_end: form.period_end || null,
      };
      if (editingId === "new") {
        const created = await api.createTarget(clientId, payload);
        setTargets((ts) => [...ts, created]);
        setMsg({ kind: "ok", text: "Target added." });
      } else if (typeof editingId === "number") {
        const updated = await api.updateTarget(clientId, editingId, payload);
        setTargets((ts) => ts.map((t) => (t.id === updated.id ? updated : t)));
        setMsg({ kind: "ok", text: "Target updated." });
      }
      setEditingId(null);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(t: Target) {
    if (!confirm(`Delete target for ${fmtPeriod(t)}?`)) return;
    setMsg(null);
    try {
      await api.deleteTarget(clientId, t.id);
      setTargets((ts) => ts.filter((x) => x.id !== t.id));
      setMsg({ kind: "ok", text: "Target deleted." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
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
          <Link href={`/clients/${clientId}`} className="text-sm text-slate-600 hover:text-slate-900">
            ← Back to client
          </Link>
          <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error ?? "Client not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Targets — {client.business_name}</h1>
            <p className="text-sm text-slate-500">
              Monthly financial targets used by the scorecard report.
            </p>
          </div>
          <Link
            href={`/clients/${clientId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to client
          </Link>
        </div>

        {msg && (
          <div
            className={`mb-4 rounded-md p-3 text-sm ${
              msg.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Existing targets
            </h2>
            {editingId === null && (
              <button
                onClick={startNew}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Add target
              </button>
            )}
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2 text-right">Revenue</th>
                <th className="px-4 py-2 text-right">GP</th>
                <th className="px-4 py-2 text-right">Net profit</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {targets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No targets yet. Click <strong>Add target</strong> to set the first one.
                  </td>
                </tr>
              )}
              {targets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{fmtPeriod(t)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(t.revenue)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(t.gross_profit)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(t.net_profit)}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => startEdit(t)}
                      className="text-sm font-medium text-slate-700 hover:text-slate-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(t)}
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingId !== null && (
          <form
            onSubmit={onSubmit}
            className="mt-6 space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {editingId === "new" ? "New target" : "Edit target"}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Period start (YYYY-MM-DD)" required>
                <input
                  type="date"
                  required
                  value={form.period_start}
                  onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Period end (YYYY-MM-DD)">
                <input
                  type="date"
                  value={form.period_end ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {NUMERIC_FIELDS.map((field) => (
                <Field key={field} label={`${FIELD_LABELS[field]} (AUD)`}>
                  <input
                    type="number"
                    step="0.01"
                    value={form[field] ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }))}
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
                {saving ? "Saving…" : editingId === "new" ? "Add target" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
