import { createClient } from "@/lib/supabase/server";
import { api, type Client } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let clients: Client[] = [];
  let fetchError: string | null = null;
  try {
    clients = await api.listClients();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-600">
              Signed in as {user?.email ?? "unknown"}
            </p>
          </div>
          <Link
            href="/clients/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Add client
          </Link>
        </header>

        {fetchError && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            <strong>Backend error:</strong> {fetchError}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Simpro</th>
                <th className="px-4 py-3">Xero</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.length === 0 && !fetchError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No clients yet. Click <strong>Add client</strong> to onboard the first one.
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {c.business_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.owner_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.simpro_url ? "✅" : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.xero_tenant_id ? "✅" : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.active ? "✅" : "❌"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-sm font-medium text-slate-700 hover:text-slate-900"
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
