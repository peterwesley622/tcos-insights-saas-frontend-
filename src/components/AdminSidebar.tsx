"use client";

import { type Principal } from "@/lib/api";
import { Sidebar, type SidebarLink } from "@/components/Sidebar";

/**
 * Admin shell - sidebar configured for the BBO operator UI. Two top-level
 * destinations today (Clients, System); the rest of the admin UX lives
 * inside individual client pages.
 */

const ADMIN_LINKS: SidebarLink[] = [
  {
    href: "/clients",
    label: "Clients",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: "/prospects",
    label: "Prospects",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: "/system",
    label: "System",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
];

export function AdminSidebar({
  email,
  principal,
  children,
}: {
  email: string | null;
  principal: Principal | null;
  children: React.ReactNode;
}) {
  const badge = principal?.role ? <RoleBadge role={principal.role} /> : null;
  return (
    <Sidebar
      links={ADMIN_LINKS}
      homeHref="/clients"
      email={email}
      footerBadge={badge}
    >
      {children}
    </Sidebar>
  );
}

function RoleBadge({ role }: { role: string }) {
  // Brand-aligned role chip. Admin = dark ink (authority); client = accent
  // soft (warm context); service = muted (system actor). Anything else
  // falls through to a neutral rule-bordered chip.
  const palette: Record<string, { bg: string; text: string; label: string }> = {
    admin: { bg: "bg-ink", text: "text-white", label: "Admin" },
    client: { bg: "bg-accent-soft", text: "text-accent-deep", label: "Client" },
    service: { bg: "bg-paper-cool", text: "text-ink-soft", label: "Service" },
  };
  const entry = palette[role.toLowerCase()] ?? {
    bg: "bg-paper-warm",
    text: "text-ink-soft",
    label: role,
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${entry.bg} ${entry.text}`}
    >
      {entry.label}
    </span>
  );
}
