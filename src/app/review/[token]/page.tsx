"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
  simpro_connected: boolean;
  xero_connected: boolean;
  intake_completed_at: string | null;
};

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  return url;
}

export default function PublicIntakePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [prospect, setProspect] = useState<PublicProspect | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [systems, setSystems] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

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

  // Once intake is in, jump to the next-step screen. Day 3 turns the
  // placeholder buttons into real Connect Simpro / Connect Xero OAuth
  // launchers; for Day 2 they're labelled "coming soon".
  if (prospect.status !== "pending_intake") {
    return (
      <Shell>
        <ConnectScreen prospect={prospect} />
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

function ConnectScreen({ prospect }: { prospect: PublicProspect }) {
  return (
    <div className="card mx-auto max-w-2xl p-8">
      <p className="eyebrow mb-3">STEP 2 OF 2 — CONNECT YOUR SYSTEMS</p>
      <h1 className="mb-2 text-3xl font-bold text-ink">
        Thanks, {prospect.business_name ?? "—"}
      </h1>
      <p className="mb-6 text-base text-ink-soft">
        Now connect Simpro and Xero so we can pull the data for your
        review. Both are <strong>read-only</strong>; we don&apos;t write
        anything back to your systems.
      </p>

      <div className="space-y-3">
        <ConnectButton
          label="Connect Simpro"
          connected={prospect.simpro_connected}
          disabled
        />
        <ConnectButton
          label="Connect Xero"
          connected={prospect.xero_connected}
          disabled
        />
      </div>

      <div className="mt-6 rounded-md border border-accent-soft bg-accent-soft/30 p-4 text-sm text-ink-soft">
        <strong className="text-ink">Coming soon:</strong> these buttons go
        live in the next deploy. For now your intake is saved and Better
        Back Office has been notified — they&apos;ll reach out with the
        connection step.
      </div>
    </div>
  );
}

function ConnectButton({
  label,
  connected,
  disabled,
}: {
  label: string;
  connected: boolean;
  disabled?: boolean;
}) {
  if (connected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-brand-green bg-brand-green/10 px-4 py-3">
        <span className="font-medium text-brand-green">{label} — connected ✓</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      className="w-full rounded-md bg-accent px-4 py-3 text-left text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
    >
      {label} <span className="opacity-70 text-xs">(coming soon)</span> →
    </button>
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
