import { type Client } from "@/lib/api";
import { makeServerApi } from "@/lib/api-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  let clients: Client[] = [];
  let fetchError: string | null = null;
  try {
    const api = await makeServerApi();
    clients = await api.listClients();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="min-h-screen bg-paper-warm p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">Clients</h1>
          <Link
            href="/clients/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep"
          >
            Add client
          </Link>
        </header>

        {fetchError && (
          <div className="mb-4 rounded-md bg-brand-red/10 p-4 text-sm text-brand-red">
            <strong>Backend error:</strong> {fetchError}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <table className="min-w-full divide-y divide-rule text-sm">
            <thead className="bg-paper-warm text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Simpro</th>
                <th className="px-4 py-3">Xero</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-cool">
              {clients.length === 0 && !fetchError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No clients yet. Click <strong>Add client</strong> to onboard the first one.
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-paper-warm">
                  <td className="px-4 py-3 font-medium text-ink">
                    {c.business_name}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{c.owner_name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {c.simpro_base_url ? "✅" : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {c.xero_connected ? "✅" : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {c.active ? "✅" : "❌"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-sm font-medium text-ink-soft hover:text-ink"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
