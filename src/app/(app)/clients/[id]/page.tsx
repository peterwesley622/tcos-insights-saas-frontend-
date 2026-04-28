"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Client, type ClientUpdate } from "@/lib/api";

export default function EditClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [connMsg, setConnMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [simproUrl, setSimproUrl] = useState("");
  const [newSimproKey, setNewSimproKey] = useState("");
  const [companyId, setCompanyId] = useState<number | "">("");
  const [gpLow, setGpLow] = useState<number | "">("");
  const [gpHigh, setGpHigh] = useState<number | "">("");
  const [siteWorkers, setSiteWorkers] = useState<number | "">("");
  const [wagesInOpex, setWagesInOpex] = useState(false);

  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    api
      .getClient(clientId)
      .then((c) => {
        setClient(c);
        setBusinessName(c.business_name);
        setOwnerName(c.owner_name ?? "");
        setOwnerEmail(c.owner_email ?? "");
        setSimproUrl(c.simpro_base_url ?? "");
        setCompanyId(c.simpro_company_id ?? "");
        setGpLow(c.gp_threshold_low ?? "");
        setGpHigh(c.gp_threshold_high ?? "");
        setSiteWorkers(c.num_site_workers ?? "");
        setWagesInOpex(Boolean(c.wages_in_opex));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [clientId]);

  function diffPatch(): ClientUpdate {
    if (!client) return {};
    const patch: ClientUpdate = {};
    if (businessName !== client.business_name) patch.business_name = businessName;
    if ((ownerName || null) !== client.owner_name) patch.owner_name = ownerName || null;
    if ((ownerEmail || null) !== client.owner_email) patch.owner_email = ownerEmail || null;
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

  async function onConnectXero() {
    if (!client) return;
    setActioning(true);
    setConnMsg(null);
    try {
      const res = await fetch(api.xeroConnectUrl(client.id), { cache: "no-store" });
      const json = await res.json();
      if (json.authorize_url) {
        window.location.href = json.authorize_url;
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
      <main className="min-h-screen bg-slate-50 p-8">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (error || !client) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-2xl">
          <Link href="/clients" className="text-sm text-slate-600 hover:text-slate-900">
            ← Back to clients
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
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{client.business_name}</h1>
            <p className="text-sm text-slate-500">
              ID {client.id} · {client.active ? "Active" : "Inactive"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/clients/${client.id}/reports`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reports →
            </Link>
            <Link
              href={`/clients/${client.id}/targets`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Targets →
            </Link>
            <Link
              href={`/clients/${client.id}/history`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              History →
            </Link>
            <Link href="/clients" className="text-sm text-slate-600 hover:text-slate-900">
              ← Back to clients
            </Link>
          </div>
        </div>

        <form onSubmit={onSave} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
            <Field label="Owner email">
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className={inputCls}
              />
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
                <span className="block text-sm font-medium text-slate-700">
                  Wages live in Operating Expenses (not Cost of Sales)
                </span>
                <span className="block text-xs text-slate-500">
                  Tick this for clients (e.g. LS Fencing) whose Xero chart of accounts puts
                  wages, super and worker&apos;s comp in OpEx. The scorecard then moves those
                  amounts out of Overheads and into Wages so both totals are correct.
                </span>
              </span>
            </label>
          </Section>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
            {saveMsg && (
              <span
                className={`mr-auto text-sm ${
                  saveMsg.kind === "ok" ? "text-green-700" : "text-red-700"
                }`}
              >
                {saveMsg.text}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Connections
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onTestSimpro}
              disabled={actioning}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Test Simpro
            </button>
            {client.xero_connected ? (
              <>
                <button
                  type="button"
                  onClick={onTestXero}
                  disabled={actioning}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Test Xero
                </button>
                <button
                  type="button"
                  onClick={onDisconnectXero}
                  disabled={actioning}
                  className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Disconnect Xero
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onConnectXero}
                disabled={actioning}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Connect Xero
              </button>
            )}
          </div>
          {connMsg && (
            <div
              className={`mt-4 rounded-md p-3 text-sm ${
                connMsg.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              {connMsg.text}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Status
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onToggleActive}
              disabled={actioning}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {client.active ? "Deactivate" : "Reactivate"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={actioning}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Soft-delete
            </button>
          </div>
          {statusMsg && (
            <div
              className={`mt-4 rounded-md p-3 text-sm ${
                statusMsg.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
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
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
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
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
