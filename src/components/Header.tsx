"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type Principal } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export function Header({
  email,
  principal,
}: {
  email: string | null;
  principal: Principal | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isClients = pathname.startsWith("/clients");
  const isSystem = pathname.startsWith("/system");

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
            <Link
              href="/system"
              className={
                isSystem
                  ? "font-semibold text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }
            >
              System
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {principal?.role && <RoleBadge role={principal.role} />}
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

function RoleBadge({ role }: { role: string }) {
  // Lowercase tag with role-specific colour. Anything we don't recognise
  // gets a grey neutral so a typo or new role from the backend doesn't
  // crash the header.
  const palette: Record<string, { bg: string; text: string; label: string }> = {
    admin: { bg: "bg-slate-900", text: "text-white", label: "Admin" },
    client: { bg: "bg-blue-100", text: "text-blue-900", label: "Client" },
    service: { bg: "bg-amber-100", text: "text-amber-900", label: "Service" },
  };
  const palette_entry = palette[role.toLowerCase()] ?? {
    bg: "bg-slate-200",
    text: "text-slate-700",
    label: role,
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${palette_entry.bg} ${palette_entry.text}`}
    >
      {palette_entry.label}
    </span>
  );
}
