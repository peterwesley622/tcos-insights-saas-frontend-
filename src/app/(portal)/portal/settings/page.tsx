"use client";

import { useEffect, useState } from "react";
import { type Client, type ClientUpdate } from "@/lib/api";
import { useApi } from "@/lib/api-browser";
import {
  EmailListInput,
  parseOwnerEmails,
  serializeOwnerEmails,
} from "@/components/EmailListInput";

/**
 * Combined "My Settings" + "Connect Xero" page. The brief lists them as
 * two distinct portal sections (4.3 Update email + Connect Xero one-click)
 * but they're both light enough to share a single page so a client never
 * has to wonder where to go to connect their accounting integration.
 */
export default function PortalSettingsPage() {
  const api = useApi();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable form state: the multi-owner emails list. Stored as a
  // semicolon-separated string on the backend, edited as an array of
  // input rows in the UI. Each address gets every report AND can sign
  // in to the portal.
  const [ownerEmailList, setOwnerEmailList] = useState<string[]>([""]);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Xero connection state messages
  const [xeroMsg, setXeroMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [xeroAction, setXeroAction] = useState(false);

  useEffect(() => {
    api
      .listClients()
      .then((list) => {
        const me = list[0] ?? null;
        setClient(me);
        if (me) {
          const parsed = parseOwnerEmails(me.owner_emails);
          // Always keep at least one row visible so there's somewhere
          // to type when the list is currently empty.
          setOwnerEmailList(parsed.length > 0 ? parsed : [""]);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api]);

  async function onSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    const patch: ClientUpdate = {};
    const serialized = serializeOwnerEmails(ownerEmailList);
    // Normalize the stored value the same way so trivial formatting
    // differences ("a@x; b@y" vs "a@x;b@y") don't trigger a no-op save.
    const storedNormalized = serializeOwnerEmails(parseOwnerEmails(client.owner_emails));
    if (serialized !== storedNormalized) {
      patch.owner_emails = serialized;
    }
    if (Object.keys(patch).length === 0) {
      setSaveMsg({ kind: "ok", text: "No changes to save." });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await api.updateClient(client.id, patch);
      setClient(updated);
      setSaveMsg({ kind: "ok", text: "Saved." });
    } catch (e) {
      setSaveMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function onConnectXero() {
    if (!client) return;
    setXeroAction(true);
    setXeroMsg(null);
    try {
      const { authorize_url } = await api.xeroConnectAuthorizeUrl(client.id);
      if (authorize_url) {
        window.location.href = authorize_url;
      } else {
        setXeroMsg({ kind: "err", text: "Couldn't get the Xero connect URL — try again." });
      }
    } catch (e) {
      setXeroMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setXeroAction(false);
    }
  }

  async function onDisconnectXero() {
    if (!client) return;
    if (!confirm("Disconnect Xero? Your Monday scorecard report won't run until you reconnect.")) return;
    setXeroAction(true);
    setXeroMsg(null);
    try {
      await api.disconnectXero(client.id);
      const fresh = await api.getClient(client.id);
      setClient(fresh);
      setXeroMsg({ kind: "ok", text: "Disconnected from Xero." });
    } catch (e) {
      setXeroMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setXeroAction(false);
    }
  }

  async function onTestXero() {
    if (!client) return;
    setXeroAction(true);
    setXeroMsg(null);
    try {
      const r = await api.testXero(client.id);
      if (r.status === "connected") {
        setXeroMsg({ kind: "ok", text: `Connected to Xero — ${r.organisation}` });
      } else {
        setXeroMsg({ kind: "err", text: `Xero says: ${r.message}` });
      }
    } catch (e) {
      setXeroMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setXeroAction(false);
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
        <div className="mx-auto max-w-3xl rounded-md bg-brand-red/10 p-4 text-sm text-brand-red">
          {error ?? "Couldn't load your account."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper-warm p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-ink">Your settings</h1>
          <p className="text-sm text-muted">
            Update where reports are sent and connect your Xero account.
          </p>
        </header>

        {/* Email settings */}
        <form
          onSubmit={onSaveSettings}
          className="space-y-4 rounded-lg border border-rule bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Where to send reports
          </h2>
          <div>
            <span className="mb-1 block text-sm font-medium text-ink-soft">
              Recipient emails
            </span>
            <EmailListInput
              values={ownerEmailList}
              onChange={setOwnerEmailList}
            />
            <span className="mt-2 block text-xs text-muted">
              We send your weekly Monday reports to every address listed
              here. Each one can also sign in to this portal. Click{" "}
              <strong>Add another email</strong> to add more recipients,
              the trash icon to remove one. Changes take effect on the next
              Monday run.
            </span>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-rule pt-4">
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

        {/* Xero connection */}
        <section className="rounded-lg border border-rule bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Xero connection
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                client.xero_connected
                  ? "bg-brand-green/15 text-brand-green"
                  : "bg-brand-amber/15 text-brand-amber"
              }`}
            >
              {client.xero_connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="mb-4 text-sm text-ink-soft">
            {client.xero_connected
              ? "Your Xero account is connected. We use it to build the weekly financial scorecard report (revenue / GP / net profit vs your targets)."
              : "Connect your Xero account so we can include the financial scorecard in your weekly reports. Without Xero, you'll only get the labour and quote-follow-up reports."}
          </p>
          <div className="flex flex-wrap gap-3">
            {client.xero_connected ? (
              <>
                <button
                  type="button"
                  onClick={onTestXero}
                  disabled={xeroAction}
                  className="rounded-md border border-rule bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-warm disabled:opacity-50"
                >
                  Test connection
                </button>
                <button
                  type="button"
                  onClick={onDisconnectXero}
                  disabled={xeroAction}
                  className="rounded-md border border-brand-red bg-white px-4 py-2 text-sm font-medium text-brand-red hover:bg-brand-red/10 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onConnectXero}
                disabled={xeroAction}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
              >
                {xeroAction ? "Redirecting…" : "Connect Xero"}
              </button>
            )}
          </div>
          {xeroMsg && (
            <div
              className={`mt-4 rounded-md p-3 text-sm ${
                xeroMsg.kind === "ok"
                  ? "bg-brand-green/10 text-brand-green"
                  : "bg-brand-red/10 text-brand-red"
              }`}
            >
              {xeroMsg.text}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
