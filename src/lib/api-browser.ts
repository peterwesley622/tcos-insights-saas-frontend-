"use client";

import { useMemo } from "react";
import { buildApi, type Api } from "./api";
import { createClient } from "./supabase/client";

/**
 * React hook returning an API client that injects the current Supabase
 * access token on every request. The Supabase browser client manages
 * silent refresh in the background; we re-read the session per call so a
 * refreshed token is picked up automatically.
 */
export function useApi(): Api {
  return useMemo(() => {
    const supabase = createClient();
    return buildApi(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });
  }, []);
}
