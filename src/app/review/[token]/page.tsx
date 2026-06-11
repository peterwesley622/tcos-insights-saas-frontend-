"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/**
 * Public self-serve review intake page.
 *
 * Lives outside both (app)/ and (portal)/ route groups so it doesn't
 * inherit the auth + sidebar layouts — prospects are not signed in.
 * Only the root layout applies, which gives us the brand body styling.
 *
 * Two screens in v1:
 *   1. Intake form (business + contact + trade + systems in use)
 *   2. "Step 2: connect your systems" placeholder — Day 3 fills this in
 *      with the real Connect Simpro / Connect Xero OAuth buttons.
 *
 * No Authorization header on requests — the intake_token in the URL is
 * the access grant. Calls go to /api/public/prospects/{token}*.
 */

const TRADE_TYPES = [
  "Electrical",
  "Plumbing",
  "HVAC",
  "Civil",
  "Building",
  "Fencing",
  "Fire",
  "Other",
];

const SYSTEMS = [
  "Simpro",
  "Xero",
  "AroFlo",
  "ServiceM8",
  "Tradify",
  "Fergus",
  "Buildxact",
  "MYOB",
  "QuickBooks",
];

type PublicProspect = {
  intake_token: string;
  status: string;
  business_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  trade_type: string | null;
  systems_in_use: string | null;
  simpro_base_url: string | null;
  simpro_company_id: number | null;
  simpro_connected: boolean;
  xero_connected: boolean;
  simpro_oauth_companies: { id: number; name: string }[] | null;
  intake_completed_at: string | null;
};

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  return url;
}

export default function PublicIntakePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = params.token;

  const [prospect, setProspect] = useState<PublicProspect | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [systems, setSystems] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Surface ?simpro=… / ?xero=… banners set by the OAuth callbacks,
  // then strip the query so a refresh doesn't re-show stale state.
  useEffect(() => {
    if (!searchParams) return;
    const xero = searchParams.get("xero");
    const simpro = searchParams.get("simpro");
    if (!xero && !simpro) return;
    if (xero === "connected") {
      const tenant = searchParams.get("tenant") || "";
      setBanner({
        kind: "ok",
        text: tenant ? `Xero connected — ${tenant}.` : "Xero connected.",
      });
    } else if (xero === "error") {
      const detail = searchParams.get("detail") || "unknown error";
      setBanner({ kind: "err", text: `Xero connect failed: ${detail}` });
    } else if (simpro === "pick") {
      setBanner({
        kind: "ok",
        text: "Simpro authorised — pick a company below to finish.",
      });
    } else if (simpro === "error") {
      const detail = searchParams.get("detail") || "unknown error";
      setBanner({ kind: "err", text: `Simpro connect failed: ${detail}` });
    }
    router.replace(`/review/${token}`);
  }, [searchParams, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${getApiBaseUrl()}/api/public/prospects/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("not_found");
          if (res.status === 410) throw new Error("expired");
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as PublicProspect;
      })
      .then((p) => {
        setProspect(p);
        setBusinessName(p.business_name ?? "");
        setContactName(p.contact_name ?? "");
        setContactEmail(p.contact_email ?? "");
        setContactPhone(p.contact_phone ?? "");
        setTradeType(p.trade_type ?? "");
        const initial: Record<string, boolean> = {};
        (p.systems_in_use ?? "").split(",").forEach((s) => {
          const t = s.trim();
          if (t) initial[t] = true;
        });
        setSystems(initial);
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const systemsList = Object.entries(systems)
        .filter(([, on]) => on)
        .map(([name]) => name)
        .join(", ");
      const res = await fetch(
        `${getApiBaseUrl()}/api/public/prospects/${token}/intake`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business_name: businessName.trim(),
            contact_name: contactName.trim() || null,
            contact_email: contactEmail.trim(),
            contact_phone: contactPhone.trim() || null,
            trade_type: tradeType || null,
            systems_in_use: systemsList || null,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
      }
      const updated = (await res.json()) as PublicProspect;
      setProspect(updated);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-ink-soft">Loading…</p>
      </Shell>
    );
  }

  if (loadErr === "not_found") {
    return (
      <Shell>
        <ErrorCard
          title="This link isn't valid"
          body="The intake link you opened wasn't found. It may have been mistyped or revoked. Contact Better Back Office for a fresh link."
        />
      </Shell>
    );
  }
  if (loadErr === "expired") {
    return (
      <Shell>
        <ErrorCard
          title="This link has expired"
          body="Intake links expire for security. Contact Better Back Office for a fresh link."
        />
      </Shell>
    );
  }
  if (loadErr) {
    return (
      <Shell>
        <ErrorCard title="Something went wrong" body={loadErr} />
      </Shell>
    );
  }
  if (!prospect) return null;

  // Once intake is in, jump to the connect screen with real OAuth.
  if (prospect.status !== "pending_intake") {
    return (
      <Shell>
        {banner && (
          <div
            className={`mx-auto mb-4 max-w-2xl rounded-md p-3 text-sm ${
              banner.kind === "ok"
                ? "bg-brand-green/10 text-brand-green"
                : "bg-brand-red/10 text-brand-red"
            }`}
          >
            {banner.text}
          </div>
        )}
        <ConnectScreen
          prospect={prospect}
          token={token}
          onProspectUpdate={(p) => setProspect(p)}
          onError={(text) => setBanner({ kind: "err", text })}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="card mx-auto max-w-2xl p-8">
        <p className="eyebrow mb-3">STEP 1 OF 2 — YOUR DETAILS</p>
        <h1 className="mb-2 text-3xl font-bold text-ink">
          Tell us about your business
        </h1>
        <p className="mb-6 text-base text-ink-soft">
          Better Back Office is preparing a Simpro + Xero financial review for
          you. Fill in the basics below — it takes ~60 seconds. The next
          step connects your systems (read-only) so we can pull the data
          we need.
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Business name" required>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className={inputCls}
              autoComplete="organization"
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Your name">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={inputCls}
                autoComplete="name"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={inputCls}
                autoComplete="email"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Phone (optional)">
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className={inputCls}
                autoComplete="tel"
              />
            </Field>
            <Field label="Trade type">
              <select
                value={tradeType}
                onChange={(e) => setTradeType(e.target.value)}
                className={inputCls}
              >
                <option value="">Pick one…</option>
                {TRADE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Which systems do you run?">
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
              {SYSTEMS.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 text-sm text-ink-soft"
                >
                  <input
                    type="checkbox"
                    checked={!!systems[s]}
                    onChange={(e) =>
                      setSystems((prev) => ({ ...prev, [s]: e.target.checked }))
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Tick everything you currently use. We only connect to Simpro and
              Xero for this review — read-only.
            </p>
          </Field>

          {saveErr && (
            <div className="rounded-md bg-brand-red/10 p-3 text-sm text-brand-red">
              {saveErr}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-rule pt-6">
            <button
              type="submit"
              disabled={saving || !businessName.trim() || !contactEmail.trim()}
              className="btn-accent"
            >
              {saving ? "Saving…" : "Continue to step 2 →"}
            </button>
          </div>
        </form>

        <ReassuranceBlock />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-paper px-4 py-10 md:py-16">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <p className="text-base font-extrabold tracking-tight text-ink">
          TCOS <span className="text-accent">Insights</span>
        </p>
        <p className="text-xs text-muted">by Better Back Office</p>
      </div>
      {children}
    </main>
  );
}

function ConnectScreen({
  prospect,
  token,
  onProspectUpdate,
  onError,
}: {
  prospect: PublicProspect;
  token: string;
  onProspectUpdate: (p: PublicProspect) => void;
  onError: (text: string) => void;
}) {
  const allConnected = prospect.simpro_connected && prospect.xero_connected;
  return (
    <div className="card mx-auto max-w-2xl p-8">
      <p className="eyebrow mb-3">STEP 2 OF 2 — CONNECT YOUR SYSTEMS</p>
      <h1 className="mb-2 text-3xl font-bold text-ink">
        Thanks, {prospect.business_name ?? "—"}
      </h1>
      <p className="mb-6 text-base text-ink-soft">
        Now connect Simpro and Xero so we can pull the data for your
        review. Both are <strong>read-only</strong> — we don&apos;t write
        anything back to your systems, and tokens are revoked once your
        review is delivered.
      </p>

      <div className="space-y-4">
        <SimproConnectCard
          prospect={prospect}
          token={token}
          onProspectUpdate={onProspectUpdate}
          onError={onError}
        />
        <XeroConnectCard
          prospect={prospect}
          token={token}
          onError={onError}
        />
      </div>

      {allConnected && (
        <div className="mt-6 rounded-md border border-brand-green/40 bg-brand-green/10 p-4 text-sm text-ink-soft">
          <strong className="text-brand-green">All systems connected.</strong>{" "}
          Better Back Office will run your review and email you when it&apos;s
          ready — usually within a couple of business days.
        </div>
      )}
    </div>
  );
}

function SimproConnectCard({
  prospect,
  token,
  onProspectUpdate,
  onError,
}: {
  prospect: PublicProspect;
  token: string;
  onProspectUpdate: (p: PublicProspect) => void;
  onError: (text: string) => void;
}) {
  const [buildUrl, setBuildUrl] = useState(prospect.simpro_base_url ?? "");
  const [busy, setBusy] = useState(false);
  const pending = prospect.simpro_oauth_companies;
  const connected =
    prospect.simpro_connected && prospect.simpro_company_id != null;

  async function onSetUrlAndConnect() {
    if (!buildUrl.trim()) {
      onError("Enter your Simpro Build URL first.");
      return;
    }
    let normalised = buildUrl.trim();
    if (!normalised.startsWith("http://") && !normalised.startsWith("https://")) {
      normalised = `https://${normalised}`;
    }
    setBusy(true);
    try {
      // Save the URL on the Prospect row, then fetch the authorize URL.
      const urlRes = await fetch(
        `${getApiBaseUrl()}/api/public/prospects/${token}/simpro/url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simpro_base_url: normalised }),
        },
      );
      if (!urlRes.ok) {
        throw new Error(`Couldn't save Build URL (${urlRes.status})`);
      }
      const authRes = await fetch(
        `${getApiBaseUrl()}/api/public/prospects/${token}/simpro/connect`,
      );
      if (!authRes.ok) {
        const body = await authRes.text().catch(() => "");
        throw new Error(`Couldn't start Simpro OAuth (${authRes.status}): ${body}`);
      }
      const { authorize_url } = (await authRes.json()) as { authorize_url: string };
      window.location.href = authorize_url;
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function onPickCompany(companyId: number) {
    setBusy(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/public/prospects/${token}/simpro/select-company`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_id: companyId }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status}: ${body}`);
      }
      const updated = (await res.json()) as PublicProspect;
      onProspectUpdate(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (connected) {
    return (
      <div className="rounded-md border border-brand-green bg-brand-green/10 px-4 py-3">
        <p className="font-medium text-brand-green">Simpro connected ✓</p>
        <p className="text-xs text-ink-soft">
          Build: {prospect.simpro_base_url} · Company ID: {prospect.simpro_company_id}
        </p>
      </div>
    );
  }

  if (pending && pending.length > 0) {
    return (
      <div className="rounded-md border border-accent-soft bg-accent-soft/30 p-4">
        <p className="mb-1 text-sm font-semibold text-ink">
          Pick a Simpro company
        </p>
        <p className="mb-3 text-xs text-ink-soft">
          Simpro returned the following companies for your account. Pick the
          one this review should cover.
        </p>
        <ul className="space-y-1">
          {pending.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => onPickCompany(c.id)}
                disabled={busy}
                className="rounded-md border border-rule bg-white px-2 py-0.5 text-xs font-semibold text-ink hover:bg-paper-warm disabled:opacity-50"
              >
                Use this one
              </button>
              <span className="text-ink-soft">
                {c.name} <span className="text-muted">(ID {c.id})</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-rule bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-ink">Connect Simpro</p>
      <p className="mb-3 text-xs text-ink-soft">
        Enter your Simpro Build URL (the address you visit to log into Simpro,
        e.g. <code className="rounded bg-paper-warm px-1 py-0.5">yourname.simprosuite.com</code>).
        We&apos;ll send you to Simpro to authorise, then bring you back here.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={buildUrl}
          onChange={(e) => setBuildUrl(e.target.value)}
          placeholder="yourname.simprosuite.com"
          className="flex-1 min-w-0 rounded-md border border-rule px-3 py-2 text-sm focus:border-muted focus:outline-none"
        />
        <button
          type="button"
          onClick={onSetUrlAndConnect}
          disabled={busy || !buildUrl.trim()}
          className="btn-accent shrink-0"
        >
          {busy ? "Connecting…" : "Connect Simpro"}
        </button>
      </div>
    </div>
  );
}

function XeroConnectCard({
  prospect,
  token,
  onError,
}: {
  prospect: PublicProspect;
  token: string;
  onError: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onConnect() {
    setBusy(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/public/prospects/${token}/xero/connect`,
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Couldn't start Xero OAuth (${res.status}): ${body}`);
      }
      const { authorize_url } = (await res.json()) as { authorize_url: string };
      window.location.href = authorize_url;
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (prospect.xero_connected) {
    return (
      <div className="rounded-md border border-brand-green bg-brand-green/10 px-4 py-3">
        <p className="font-medium text-brand-green">Xero connected ✓</p>
        <p className="text-xs text-ink-soft">
          We&apos;ll use this Xero organisation for the review.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-rule bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-ink">Connect Xero</p>
      <p className="mb-3 text-xs text-ink-soft">
        We&apos;ll send you to Xero to sign in and approve read-only access.
        After approving, you&apos;ll come straight back to this page.
      </p>
      <button
        type="button"
        onClick={onConnect}
        disabled={busy}
        className="btn-accent w-full"
      >
        {busy ? "Connecting…" : "Connect Xero"}
      </button>
    </div>
  );
}

function ReassuranceBlock() {
  return (
    <div className="mt-8 border-t border-rule pt-6 text-xs leading-relaxed text-muted">
      <p>
        <strong className="text-ink-soft">What we&apos;ll access:</strong>{" "}
        only the reports needed to prepare your financial review — jobs,
        quotes, P&amp;L and the like. Read-only — we don&apos;t change
        anything in your Simpro or Xero.
      </p>
      <p className="mt-2">
        <strong className="text-ink-soft">What we won&apos;t do:</strong>{" "}
        share your data, sell it, or contact your customers. Tokens are
        encrypted at rest and revoked after your review is delivered.
      </p>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-rule px-3 py-2 text-sm focus:border-muted focus:outline-none";

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

function ErrorCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="mb-2 text-2xl font-bold text-ink">{title}</h1>
      <p className="text-sm text-ink-soft">{body}</p>
    </div>
  );
}
