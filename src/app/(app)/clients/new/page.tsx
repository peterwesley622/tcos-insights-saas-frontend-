"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type SimproDetectResult } from "@/lib/api";
import { useApi } from "@/lib/api-browser";

export default function NewClientPage() {
  const router = useRouter();
  const api = useApi();

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [simproUrl, setSimproUrl] = useState("");
  const [simproKey, setSimproKey] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [gpLow, setGpLow] = useState(25);
  const [gpHigh, setGpHigh] = useState(45);
  const [siteWorkers, setSiteWorkers] = useState(1);
  const [wagesInOpex, setWagesInOpex] = useState(false);

  const [detectResult, setDetectResult] = useState<SimproDetectResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDetect() {
    setError(null);
    setDetecting(true);
    setDetectResult(null);
    try {
      const result = await api.detectSimproCompanies({
        simpro_base_url: simproUrl.trim(),
        simpro_api_key: simproKey.trim(),
      });
      setDetectResult(result);
      if (result.status === "detected") {
        setCompanyId(result.suggested_company_id);
      } else if (result.status === "multiple") {
        setCompanyId(result.companies[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetecting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (companyId == null) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.createClient({
        business_name: businessName.trim(),
        owner_name: ownerName.trim() || undefined,
        owner_email: ownerEmail.trim() || undefined,
        simpro_base_url: simproUrl.trim(),
        simpro_api_key: simproKey.trim(),
        simpro_company_id: companyId,
        gp_threshold_low: gpLow,
        gp_threshold_high: gpHigh,
        num_site_workers: siteWorkers,
        wages_in_opex: wagesInOpex,
      });
      router.push(`/clients/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  const canSubmit =
    businessName.trim().length > 0 &&
    simproUrl.trim().length > 0 &&
    simproKey.trim().length > 0 &&
    companyId != null &&
    detectResult?.status !== "error";

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Add client</h1>
          <Link href="/clients" className="text-sm text-slate-600 hover:text-slate-900">
            ← Back to clients
          </Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
            <Field label="Owner name (optional)">
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Defaults to business name if blank"
                className={inputCls}
              />
            </Field>
            <Field label="Owner email (optional)">
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="Where weekly reports go"
                className={inputCls}
              />
            </Field>
          </Section>

          <Section title="Simpro connection">
            <Field label="Simpro base URL" required>
              <input
                type="url"
                required
                value={simproUrl}
                onChange={(e) => {
                  setSimproUrl(e.target.value);
                  setDetectResult(null);
                  setCompanyId(null);
                }}
                placeholder="https://acme.simprosuite.com"
                className={inputCls}
              />
            </Field>
            <Field label="Simpro API key" required>
              <input
                type="password"
                required
                value={simproKey}
                onChange={(e) => {
                  setSimproKey(e.target.value);
                  setDetectResult(null);
                  setCompanyId(null);
                }}
                className={inputCls}
              />
            </Field>

            <button
              type="button"
              onClick={onDetect}
              disabled={detecting || !simproUrl.trim() || !simproKey.trim()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {detecting ? "Detecting…" : "Detect companies"}
            </button>

            {detectResult?.status === "detected" && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                ✅ Connected. Found <strong>{detectResult.companies[0]?.name}</strong> (ID {detectResult.suggested_company_id}).
              </div>
            )}

            {detectResult?.status === "multiple" && (
              <Field label="Pick the company to report on">
                <select
                  value={companyId ?? ""}
                  onChange={(e) => setCompanyId(Number(e.target.value))}
                  className={inputCls}
                >
                  {detectResult.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (ID {c.id})
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {detectResult?.status === "error" && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                ❌ {detectResult.error}
                {detectResult.details && (
                  <div className="mt-1 text-xs text-red-600">{detectResult.details}</div>
                )}
              </div>
            )}
          </Section>

          <Section title="Report parameters">
            <div className="grid grid-cols-2 gap-4">
              <Field label="GP threshold low (%)">
                <input
                  type="number"
                  step="0.1"
                  value={gpLow}
                  onChange={(e) => setGpLow(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="GP threshold high (%)">
                <input
                  type="number"
                  step="0.1"
                  value={gpHigh}
                  onChange={(e) => setGpHigh(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Field staff count">
              <input
                type="number"
                min={1}
                value={siteWorkers}
                onChange={(e) => setSiteWorkers(Number(e.target.value))}
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
                  Tick this for clients whose Xero chart of accounts puts wages, super and
                  worker&apos;s comp under OpEx instead of Cost of Sales. Leave unticked unless
                  you know otherwise.
                </span>
              </span>
            </label>
          </Section>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
            <Link
              href="/clients"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create client"}
            </button>
          </div>
        </form>
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
