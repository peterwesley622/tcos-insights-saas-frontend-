import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { type Principal } from "@/lib/api";
import { makeServerApi } from "@/lib/api-server";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pull role from the backend so the Header can render it AND so we can
  // bounce client-role users away from the admin UI to their own portal.
  // Best-effort: if /api/me hiccups we still render the page — the role is
  // metadata, not a security gate. Per-endpoint authorization on the
  // backend is what actually keeps a client from reading other clients'
  // data; this redirect is a UX nicety.
  let principal: Principal | null = null;
  if (user) {
    try {
      const api = await makeServerApi();
      principal = await api.me();
    } catch {
      principal = null;
    }
  }

  if (principal?.role === "client") {
    redirect("/portal");
  }

  return (
    <AdminSidebar email={user?.email ?? null} principal={principal}>
      {children}
    </AdminSidebar>
  );
}
