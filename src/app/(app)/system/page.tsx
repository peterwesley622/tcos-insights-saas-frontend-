import Link from "next/link";
import { type Client, type ReportLog } from "@/lib/api";
import { makeServerApi } from "@/lib/api-server";

export const dynamic = "force-dynamic";

const REPORT_TYPE_LABELS: Record<string, string> = {
  simpro_weekly: "Simpro labour",
  xero_mtd: "Xero scorecard (MTD)",
  xero_monthly: "Xero scorecard (monthly)",
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
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRelative(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function SystemStatusPage() {
  const api = await makeServerApi();
  const [clientsResult, logsResult] = await Promise.allSettled([
    api.listClients(),
    api.schedulerStatus(50),
  ]);

  const clients: Client[] =
    clientsResult.status === "fulfilled" ? clientsResult.value : [];
  const logs: ReportLog[] =
    logsResult.status === "fulfilled" ? logsResult.value : [];
  const errors: string[] = [];
  if (clientsResult.status === "rejected") {
    errors.push(
      `Clients: ${clientsResult.reason instanceof Error ? clientsResult.reason.message : String(clientsResult.reason)}`,
    );
  }
  if (logsResult.status === "rejected") {
    errors.push(
      `Logs: ${logsResult.reason instanceof Error ? logsResult.reason.message : String(logsResult.reason)}`,
    );
  }

  const clientById = new Map(clients.map((c) => [c.id, c]));

  const activeClients = clients.filter((c) => c.active).length;
  const lastRun = logs[0]?.sent_at ?? null;

  // Last 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = logs.filter((l) => {
    if (!l.sent_at) return false;
    return new Date(l.sent_at).getTime() >= cutoff;
  });
  const successCount = recent.filter(
    (l) => l.status === "success" || l.status === "sent",
  ).length;
  const failCount = recent.filter((l) => l.status === "failed").length;
  const successRate = recent.length > 0
    ? Math.round((successCount / recent.length) * 100)
    : null;

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">System status</h1>
          <p className="text-sm text-slate-500">
            Recent report runs across all clients. The Monday cron writes here too.
          </p>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
            <strong>Backend errors:</strong>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Active clients" value={String(activeClients)} sub={`${clients.length} total`} />
          <Stat label="Last run" value={fmtRelative(lastRun)} sub={fmtDate(lastRun)} />
          <Stat
            label="Last 7 days"
            value={`${recent.length} runs`}
            sub={successRate != null ? `${successRate}% success` : "—"}
          />
          <Stat
            label="Failures (7d)"
            value={String(failCount)}
            sub={failCount === 0 ? "all clear" : "see below"}
            warn={failCount > 0}
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Last {logs.length} run{logs.length === 1 ? "" : "s"}
            </h2>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No runs yet.
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const client = clientById.get(log.client_id);
                return (
                  <tr key={log.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      <div>{fmtRelative(log.sent_at)}</div>
                      <div className="text-xs text-slate-400">{fmtDate(log.sent_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {client ? (
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-slate-900 hover:text-slate-700"
                        >
                          {client.business_name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">deleted (id {log.client_id})</span>
                      )}
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
                    <td className="px-4 py-3 text-xs text-red-700 max-w-md break-words">
                      {log.error_message ? (
                        <span className="font-mono">{log.error_message}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${warn ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${warn ? "text-red-700" : "text-slate-500"}`}>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${warn ? "text-red-900" : "text-slate-900"}`}>
        {value}
      </div>
      {sub && (
        <div className={`mt-0.5 text-xs ${warn ? "text-red-700" : "text-slate-500"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
