import { redirect } from "next/navigation";
import { PortalHeader } from "@/components/PortalHeader";
import { type Client, type Principal } from "@/lib/api";
import { makeServerApi } from "@/lib/api-server";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout that wraps every /portal/* route. Server component — runs the
 * principal lookup and (in PR 4) the role-routing logic before rendering
 * any portal page, so the user's first byte is already a correct page
 * for their role.
 *
 * proxy.ts also redirects clients to /portal and admins away from it,
 * but proxy runs on every request even for static files; this layout-
 * level guard is the second line of defence against a misconfigured
 * proxy and reads cleaner in stack traces.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const api = await makeServerApi();
  let principal: Principal | null = null;
  try {
    principal = await api.me();
  } catch {
    principal = null;
  }

  // Admin/service users don't belong here — kick them back to the admin UI.
  if (principal && principal.role !== "client") {
    redirect("/clients");
  }

  // Pull the client's own row so the header can show their business name.
  // The list endpoint is filtered server-side to just-this-client when the
  // caller is a client role, so a single-element list is what we expect.
  let myClient: Client | null = null;
  try {
    const list = await api.listClients();
    myClient = list[0] ?? null;
  } catch {
    myClient = null;
  }

  return (
    <>
      <PortalHeader
        email={user.email ?? null}
        businessName={myClient?.business_name ?? null}
      />
      {children}
    </>
  );
}
