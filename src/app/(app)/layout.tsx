import { Header } from "@/components/Header";
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

  // Pull the role + client_id from the backend so the Header (and, in
  // a later PR, the route guard) can decide what to render. Best-effort:
  // if the backend hiccups for any reason we still render the page —
  // the role is metadata, not a security gate.
  let principal: Principal | null = null;
  if (user) {
    try {
      const api = await makeServerApi();
      principal = await api.me();
    } catch {
      principal = null;
    }
  }

  return (
    <>
      <Header email={user?.email ?? null} principal={principal} />
      {children}
    </>
  );
}
