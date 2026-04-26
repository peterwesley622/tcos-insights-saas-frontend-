"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function Header({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isClients = pathname.startsWith("/clients");

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/clients" className="text-base font-bold text-slate-900">
            TCOS Insights
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link
              href="/clients"
              className={
                isClients
                  ? "font-semibold text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }
            >
              Clients
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {email && <span className="text-slate-500">{email}</span>}
          <button
            onClick={onSignOut}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
