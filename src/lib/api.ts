function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return url;
}

export type Client = {
  id: number;
  business_name: string;
  owner_name: string | null;
  owner_emails: string | null;
  simpro_base_url: string | null;
  simpro_api_key_masked: string | null;
  simpro_company_id: number | null;
  num_site_workers: number | null;
  gp_threshold_low: number | null;
  gp_threshold_high: number | null;
  wages_in_opex: boolean;
  cc_emails: string | null;
  enabled_reports: string;
  drive_folder_id: string | null;
  active: boolean | null;
  xero_connected: boolean;
  xero_tenant_id: string | null;
  // OAuth-specific Simpro state. simpro_connected mirrors the backend
  // check "has refresh_token AND non-zero company_id". simpro_oauth_companies
  // is non-null only between the OAuth callback and the admin picking
  // a company in the picker.
  simpro_connected: boolean;
  simpro_oauth_companies: { id: number; name: string }[] | null;
};

export type ClientCreate = {
  business_name: string;
  owner_name?: string | null;
  owner_emails?: string | null;
  // Simpro is optional — leave both blank for Xero-only clients. The
  // backend's scheduler will skip the Simpro labour + Quote Follow-up
  // reports for them automatically.
  simpro_base_url?: string | null;
  simpro_api_key?: string | null;
  simpro_company_id?: number;
  num_site_workers?: number | null;
  gp_threshold_low?: number | null;
  gp_threshold_high?: number | null;
  wages_in_opex?: boolean;
};

export type ClientUpdate = Partial<{
  business_name: string;
  owner_name: string | null;
  owner_emails: string | null;
  simpro_base_url: string | null;
  simpro_api_key: string | null;
  simpro_company_id: number | null;
  num_site_workers: number | null;
  gp_threshold_low: number | null;
  gp_threshold_high: number | null;
  wages_in_opex: boolean;
  cc_emails: string | null;
  enabled_reports: string;
  drive_folder_id: string | null;
  active: boolean | null;
}>;

export type SimproCompany = { id: number; name: string };

export type SimproDetectResult =
  | { status: "detected"; companies: SimproCompany[]; suggested_company_id: number }
  | { status: "multiple"; companies: SimproCompany[] }
  | { status: "error"; error: string; details?: string };

export type Target = {
  id: number;
  client_id: number;
  period_start: string;
  period_end: string | null;
  revenue: number;
  materials: number;
  subcontractors: number;
  wages: number;
  gross_profit: number;
  overheads: number;
  net_profit: number;
  rev_per_worker: number;
};

export type TargetCreate = {
  // Optional in the rolling-forward model: omit both period fields and
  // the backend treats this POST as "set the new standing target",
  // auto-closing any open target on the same client. Pass explicit
  // dates only when backfilling historical entries.
  period_start?: string;
  period_end?: string | null;
  revenue?: number;
  materials?: number;
  subcontractors?: number;
  wages?: number;
  gross_profit?: number;
  overheads?: number;
  net_profit?: number;
  rev_per_worker?: number;
};

export type TargetUpdate = Partial<TargetCreate>;

export type ReportLog = {
  id: number;
  client_id: number;
  report_type: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  // Drive web view link populated when the report HTML was successfully
  // archived. Null for rows from before Drive archiving was set up,
  // failed archives, or non-success statuses. UI renders an "Open" link
  // only when this is truthy.
  archive_url: string | null;
  // True when the backend has the rendered HTML stored alongside this
  // log row (every successful send after 2026-05-13). The UI uses this
  // to decide whether to render the "View" button.
  has_html: boolean;
};

export type ReportSendResult = {
  client_id: number;
  status: "sent" | "failed" | "dry_run" | string;
  message?: string;
  error?: string;
};

export type Prospect = {
  id: number;
  intake_token: string;
  intake_token_expires_at: string | null;
  status: string;
  notes: string | null;
  business_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  trade_type: string | null;
  systems_in_use: string | null;
  simpro_connected: boolean;
  xero_connected: boolean;
  simpro_base_url: string | null;
  xero_tenant_id: string | null;
  drive_folder_id: string | null;
  analysis_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  intake_completed_at: string | null;
  simpro_connected_at: string | null;
  xero_connected_at: string | null;
  analysed_at: string | null;
  delivered_at: string | null;
};

export type ProspectCreate = {
  notes?: string;
  expires_in_days?: number;
};

export type Principal = {
  sub: string | null;
  email: string | null;
  role: "admin" | "client" | "service" | string;
  client_id: number | null;
};

export type GetAccessToken = () => Promise<string | null>;

export type Api = ReturnType<typeof buildApi>;

/**
 * Construct an API client bound to a token-fetcher. Each request awaits
 * `getAccessToken()` and attaches `Authorization: Bearer <token>` if it
 * resolves to a non-null string. The fetcher is invoked per request so a
 * silently-refreshed Supabase session is picked up on the next call.
 */
export function buildApi(getAccessToken: GetAccessToken) {
  async function buildHeaders(extra?: HeadersInit): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(extra as Record<string, string> | undefined),
    };
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: await buildHeaders(init.headers),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async function requestText(path: string, init: RequestInit = {}): Promise<string> {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: await buildHeaders(init.headers),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
    }
    return res.text();
  }

  return {
    health: () => request<{ status: string }>("/health"),
    me: () => request<Principal>("/api/me"),
    listClients: () => request<Client[]>("/api/clients"),
    detectSimproCompanies: (body: { simpro_base_url: string; simpro_api_key: string }) =>
      request<SimproDetectResult>("/api/simpro/detect-companies", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getClient: (id: number) => request<Client>(`/api/clients/${id}`),
    createClient: (body: ClientCreate) =>
      request<Client>("/api/clients", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateClient: (id: number, body: ClientUpdate) =>
      request<Client>(`/api/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteClient: (id: number) =>
      request<void>(`/api/clients/${id}`, { method: "DELETE" }),
    /**
     * Hard-delete a client — removes the client row plus every Target
     * and ReportLog that references them. Destructive and irreversible.
     * The corresponding /api/clients/{id} (soft delete) only sets
     * active=False; this endpoint actually wipes the rows.
     */
    purgeClient: (id: number) =>
      request<{
        status: string;
        client_id: number;
        deleted: { targets: number; report_logs: number; client: number };
      }>(`/api/clients/${id}/purge`, { method: "DELETE" }),

    // ----- Self-serve review (Prospect) endpoints -----
    listProspects: () => request<Prospect[]>("/api/prospects"),
    getProspect: (id: number) => request<Prospect>(`/api/prospects/${id}`),
    createProspect: (body: ProspectCreate) =>
      request<Prospect>("/api/prospects", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    purgeProspect: (id: number) =>
      request<{ status: string; prospect_id: number }>(
        `/api/prospects/${id}`,
        { method: "DELETE" },
      ),
    testSimpro: (id: number) =>
      request<{
        client_id: number;
        companies_endpoint: { ok: boolean; error: string | null };
        jobs_endpoint: { status: string; message?: string };
      }>(`/api/clients/${id}/test-simpro`, { method: "POST" }),
    testXero: (id: number) =>
      request<
        | { status: "connected"; organisation: string; tenant_id: string }
        | { status: "error"; message: string }
      >(`/api/clients/${id}/test-xero`, { method: "POST" }),
    testDrive: (id: number) =>
      request<
        | { status: "ok"; folder_name: string; service_account_email?: string }
        | { status: "disabled"; error: string }
        | { status: "not_found"; error: string; service_account_email?: string }
        | { status: "failed"; error: string }
      >(`/api/clients/${id}/test-drive`, { method: "POST" }),
    xeroConnectUrl: (id: number) =>
      `${getApiBaseUrl()}/api/clients/${id}/xero/connect`,
    /**
     * Fetch the Xero authorize URL using the user's bearer token. Returns the
     * URL so the caller can `window.location.href = ...` it.
     */
    xeroConnectAuthorizeUrl: (id: number) =>
      request<{ authorize_url: string }>(`/api/clients/${id}/xero/connect`),
    disconnectXero: (id: number) =>
      request<{ ok: boolean }>(`/api/clients/${id}/xero/disconnect`, {
        method: "POST",
      }),
    /**
     * Fetch the Simpro OAuth authorize URL. Caller window.location.href's
     * it to redirect the user to their Build's consent page. After approval
     * Simpro 303-redirects to /api/simpro/callback on the backend, which
     * then bounces back to /clients/{id}?simpro=pick for company selection.
     */
    simproConnectAuthorizeUrl: (id: number) =>
      request<{ authorize_url: string; client_id: number }>(
        `/api/clients/${id}/simpro/connect`,
      ),
    /**
     * List the companies visible on this client's stored Simpro Build.
     * Used by the edit page so an admin doesn't have to guess the
     * numeric simpro_company_id (the #1 source of "Test Simpro: jobs
     * 404 — company doesn't exist" errors).
     */
    listSimproCompaniesForClient: (id: number) =>
      request<{ companies: { id: number; name: string }[] }>(
        `/api/clients/${id}/simpro/list-companies`,
      ),
    /**
     * Finalise the post-OAuth company picker. Backend validates that
     * companyId is in the cached simpro_oauth_companies list before
     * saving and clearing the cache.
     */
    simproSelectCompany: (clientId: number, companyId: number) =>
      request<{ status: string; client_id: number; simpro_company_id: number }>(
        `/api/clients/${clientId}/simpro/select-company`,
        {
          method: "POST",
          body: JSON.stringify({ company_id: companyId }),
        },
      ),
    simproDisconnect: (id: number) =>
      request<{ status: string; client_id: number }>(
        `/api/clients/${id}/simpro/disconnect`,
        { method: "POST" },
      ),
    /**
     * Trigger a Supabase magic-link invite to one owner email on a client.
     * Multi-owner clients can invite each owner separately by passing the
     * email param; omitting it defaults to the first owner on the list.
     * Admin-only on the backend (relies on SUPABASE_SERVICE_ROLE_KEY).
     */
    invitePortal: (id: number, email?: string) => {
      const qs = email ? `?email=${encodeURIComponent(email)}` : "";
      return request<{
        status: string;
        client_id: number;
        email: string;
        message: string;
      }>(`/api/clients/${id}/invite${qs}`, { method: "POST" });
    },
    listTargets: (clientId: number) =>
      request<Target[]>(`/api/clients/${clientId}/targets`),
    createTarget: (clientId: number, body: TargetCreate) =>
      request<Target>(`/api/clients/${clientId}/targets`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateTarget: (clientId: number, targetId: number, body: TargetUpdate) =>
      request<Target>(`/api/clients/${clientId}/targets/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteTarget: (clientId: number, targetId: number) =>
      request<void>(`/api/clients/${clientId}/targets/${targetId}`, {
        method: "DELETE",
      }),
    schedulerStatus: (limit: number = 50) =>
      request<ReportLog[]>(`/api/scheduler/status?limit=${limit}`),
    listReportLogs: (clientId: number, limit: number = 50) =>
      request<ReportLog[]>(`/api/clients/${clientId}/report-logs?limit=${limit}`),
    /**
     * Fetch the rendered HTML for a single previously-sent report. Used
     * by the history "View" button — the caller wraps the response in a
     * Blob and `window.open`s it in a new tab.
     */
    getReportLogHtml: (clientId: number, logId: number) =>
      requestText(`/api/clients/${clientId}/report-logs/${logId}/html`),

    /**
     * Fetch a freshly-rendered PDF of a report. Returns the raw bytes
     * as a Blob; callers turn it into a download link via
     * URL.createObjectURL.
     */
    downloadReportPdf: async (
      clientId: number,
      kind: "simpro" | "scorecard" | "quotes" | "monthly",
    ): Promise<Blob> => {
      const path = `/api/clients/${clientId}/reports/${kind}/pdf`;
      const res = await fetch(`${getApiBaseUrl()}${path}`, {
        headers: await buildHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
      }
      return res.blob();
    },

    generateSimproReportHtml: (clientId: number) =>
      requestText(`/api/reports/generate?format=html`, {
        method: "POST",
        body: JSON.stringify({ client_id: clientId }),
      }),
    generateScorecardHtml: (clientId: number) =>
      requestText(`/api/clients/${clientId}/reports/scorecard?format=html`, {
        method: "POST",
      }),
    /**
     * Per-client Simpro labour preview. Mirrors generateScorecardHtml /
     * generateQuotesJobsHtml in shape — clients can call this for their
     * own client_id (the older /api/reports/generate is admin-only).
     */
    generateClientSimproHtml: (clientId: number) =>
      requestText(`/api/clients/${clientId}/reports/simpro?format=html`, {
        method: "POST",
      }),
    generateQuotesJobsHtml: (clientId: number) =>
      requestText(`/api/clients/${clientId}/reports/quotes?format=html`, {
        method: "POST",
      }),
    /**
     * Monthly Financial Recap preview - same shape as the scorecard
     * preview but covers the previous full calendar month.
     */
    generateMonthlyHtml: (clientId: number) =>
      requestText(`/api/clients/${clientId}/reports/monthly?format=html`, {
        method: "POST",
      }),
    sendSimproReport: (
      clientId: number,
      opts: { test_email?: string; dry_run?: boolean; as_pdf?: boolean } = {},
    ) => {
      const qs = new URLSearchParams();
      if (opts.test_email) qs.set("test_email", opts.test_email);
      if (opts.dry_run) qs.set("dry_run", "true");
      if (opts.as_pdf) qs.set("as_pdf", "true");
      const tail = qs.toString() ? `?${qs.toString()}` : "";
      return request<ReportSendResult>(
        `/api/clients/${clientId}/reports/send${tail}`,
        { method: "POST" },
      );
    },
    sendScorecardReport: (
      clientId: number,
      opts: { test_email?: string; dry_run?: boolean; as_pdf?: boolean } = {},
    ) => {
      const qs = new URLSearchParams();
      if (opts.test_email) qs.set("test_email", opts.test_email);
      if (opts.dry_run) qs.set("dry_run", "true");
      if (opts.as_pdf) qs.set("as_pdf", "true");
      const tail = qs.toString() ? `?${qs.toString()}` : "";
      return request<ReportSendResult>(
        `/api/clients/${clientId}/reports/scorecard/send${tail}`,
        { method: "POST" },
      );
    },
    sendMonthlyReport: (
      clientId: number,
      opts: { test_email?: string; dry_run?: boolean; as_pdf?: boolean } = {},
    ) => {
      const qs = new URLSearchParams();
      if (opts.test_email) qs.set("test_email", opts.test_email);
      if (opts.dry_run) qs.set("dry_run", "true");
      if (opts.as_pdf) qs.set("as_pdf", "true");
      const tail = qs.toString() ? `?${qs.toString()}` : "";
      return request<ReportSendResult>(
        `/api/clients/${clientId}/reports/monthly/send${tail}`,
        { method: "POST" },
      );
    },
    sendQuotesJobsReport: (
      clientId: number,
      opts: { test_email?: string; dry_run?: boolean; as_pdf?: boolean } = {},
    ) => {
      const qs = new URLSearchParams();
      if (opts.test_email) qs.set("test_email", opts.test_email);
      if (opts.dry_run) qs.set("dry_run", "true");
      if (opts.as_pdf) qs.set("as_pdf", "true");
      const tail = qs.toString() ? `?${qs.toString()}` : "";
      return request<ReportSendResult>(
        `/api/clients/${clientId}/reports/quotes/send${tail}`,
        { method: "POST" },
      );
    },
  };
}
