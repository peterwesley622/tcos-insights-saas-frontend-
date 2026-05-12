"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { type Client, type ReportLog } from "@/lib/api";
import { useApi } from "@/lib/api-browser";

type ReportKind = "simpro" | "scorecard" | "quotes_jobs";

const REPORT_TYPE_BY_KIND: Record<ReportKind, string> = {
  simpro: "simpro_weekly",
  scorecard: "xero_mtd",
  quotes_jobs: "quotes_jobs",
};

const REPORT_META: Record<
  ReportKind,
  { title: string; subtitle: string; etaText: string }
> = {
  simpro: {
    title: "Labour & Major Projects",
    subtitle:
      "Top jobs by labour hours, GP analysis, and the full active-job table.",
    etaText: "Takes 1–3 minutes to render — please don't close the tab.",
  },
  scorecard: {
    title: "Financial Scorecard (Xero)",
    subtitle:
      "Month-to-date revenue, materials, wages, GP, overheads and net profit vs your targets.",
    etaText: "Usually under 30 seconds.",
  },
  quotes_jobs: {
    title: "Quote Follow-Up & Job Health",
    subtitle:
      "Priority-scored open quotes plus active jobs flagged for labour overruns, low GP, under-invoicing, or stale progress.",
    etaText: "1–3 minutes depending on the number of open quotes.",
  },
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  simpro_weekly: "Labour report",
  xero_mtd: "Financial scorecard",
  quotes_jobs: "Quote follow-up",
};

type GenStatus = "idle" | "generating" | "ok" | "err";

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === "success" || s === "sent") return "bg-green-100 text-green-800";
  if (s === "dry_run") return "bg-blue-100 text-blue-800";
  if (s === "skipped") return "bg-slate-100 text-slate-700";
  return "bg-red-100 text-red-800";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PortalReportsPage() {
  const api = useApi();

  const [client, setClient] = useState<Client | null>(null);
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [genState, setGenState] = useState<
    Record<ReportKind, { status: GenStatus; message?: string }>
  >({
    simpro: { status: "idle" },
    scorecard: { status: "idle" },
    quotes_jobs: { status: "idle" },
  });

  const [viewingId, setViewingId] = useState<number | null>(null);

  // Pull the stored HTML for a single history row and open in a new
  // tab via a Blob URL. The endpoint requires the bearer token so we
  // can't link to it directly.
  async function viewReport(clientId: number, logId: number) {
    setViewingId(logId);
    try {
      const html = await api.getReportLogHtml(clientId, logId);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setViewingId(null);
    }
  }

  const load = useCallback(async () => {
    try {
      const list = await api.listClients();
      const me = list[0] ?? null;
      setClient(me);
      if (me) {
        const l = await api.listReportLogs(me.id, 30);
        setLogs(l);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Latest success log per report_type, used to show "last sent" on each card.
  const latestByType: Record<string, ReportLog | undefined> = {};
  for (const log of logs) {
    if (log.status !== "success") continue;
    if (!latestByType[log.report_type]) {
      latestByType[log.report_type] = log;
    }
  }

  async function onPreview(kind: ReportKind) {
    if (!client) return;
    setGenState((s) => ({ ...s, [kind]: { status: "generating" } }));
    try {
      let html: string;
      if (kind === "simpro") {
        html = await api.generateClientSimproHtml(client.id);
      } else if (kind === "scorecard") {
        html = await api.generateScorecardHtml(client.id);
      } else {
        html = await api.generateQuotesJobsHtml(client.id);
      }
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setGenState((s) => ({
        ...s,
        [kind]: { status: "ok", message: "Opened in a new tab." },
      }));
      // Refresh log list so the new "success" row shows up below.
      load();
    } catch (e) {
      setGenState((s) => ({
        ...s,
        [kind]: {
          status: "err",
          message: e instanceof Error ? e.message : String(e),
        },
      }));
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
        <div className="mx-auto max-w-3xl rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error ?? "Couldn't load your reports."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Your reports</h1>
          <p className="text-sm text-slate-500">
            Preview the same reports we email you on Mondays. The latest
            version is regenerated when you click Preview — useful when you
            want a mid-week check.
          </p>
        </header>

        <div className="mb-8 space-y-4">
          {(["scorecard", "simpro", "quotes_jobs"] as ReportKind[]).map((kind) => {
            const meta = REPORT_META[kind];
            const state = genState[kind];
            const latest = latestByType[REPORT_TYPE_BY_KIND[kind]];
            const generating = state.status === "generating";
            // Each card's "missing dependency" gate. Scorecard needs Xero;
            // simpro + quotes_jobs need Simpro creds. The label tells the
            // client exactly what's missing.
            const simproConfigured = Boolean(client.simpro_api_key_masked);
            const xeroDisabled = kind === "scorecard" && !client.xero_connected;
            const simproDisabled =
              (kind === "simpro" || kind === "quotes_jobs") && !simproConfigured;
            const disabled = xeroDisabled || simproDisabled;
            const disabledReason = xeroDisabled
              ? "Connect Xero in Settings to enable"
              : "Simpro not configured for your account";
            return (
              <section
                key={kind}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {meta.title}
                  </h2>
                  {disabled && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                      {disabledReason}
                    </span>
                  )}
                </div>
                <p className="mb-1 text-sm text-slate-600">{meta.subtitle}</p>
                <p className="mb-3 text-xs text-slate-500">
                  {latest
                    ? `Last sent: ${fmtDate(latest.sent_at)}`
                    : "Not sent yet — your first one goes out next Monday."}
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => onPreview(kind)}
                    disabled={generating || disabled}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {generating ? "Generating…" : "Preview latest"}
                  </button>
                </div>

                {generating && (
                  <p className="mt-3 text-sm text-slate-600">{meta.etaText}</p>
                )}
                {state.status === "ok" && state.message && (
                  <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
                    {state.message}
                  </p>
                )}
                {state.status === "err" && state.message && (
                  <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                    {state.message}
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Report history
            </h2>
            <p className="text-xs text-slate-500">
              Last {logs.length} run{logs.length === 1 ? "" : "s"} — newest
              first. Includes both your Monday cron sends and any preview runs.
            </p>
          </div>
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
                    No reports yet. They start arriving the Monday after your
                    bookkeeper sets you up.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {fmtDate(log.sent_at)}
                    </td>
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
                      {log.has_html && (
                        <button
                          onClick={() => viewReport(log.client_id, log.id)}
                          disabled={viewingId === log.id}
                          className="text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
                        >
                          {viewingId === log.id ? "Opening…" : "View"}
                        </button>
                      )}
                      {log.archive_url && (
                        <a
                          href={log.archive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                          title="Open the archived copy in Google Drive"
                        >
                          Drive ↗
                        </a>
                      )}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
