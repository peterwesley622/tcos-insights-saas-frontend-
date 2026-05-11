"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { type Client, type ReportLog } from "@/lib/api";
import { useApi } from "@/lib/api-browser";

const REPORT_TYPE_LABELS: Record<string, string> = {
  simpro_weekly: "Simpro labour",
  xero_mtd: "Xero scorecard (MTD)",
  xero_monthly: "Xero scorecard (monthly)",
  quotes_jobs: "Quote follow-up & job health",
};

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === "success" || s === "sent") return "bg-green-100 text-green-800";
  if (s === "dry_run") return "bg-blue-100 text-blue-800";
  if (s === "skipped") return "bg-slate-100 text-slate-700";
  return "bg-red-100 text-red-800";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const params = useParams<{ id: string }>();
  const api = useApi();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([
        api.getClient(clientId),
        api.listReportLogs(clientId, 50),
      ]);
      setClient(c);
      setLogs(l);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, clientId]);

  useEffect(() => {
    if (!clientId) return;
    load().finally(() => setLoading(false));
  }, [clientId, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            <h1 className="text-2xl font-bold text-slate-900">Report history — {client.business_name}</h1>
            <p className="text-sm text-slate-500">
              Last {logs.length} report run{logs.length === 1 ? "" : "s"}, newest first.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Link href={`/clients/${clientId}`} className="text-sm text-slate-600 hover:text-slate-900">
              ← Back to client
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No report runs yet.
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const hasError = !!log.error_message;
                const isExpanded = expanded.has(log.id);
                const hasArchive = !!log.archive_url;
                return (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{fmtDate(log.sent_at)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {REPORT_TYPE_LABELS[log.report_type] ?? log.report_type}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(log.status)}`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-4">
                        {hasArchive && (
                          <a
                            href={log.archive_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-700 hover:text-blue-900"
                          >
                            Open ↗
                          </a>
                        )}
                        {hasError && (
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900"
                          >
                            {isExpanded ? "Hide error" : "Show error"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {hasError && isExpanded && (
                      <tr className="bg-red-50/50">
                        <td colSpan={4} className="px-4 py-3 text-xs text-red-800 font-mono whitespace-pre-wrap break-all">
                          {log.error_message}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
