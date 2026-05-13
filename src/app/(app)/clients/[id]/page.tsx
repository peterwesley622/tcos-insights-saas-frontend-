"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { type Client, type ClientUpdate } from "@/lib/api";
import { useApi } from "@/lib/api-browser";
import {
  EmailListInput,
  parseOwnerEmails as parseOwnerEmailsShared,
  serializeOwnerEmails,
} from "@/components/EmailListInput";

export default function EditClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [connMsg, setConnMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [inviteMsg, setInviteMsg] = useState<{ kind: "ok" | "info" | "err"; text: string } | null>(null);
  const [inviting, setInviting] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  // Owner emails are stored as a semicolon-separated string on the
  // backend but edited as an array in the UI so each address gets its
  // own input row + remove button. parseOwnerEmailsShared / serialize
  // bridge between the two representations.
  const [ownerEmailList, setOwnerEmailList] = useState<string[]>([""]);
  const [simproUrl, setSimproUrl] = useState("");
  const [newSimproKey, setNewSimproKey] = useState("");
  const [companyId, setCompanyId] = useState<number | "">("");
  const [gpLow, setGpLow] = useState<number | "">("");
  const [gpHigh, setGpHigh] = useState<number | "">("");
  const [siteWorkers, setSiteWorkers] = useState<number | "">("");
  const [wagesInOpex, setWagesInOpex] = useState(false);
  const [ccEmails, setCcEmails] = useState("");
  const [enabledReports, setEnabledReports] = useState({
    simpro: true,
    scorecard: true,
    quotes: true,
  });
  const [driveFolderId, setDriveFolderId] = useState("");

  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);

  // Pick up the ?xero=... query param the backend sets after the OAuth
  // callback redirects back to this page, render an inline banner, then
  // strip the param so a refresh doesn't re-show stale state.
  useEffect(() => {
    if (!searchParams) return;
    const xero = searchParams.get("xero");
    if (!xero) return;
    if (xero === "connected") {
      const tenant = searchParams.get("tenant") || "";
      setConnMsg({
        kind: "ok",
        text: tenant ? `Xero connected — ${tenant}.` : "Xero connected.",
      });
    } else if (xero === "error") {
      const detail = searchParams.get("detail") || "unknown error";
      setConnMsg({ kind: "err", text: `Xero connect failed: ${detail}` });
    }
    // Drop the query params from the URL without reloading or pushing
    // a new history entry.
    router.replace(`/clients/${clientId}`);
  }, [searchParams, clientId, router]);

  useEffect(() => {
    if (!clientId) return;
    api
      .getClient(clientId)
      .then((c) => {
        setClient(c);
        setBusinessName(c.business_name);
        setOwnerName(c.owner_name ?? "");
        const parsed = parseOwnerEmailsShared(c.owner_emails);
        // Always leave at least one row so the form has a target to
        // type into when this client has no owners configured yet.
        setOwnerEmailList(parsed.length > 0 ? parsed : [""]);
        setSimproUrl(c.simpro_base_url ?? "");
        setCompanyId(c.simpro_company_id ?? "");
        setGpLow(c.gp_threshold_low ?? "");
        setGpHigh(c.gp_threshold_high ?? "");
        setSiteWorkers(c.num_site_workers ?? "");
        setWagesInOpex(Boolean(c.wages_in_opex));
        setCcEmails(c.cc_emails ?? "");
        const parts = (c.enabled_reports || "simpro,scorecard,quotes").split(",").map((s) => s.trim());
        setEnabledReports({
          simpro: parts.includes("simpro"),
          scorecard: parts.includes("scorecard"),
          quotes: parts.includes("quotes"),
        });
        setDriveFolderId(c.drive_folder_id ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [clientId]);

  function diffPatch(): ClientUpdate {
    if (!client) return {};
    const patch: ClientUpdate = {};
    if (businessName !== client.business_name) patch.business_name = businessName;
    if ((ownerName || null) !== client.owner_name) patch.owner_name = ownerName || null;
    const ownerEmailsSerialized = serializeOwnerEmails(ownerEmailList);
    // Compare normalized forms on both sides so trivial whitespace
    // differences between the stored string and the freshly-built one
    // don't trigger a redundant PATCH on save.
    const storedNormalized = serializeOwnerEmails(parseOwnerEmailsShared(client.owner_emails));
    if (ownerEmailsSerialized !== storedNormalized) {
      patch.owner_emails = ownerEmailsSerialized;
    }
    if ((simproUrl || null) !== client.simpro_base_url) patch.simpro_base_url = simproUrl || null;
    if (newSimproKey.trim()) patch.simpro_api_key = newSimproKey.trim();
    const cid = companyId === "" ? null : Number(companyId);
    if (cid !== client.simpro_company_id) patch.simpro_company_id = cid;
    const lo = gpLow === "" ? null : Number(gpLow);
    if (lo !== client.gp_threshold_low) patch.gp_threshold_low = lo;
    const hi = gpHigh === "" ? null : Number(gpHigh);
    if (hi !== client.gp_threshold_high) patch.gp_threshold_high = hi;
    const sw = siteWorkers === "" ? null : Number(siteWorkers);
    if (sw !== client.num_site_workers) patch.num_site_workers = sw;
    if (wagesInOpex !== Boolean(client.wages_in_opex)) patch.wages_in_opex = wagesInOpex;
    const cc = ccEmails.trim() || null;
    if (cc !== client.cc_emails) patch.cc_emails = cc;
    const er = Object.entries(enabledReports)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(",") || "simpro,scorecard,quotes";
    if (er !== client.enabled_reports) patch.enabled_reports = er;
    const dfid = driveFolderId.trim() || null;
    if (dfid !== client.drive_folder_id) patch.drive_folder_id = dfid;
    return patch;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    const patch = diffPatch();
    if (Object.keys(patch).length === 0) {
      setSaveMsg({ kind: "ok", text: "No changes to save." });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await api.updateClient(client.id, patch);
      setClient(updated);
      setNewSimproKey("");
      setSaveMsg({ kind: "ok", text: "Saved." });
    } catch (e) {
      setSaveMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function onTestSimpro() {
    if (!client) return;
    setActioning(true);
    setConnMsg(null);
    try {
      const r = await api.testSimpro(client.id);
      const companiesOk = r.companies_endpoint.ok;
      const jobsOk = r.jobs_endpoint.status === "connected";
      if (companiesOk && jobsOk) {
        setConnMsg({ kind: "ok", text: "Simpro: companies + jobs both OK." });
      } else {
        const errs: string[] = [];
        if (!companiesOk) errs.push(`companies: ${r.companies_endpoint.error ?? "failed"}`);
        if (!jobsOk) errs.push(`jobs: ${r.jobs_endpoint.message ?? r.jobs_endpoint.status}`);
        setConnMsg({ kind: "err", text: `Simpro test failed — ${errs.join("; ")}` });
      }
    } catch (e) {
      setConnMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setActioning(false);
    }
  }

  async function onTestXero() {
    if (!client) return;
    setActioning(true);
    setConnMsg(null);
    try {
      const r = await api.testXero(client.id);
      if (r.status === "connected") {
        setConnMsg({ kind: "ok", text: `Xero OK — ${r.organisation}` });
      } else {
        setConnMsg({ kind: "err", text: `Xero: ${r.message}` });
      }
    } catch (e) {
      setConnMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setActioning(false);
    }
  }

  async function onTestDrive() {
    if (!client) return;
    setActioning(true);
    setConnMsg(null);
    try {
      const r = await api.testDrive(client.id);
      if (r.status === "ok") {
        setConnMsg({
          kind: "ok",
          text: `Drive OK — folder "${r.folder_name}" is accessible.`,
        });
      } else if (r.status === "disabled") {
        setConnMsg({
          kind: "err",
          text: `Drive disabled — service account JSON not configured on Railway.`,
        });
      } else if (r.status === "not_found") {
        setConnMsg({
          kind: "err",
          text: `Drive: folder not visible. Share it with ${r.service_account_email ?? "the service account"} (Editor) and try again.`,
        });
      } else {
        setConnMsg({ kind: "err", text: `Drive: ${r.error}` });
      }
    } catch (e) {
      setConnMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setActioning(false);
    }
  }

  async function onConnectXero() {
    if (!client) return;
    setActioning(true);
    setConnMsg(null);
    try {
      const { authorize_url } = await api.xeroConnectAuthorizeUrl(client.id);
      if (authorize_url) {
        window.location.href = authorize_url;
      } else {
        setConnMsg({ kind: "err", text: "Could not get Xero authorize URL." });
      }
    } catch (e) {
      setConnMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setActioning(false);
    }
  }

  async function onDisconnectXero() {
    if (!client) return;
    if (!confirm("Disconnect Xero for this client?")) return;
    setActioning(true);
    setConnMsg(null);
    try {
      await api.disconnectXero(client.id);
      const fresh = await api.getClient(client.id);
      setClient(fresh);
      setConnMsg({ kind: "ok", text: "Disconnected from Xero." });
    } catch (e) {
      setConnMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setActioning(false);
    }
  }

  async function onSendInvite(targetEmail: string) {
    if (!client) return;
    if (!targetEmail || !targetEmail.includes("@")) {
      setInviteMsg({ kind: "err", text: "Invalid email address." });
      return;
    }
    if (
      !confirm(
        `Send a portal invite email to ${targetEmail}? They'll receive a magic-link to sign in to the client portal.`,
      )
    ) {
      return;
    }
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await api.invitePortal(client.id, targetEmail);
      // "already_registered" is a soft success — render as info, not error.
      const kind = res.status === "already_registered" ? "info" : "ok";
      setInviteMsg({ kind, text: res.message ?? `Invite sent to ${res.email}.` });
    } catch (e) {
      setInviteMsg({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setInviting(false);
    }
  }

  // Helper: parse the persisted owner_emails string into a clean list
  // so the Portal access card can render a row per owner with its own
  // Invite button. Local alias for readability; identical to the
  // exported parseOwnerEmailsShared.
  const parseOwnerEmails = parseOwnerEmailsShared;

  async function onToggleActive() {
    if (!client) return;
    const next = !client.active;
    if (!next && !confirm("Deactivate this client? They will be skipped by the Monday cron.")) return;
    setActioning(true);
    setStatusMsg(null);
    try {
      const updated = await api.updateClient(client.id, { active: next });
      setClient(updated);
      setStatusMsg({ kind: "ok", text: next ? "Activated." : "Deactivated." });
    } catch (e) {
      setStatusMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setActioning(false);
    }
  }

  async function onDelete() {
    if (!client) return;
    if (!confirm(`Soft-delete ${client.business_name}? They'll be marked inactive.`)) return;
    setActioning(true);
    try {
      await api.deleteClient(client.id);
      router.push("/clients");
    } catch (e) {
      setStatusMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
      setActioning(false);
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
        <div className="mx-auto max-w-2xl">
          <Link href="/clients" className="text-sm text-ink-soft hover:text-ink">
            ← Back to clients
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
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">{client.business_name}</h1>
            <p className="text-sm text-muted">
              ID {client.id} · {client.active ? "Active" : "Inactive"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/clients/${client.id}/reports`}
              className="rounded-md border border-rule bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper-warm"
            >
              Reports →
            </Link>
            <Link
              href={`/clients/${client.id}/targets`}
              className="rounded-md border border-rule bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper-warm"
            >
              Targets →
            </Link>
            <Link
              href={`/clients/${client.id}/history`}
              className="rounded-md border border-rule bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper-warm"
            >
              History →
            </Link>
            <Link href="/clients" className="text-sm text-ink-soft hover:text-ink">
              ← Back to clients
            </Link>
          </div>
        </div>

        <form onSubmit={onSave} className="space-y-6 rounded-lg border border-rule bg-white p-6 shadow-sm">
          <Section title="Business">
            <Field label="Business name" required>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Owner name">
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Owner emails">
              <EmailListInput
                values={ownerEmailList}
                onChange={setOwnerEmailList}
                inputClassName={inputCls}
              />
              <p className="mt-1 text-xs text-muted">
                Each address receives every report and can sign in to the
                portal. Click <strong>Add another email</strong> to invite
                more people; click the trash icon to remove one.
              </p>
            </Field>
          </Section>

          <Section title="Simpro connection">
            <Field label="Simpro base URL">
              <input
                type="url"
                value={simproUrl}
                onChange={(e) => setSimproUrl(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Simpro API key">
              <input
                type="password"
                value={newSimproKey}
                onChange={(e) => setNewSimproKey(e.target.value)}
                placeholder={
                  client.simpro_api_key_masked
                    ? `Stored: ••••${client.simpro_api_key_masked} — leave blank to keep`
                    : "Enter API key"
                }
                className={inputCls}
              />
            </Field>
            <Field label="Simpro company ID">
              <input
                type="number"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value === "" ? "" : Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </Section>

          <Section title="Report parameters">
            <div className="grid grid-cols-2 gap-4">
              <Field label="GP threshold low (%)">
                <input
                  type="number"
                  step="0.1"
                  value={gpLow}
                  onChange={(e) => setGpLow(e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="GP threshold high (%)">
                <input
                  type="number"
                  step="0.1"
                  value={gpHigh}
                  onChange={(e) => setGpHigh(e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Field staff count">
              <input
                type="number"
                min={1}
                value={siteWorkers}
                onChange={(e) => setSiteWorkers(e.target.value === "" ? "" : Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <label className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                checked={wagesInOpex}
                onChange={(e) => setWagesInOpex(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-ink-soft">
                  Wages live in Operating Expenses (not Cost of Sales)
                </span>
                <span className="block text-xs text-muted">
                  Tick this for clients (e.g. LS Fencing) whose Xero chart of accounts puts
                  wages, super and worker&apos;s comp in OpEx. The scorecard then moves those
                  amounts out of Overheads and into Wages so both totals are correct.
                </span>
              </span>
            </label>
          </Section>

          <Section title="Report delivery">
            <Field label="CC emails (semicolon-separated)">
              <input
                type="text"
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="e.g. peter@bbo.com.au; admin@bbo.com.au"
                className={inputCls}
              />
            </Field>
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-ink-soft">Enabled reports</legend>
              <div className="flex gap-6">
                {(
                  [
                    ["simpro", "Labour & Productivity"],
                    ["scorecard", "Financial Scorecard"],
                    ["quotes", "Quote Follow-Up"],
                  ] as [keyof typeof enabledReports, string][]
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={enabledReports[key]}
                      onChange={(e) =>
                        setEnabledReports((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Google Drive folder ID">
              <input
                type="text"
                value={driveFolderId}
                onChange={(e) => setDriveFolderId(e.target.value)}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className={inputCls}
              />
            </Field>
          </Section>

          <div className="flex items-center justify-end gap-3 border-t border-rule pt-6">
            {saveMsg && (
              <span
                className={`mr-auto text-sm ${
                  saveMsg.kind === "ok" ? "text-brand-green" : "text-brand-red"
                }`}
              >
                {saveMsg.text}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-lg border border-rule bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Connections
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onTestSimpro}
              disabled={actioning}
              className="rounded-md border border-rule bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-warm disabled:opacity-50"
            >
              Test Simpro
            </button>
            {client.xero_connected ? (
              <>
                <button
                  type="button"
                  onClick={onTestXero}
                  disabled={actioning}
                  className="rounded-md border border-rule bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-warm disabled:opacity-50"
                >
                  Test Xero
                </button>
                <button
                  type="button"
                  onClick={onDisconnectXero}
                  disabled={actioning}
                  className="rounded-md border border-brand-red bg-white px-4 py-2 text-sm font-medium text-brand-red hover:bg-brand-red/10 disabled:opacity-50"
                >
                  Disconnect Xero
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onConnectXero}
                disabled={actioning}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
              >
                Connect Xero
              </button>
            )}
            <button
              type="button"
              onClick={onTestDrive}
              disabled={actioning || !driveFolderId}
              title={!driveFolderId ? "Set a Google Drive folder ID first." : undefined}
              className="rounded-md border border-rule bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-warm disabled:opacity-50"
            >
              Test Drive
            </button>
          </div>
          {connMsg && (
            <div
              className={`mt-4 rounded-md p-3 text-sm ${
                connMsg.kind === "ok" ? "bg-brand-green/10 text-brand-green" : "bg-brand-red/10 text-brand-red"
              }`}
            >
              {connMsg.text}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-rule bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
            Portal access
          </h2>
          <p className="mb-4 text-xs text-muted">
            Each owner gets their own magic-link invite. First click on the
            link creates the portal account; subsequent sign-ins use the
            standard magic-link flow at /login. To invite a new person, add
            their address to <strong>Owner emails</strong> above and save first.
          </p>
          {(() => {
            const owners = parseOwnerEmails(client.owner_emails);
            if (owners.length === 0) {
              return (
                <p className="text-sm text-muted italic">
                  No owner emails configured. Add at least one address above and save.
                </p>
              );
            }
            return (
              <ul className="divide-y divide-paper-cool rounded-md border border-rule">
                {owners.map((email) => (
                  <li
                    key={email}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="truncate text-sm text-ink">{email}</span>
                    <button
                      type="button"
                      onClick={() => onSendInvite(email)}
                      disabled={inviting}
                      className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
                    >
                      {inviting ? "Sending…" : "Send invite"}
                    </button>
                  </li>
                ))}
              </ul>
            );
          })()}
          {inviteMsg && (
            <div
              className={`mt-4 rounded-md p-3 text-sm ${
                inviteMsg.kind === "ok"
                  ? "bg-brand-green/10 text-brand-green"
                  : inviteMsg.kind === "info"
                  ? "bg-accent-soft text-accent-deep"
                  : "bg-brand-red/10 text-brand-red"
              }`}
            >
              {inviteMsg.text}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-rule bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Status
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onToggleActive}
              disabled={actioning}
              className="rounded-md border border-rule bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-warm disabled:opacity-50"
            >
              {client.active ? "Deactivate" : "Reactivate"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={actioning}
              className="rounded-md border border-brand-red bg-white px-4 py-2 text-sm font-medium text-brand-red hover:bg-brand-red/10 disabled:opacity-50"
            >
              Soft-delete
            </button>
          </div>
          {statusMsg && (
            <div
              className={`mt-4 rounded-md p-3 text-sm ${
                statusMsg.kind === "ok" ? "bg-brand-green/10 text-brand-green" : "bg-brand-red/10 text-brand-red"
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-md border border-rule px-3 py-2 text-sm focus:border-muted focus:outline-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

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
      <span className="mb-1 block text-sm font-medium text-ink-soft">
        {label} {required && <span className="text-brand-red">*</span>}
      </span>
      {children}
    </label>
  );
}
