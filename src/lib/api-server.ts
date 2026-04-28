import "server-only";

import { buildApi, type Api } from "./api";
import { createClient } from "./supabase/server";

/**
 * Build an API client for use inside server components / route handlers.
 * Reads the Supabase session from cookies and forwards the access token
 * as a bearer header on every request to the backend.
 */
export async function makeServerApi(): Promise<Api> {
  const supabase = await createClient();
  return buildApi(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  });
}
