"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sidebar - vertical navigation for both admin (/clients) and portal
 * (/portal) shells. Visually one component, two configurations.
 *
 * Layout:
 *  - Desktop (>= md): 240px fixed sidebar, always visible, content
 *    flows in the remaining width with its own scrolling.
 *  - Mobile (< md): sidebar lives in a drawer that slides in from the
 *    left when the hamburger toggle in the top bar is clicked. A
 *    backdrop dims the content behind. Selecting any nav link auto-
 *    closes the drawer so the user lands on the new page unobstructed.
 *
 * Per the brand guidelines:
 *  - Active nav item gets an orange (--accent) left bar + ink text
 *  - Inactive items: muted text, paper-warm hover bg
 *  - Brand wordmark uses the accent colour on "Insights"
 *  - Sign out button styled as .btn-secondary
 */

export type SidebarLink = {
  href: string;
  label: string;
  icon: ReactNode;
  /**
   * Optional exact-match override. By default a link is active when
   * the pathname starts with its href. Pass true for routes like
   * "/portal" where the index page would otherwise stay "active" for
   * every sub-route.
   */
  exact?: boolean;
};

export function Sidebar({
  links,
  homeHref,
  email,
  footerBadge,
  children,
}: {
  links: SidebarLink[];
  /** Where the brand wordmark links to - /clients for admin, /portal for client. */
  homeHref: string;
  email: string | null;
  /** Optional small chip rendered above the sign-out button - role badge or business name. */
  footerBadge?: ReactNode;
  /** The page content rendered to the right of the sidebar. */
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function isActive(link: SidebarLink) {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(link.href + "/");
  }

  // Shared nav body so the desktop sidebar and the mobile drawer render
  // identically.
  const navBody = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="border-b border-rule px-5 py-5">
        <Link
          href={homeHref}
          onClick={() => setOpen(false)}
          className="block text-base font-extrabold tracking-tight text-ink"
        >
          TCOS <span className="text-accent">Insights</span>
        </Link>
        <p className="mt-0.5 text-xs text-muted">by Better Back Office</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {links.map((link) => {
          const active = isActive(link);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={
                active
                  ? "relative flex items-center gap-3 rounded-md bg-paper-warm px-3 py-2 text-sm font-semibold text-ink"
                  : "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper-warm hover:text-ink"
              }
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent"
                />
              )}
              <span className="text-ink-soft">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: badge + email + sign out */}
      <div className="border-t border-rule px-4 py-4">
        {footerBadge && <div className="mb-3">{footerBadge}</div>}
        {email && (
          <p className="mb-3 truncate text-xs text-muted" title={email}>
            {email}
          </p>
        )}
        <button onClick={onSignOut} className="btn-secondary w-full text-sm">
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar - fixed 240px column on the left */}
      <aside className="hidden w-60 shrink-0 border-r border-rule bg-paper md:block">
        <div className="sticky top-0 h-screen">{navBody}</div>
      </aside>

      {/* Mobile top bar with hamburger + brand */}
      <div className="flex w-full flex-col md:hidden">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-paper px-4 py-3">
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-rule bg-white p-2 text-ink hover:bg-paper-warm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
                />
              )}
            </svg>
          </button>
          <Link href={homeHref} className="text-sm font-extrabold tracking-tight text-ink">
            TCOS <span className="text-accent">Insights</span>
          </Link>
          <span className="w-9" aria-hidden /> {/* spacer for symmetry */}
        </div>

        {/* Drawer + backdrop. Rendered with both elements always present
            so we can transition the open/close instead of mounting fresh. */}
        <div
          className={
            open
              ? "fixed inset-0 z-40 bg-ink/40 transition-opacity md:hidden"
              : "pointer-events-none fixed inset-0 z-40 bg-ink/0 transition-opacity md:hidden"
          }
          onClick={() => setOpen(false)}
        />
        <aside
          className={
            open
              ? "fixed left-0 top-0 z-50 h-full w-64 transform border-r border-rule bg-paper shadow-xl transition-transform duration-200 ease-out md:hidden"
              : "fixed left-0 top-0 z-50 h-full w-64 -translate-x-full transform border-r border-rule bg-paper shadow-xl transition-transform duration-200 ease-out md:hidden"
          }
        >
          {navBody}
        </aside>

        {/* Main content on mobile */}
        <main className="flex-1">{children}</main>
      </div>

      {/* Main content on desktop */}
      <main className="hidden flex-1 md:block">{children}</main>
    </div>
  );
}
