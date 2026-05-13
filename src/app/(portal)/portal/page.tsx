import Link from "next/link";
import { type Client, type ReportLog } from "@/lib/api";
import { makeServerApi } from "@/lib/api-server";

export const dynamic = "force-dynamic";

const REPORT_LABELS: Record<string, string> = {
  simpro_weekly: "Simpro labour",
  xero_mtd: "Xero scorecard",
  quotes_jobs: "Quote follow-up",
};

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
  if (!iso) return "no reports yet";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

export default async function PortalDashboard() {
  const api = await makeServerApi();

  let client: Client | null = null;
  let logs: ReportLog[] = [];
  let fetchError: string | null = null;
  try {
    const [list, logsRes] = await Promise.all([
      api.listClients(),
      // We don't know our own client_id at the layer above, so list+pick.
      // Server-side filter on /api/clients ensures the list has only us.
      Promise.resolve(null), // placeholder so structure mirrors below
    ]);
    client = list[0] ?? null;
    if (client) {
      logs = await api.listReportLogs(client.id, 20);
    }
    void logsRes; // mark as intentionally unused
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
  }

  // Group the latest success per report_type. ReportLog is already sorted
  // newest-first by the backend so the first hit per type is the latest.
  const latestByType: Record<string, ReportLog | undefined> = {};
  for (const log of logs) {
    if (log.status !== "success") continue;
    if (!latestByType[log.report_type]) {
      latestByType[log.report_type] = log;
    }
  }

  const lastAny =
    logs.find((l) => l.status === "success")?.sent_at ?? null;

  return (
    <main className="min-h-screen bg-paper-warm p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-ink">
            Welcome{client ? `, ${client.business_name}` : ""}
          </h1>
          <p className="text-sm text-muted">
            Your TCOS Insights portal — see the latest reports we send you,
            update your targets, and connect your Xero account.
          </p>
        </header>

        {fetchError && (
          <div className="mb-4 rounded-md bg-brand-red/10 p-4 text-sm text-brand-red">
            <strong>Couldn&apos;t load your data:</strong> {fetchError}
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat
            label="Last report sent"
            value={fmtRelative(lastAny)}
            sub={lastAny ? fmtDate(lastAny) : "your weekly cadence is Mondays"}
          />
          <Stat
            label="Xero connection"
            value={client?.xero_connected ? "Connected" : "Not connected"}
            sub={
              client?.xero_connected
                ? "Scorecard reports ready"
                : "Click Connect Xero to set up"
            }
            warn={!client?.xero_connected}
          />
          <Stat
            label="Active reports"
            value={String(Object.keys(latestByType).length)}
            sub="report types you receive weekly"
          />
        </div>

        <section className="mb-6 rounded-lg border border-rule bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Latest report by type
          </h2>
          {Object.keys(latestByType).length === 0 ? (
            <p className="text-sm text-muted">
              No reports have been sent yet. Reports go out automatically every
              Monday morning. If you&apos;re expecting one and haven&apos;t got
              it, let your bookkeeper know.
            </p>
          ) : (
            <ul className="divide-y divide-paper-cool">
              {Object.entries(latestByType).map(([type, log]) => (
                <li
                  key={type}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {REPORT_LABELS[type] ?? type}
                    </div>
                    <div className="text-xs text-muted">
                      {fmtRelative(log?.sent_at ?? null)} · {fmtDate(log?.sent_at ?? null)}
                    </div>
                  </div>
                  <Link
                    href="/portal/reports"
                    className="text-sm font-medium text-ink-soft hover:text-ink"
                  >
                    View →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-rule bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Quick actions
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Link
              href="/portal/targets"
              className="rounded-md border border-rule p-4 hover:bg-paper-warm"
            >
              <div className="text-sm font-semibold text-ink">Set targets</div>
              <div className="mt-1 text-xs text-muted">
                Monthly revenue, GP, and net profit goals.
              </div>
            </Link>
            <Link
              href="/portal/reports"
              className="rounded-md border border-rule p-4 hover:bg-paper-warm"
            >
              <div className="text-sm font-semibold text-ink">View reports</div>
              <div className="mt-1 text-xs text-muted">
                Re-open past Monday reports any time.
              </div>
            </Link>
            <Link
              href="/portal/settings"
              className="rounded-md border border-rule p-4 hover:bg-paper-warm"
            >
              <div className="text-sm font-semibold text-ink">My settings</div>
              <div className="mt-1 text-xs text-muted">
                Email + extra recipients on your Monday reports.
              </div>
            </Link>
          </div>
        </section>
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
    <div
      className={`rounded-lg border p-4 ${
        warn ? "border-amber-200 bg-brand-amber/10" : "border-rule bg-white"
      }`}
    >
      <div
        className={`text-xs font-medium uppercase tracking-wide ${
          warn ? "text-brand-amber" : "text-muted"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          warn ? "text-brand-amber" : "text-ink"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className={`mt-0.5 text-xs ${warn ? "text-brand-amber" : "text-muted"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
