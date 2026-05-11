"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { type Client, type ReportSendResult } from "@/lib/api";
import { useApi } from "@/lib/api-browser";

type ReportKind = "simpro" | "scorecard" | "quotes_jobs";

const REPORT_META: Record<
  ReportKind,
  { title: string; subtitle: string; etaText: string }
> = {
  simpro: {
    title: "Simpro Labour Report",
    subtitle: "Top 10 jobs by hours, GP analysis, and full job table.",
    etaText: "2–3 minutes for clients with many active jobs.",
  },
  scorecard: {
    title: "Xero Financial Scorecard",
    subtitle: "MTD revenue, materials, wages, GP, overheads and net profit vs targets.",
    etaText: "Usually under 30 seconds.",
  },
  quotes_jobs: {
    title: "Quote Follow-Up & Job Health",
    subtitle:
      "Priority-scored open quotes (last 90 days) and active jobs flagged for labour/materials overruns, low GP, under-invoicing, or stale progress.",
    etaText: "1–3 minutes depending on quote count.",
  },
};

type Status = "idle" | "generating" | "ok" | "err";

export default function ReportsPage() {
  const params = useParams<{ id: string }>();
  const api = useApi();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [genState, setGenState] = useState<Record<ReportKind, { status: Status; message?: string }>>({
    simpro: { status: "idle" },
    scorecard: { status: "idle" },
    quotes_jobs: { status: "idle" },
  });

  const [sendModal, setSendModal] = useState<ReportKind | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<ReportSendResult | null>(null);

  useEffect(() => {
    if (!clientId) return;
    api
      .getClient(clientId)
      .then(setClient)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function onPreview(kind: ReportKind) {
    setGenState((s) => ({ ...s, [kind]: { status: "generating" } }));
    try {
      let html: string;
      if (kind === "simpro") {
        html = await api.generateSimproReportHtml(clientId);
      } else if (kind === "scorecard") {
        html = await api.generateScorecardHtml(clientId);
      } else {
        html = await api.generateQuotesJobsHtml(clientId);
      }
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setGenState((s) => ({ ...s, [kind]: { status: "ok", message: "Opened in a new tab." } }));
    } catch (e) {
      setGenState((s) => ({
        ...s,
        [kind]: { status: "err", message: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

  function openSendModal(kind: ReportKind) {
    setSendModal(kind);
    setTestEmail("");
    setDryRun(false);
    setSendResult(null);
  }

  function closeSendModal() {
    if (sending) return;
    setSendModal(null);
  }

  async function onConfirmSend() {
    if (!sendModal) return;
    setSending(true);
    setSendResult(null);
    try {
      const opts = {
        test_email: testEmail.trim() || undefined,
        dry_run: dryRun,
      };
      let result: ReportSendResult;
      if (sendModal === "simpro") {
        result = await api.sendSimproReport(clientId, opts);
      } else if (sendModal === "scorecard") {
        result = await api.sendScorecardReport(clientId, opts);
      } else {
        result = await api.sendQuotesJobsReport(clientId, opts);
      }
      setSendResult(result);
    } catch (e) {
      setSendResult({
        client_id: clientId,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSending(false);
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
            <h1 className="text-2xl font-bold text-slate-900">Reports — {client.business_name}</h1>
            <p className="text-sm text-slate-500">
              Generate on demand or send the same email the Monday cron sends.
            </p>
          </div>
          <Link href={`/clients/${clientId}`} className="text-sm text-slate-600 hover:text-slate-900">
            ← Back to client
          </Link>
        </div>

        <div className="space-y-4">
          {(["simpro", "scorecard", "quotes_jobs"] as ReportKind[]).map((kind) => {
            const meta = REPORT_META[kind];
            const state = genState[kind];
            const generating = state.status === "generating";
            // Each card has its own "missing dependency" gate. The label
            // tells the admin exactly which integration is unconfigured
            // so the disabled state isn't mysterious.
            const simproConfigured = Boolean(client.simpro_api_key_masked);
            const xeroConfigured = Boolean(client.xero_connected);
            const disabled =
              (kind === "scorecard" && !xeroConfigured) ||
              (kind === "simpro" && !simproConfigured) ||
              (kind === "quotes_jobs" && !simproConfigured);
            const disabledReason =
              kind === "scorecard"
                ? "Xero not connected"
                : "Simpro not configured";
            return (
              <section key={kind} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
                  {disabled && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                      {disabledReason}
                    </span>
                  )}
                </div>
                <p className="mb-1 text-sm text-slate-600">{meta.subtitle}</p>
                <p className="mb-4 text-xs text-slate-500">{meta.etaText}</p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => onPreview(kind)}
                    disabled={generating || disabled}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {generating ? "Generating…" : "Preview"}
                  </button>
                  <button
                    onClick={() => openSendModal(kind)}
                    disabled={generating || disabled}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Send via email…
                  </button>
                </div>

                {generating && (
                  <p className="mt-3 text-sm text-slate-600">
                    {kind === "simpro"
                      ? "Pulling jobs from Simpro and rendering charts. This usually takes 2–3 minutes — please don't close this tab."
                      : kind === "scorecard"
                      ? "Pulling MTD P&L from Xero and rendering."
                      : "Pulling quotes and active jobs from Simpro. 1–3 minutes."}
                  </p>
                )}

                {state.status === "ok" && state.message && (
                  <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">{state.message}</p>
                )}
                {state.status === "err" && state.message && (
                  <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{state.message}</p>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {sendModal && (
        <SendModal
          kind={sendModal}
          recipientEmail={client.owner_emails}
          testEmail={testEmail}
          setTestEmail={setTestEmail}
          dryRun={dryRun}
          setDryRun={setDryRun}
          sending={sending}
          result={sendResult}
          onClose={closeSendModal}
          onConfirm={onConfirmSend}
        />
      )}
    </main>
  );
}

function SendModal({
  kind,
  recipientEmail,
  testEmail,
  setTestEmail,
  dryRun,
  setDryRun,
  sending,
  result,
  onClose,
  onConfirm,
}: {
  kind: ReportKind;
  recipientEmail: string | null;
  testEmail: string;
  setTestEmail: (v: string) => void;
  dryRun: boolean;
  setDryRun: (v: boolean) => void;
  sending: boolean;
  result: ReportSendResult | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const meta = REPORT_META[kind];
  const effectiveRecipient = testEmail.trim() || recipientEmail || "(missing)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Send {meta.title}</h3>
        </div>

        <div className="space-y-4 px-6 py-5 text-sm">
          <div>
            <span className="block font-medium text-slate-700">Recipient</span>
            <span className="text-slate-600">{effectiveRecipient}</span>
          </div>

          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">
              Test email override (optional)
            </span>
            <input
              type="email"
              placeholder="Leave blank to send to recipient above"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-slate-700">Dry run</span>
              <span className="text-xs text-slate-500">
                Builds the report but does NOT send the email. Use to test.
              </span>
            </span>
          </label>

          {sending && (
            <p className="rounded-md bg-blue-50 p-3 text-blue-800">
              {kind === "simpro"
                ? "Building report… 2–3 minutes."
                : "Sending… should be quick."}
            </p>
          )}

          {result && (
            <p
              className={`rounded-md p-3 ${
                result.status === "sent"
                  ? "bg-green-50 text-green-800"
                  : result.status === "dry_run"
                  ? "bg-blue-50 text-blue-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              <strong>Status: {result.status}</strong>
              {result.message && <span className="block mt-1">{result.message}</span>}
              {result.error && <span className="block mt-1">{result.error}</span>}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={onConfirm}
              disabled={sending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {sending ? "Working…" : dryRun ? "Run dry-run" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
