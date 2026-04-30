"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Header for the client-facing portal. Visually parallel to the admin
 * Header but with a different nav set (Dashboard / Connect Xero / Targets /
 * Reports / Settings) and no admin-only links.
 */
export function PortalHeader({
  email,
  businessName,
}: {
  email: string | null;
  businessName: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const links: { href: string; label: string }[] = [
    { href: "/portal", label: "Dashboard" },
    { href: "/portal/reports", label: "Reports" },
    { href: "/portal/targets", label: "Targets" },
    { href: "/portal/settings", label: "Settings" },
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/portal" className="text-base font-bold text-slate-900">
            TCOS Insights
          </Link>
          <nav className="flex gap-6 text-sm">
            {links.map((l) => {
              const isActive =
                l.href === "/portal"
                  ? pathname === "/portal"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    isActive
                      ? "font-semibold text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {businessName && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
              {businessName}
            </span>
          )}
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
