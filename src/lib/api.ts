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
  owner_email: string | null;
  simpro_base_url: string | null;
  simpro_api_key_masked: string | null;
  simpro_company_id: number | null;
  num_site_workers: number | null;
  gp_threshold_low: number | null;
  gp_threshold_high: number | null;
  wages_in_opex: boolean;
  active: boolean | null;
  xero_connected: boolean;
  xero_tenant_id: string | null;
};

export type ClientCreate = {
  business_name: string;
  owner_name?: string | null;
  owner_email?: string | null;
  simpro_base_url: string;
  simpro_api_key: string;
  simpro_company_id?: number;
  num_site_workers?: number | null;
  gp_threshold_low?: number | null;
  gp_threshold_high?: number | null;
  wages_in_opex?: boolean;
};

export type ClientUpdate = Partial<{
  business_name: string;
  owner_name: string | null;
  owner_email: string | null;
  simpro_base_url: string | null;
  simpro_api_key: string | null;
  simpro_company_id: number | null;
  num_site_workers: number | null;
  gp_threshold_low: number | null;
  gp_threshold_high: number | null;
  wages_in_opex: boolean;
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
  period_start: string;
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

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
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
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
  }
  return res.text();
}

export type ReportLog = {
  id: number;
  client_id: number;
  report_type: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
};

export type ReportSendResult = {
  client_id: number;
  status: "sent" | "failed" | "dry_run" | string;
  message?: string;
  error?: string;
};

export const api = {
  health: () => request<{ status: string }>("/health"),
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
  xeroConnectUrl: (id: number) =>
    `${getApiBaseUrl()}/api/clients/${id}/xero/connect`,
  disconnectXero: (id: number) =>
    request<{ ok: boolean }>(`/api/clients/${id}/xero/disconnect`, {
      method: "POST",
    }),
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

  generateSimproReportHtml: (clientId: number) =>
    requestText(`/api/reports/generate?format=html`, {
      method: "POST",
      body: JSON.stringify({ client_id: clientId }),
    }),
  generateScorecardHtml: (clientId: number) =>
    requestText(`/api/clients/${clientId}/reports/scorecard?format=html`, {
      method: "POST",
    }),
  sendSimproReport: (
    clientId: number,
    opts: { test_email?: string; dry_run?: boolean } = {},
  ) => {
    const qs = new URLSearchParams();
    if (opts.test_email) qs.set("test_email", opts.test_email);
    if (opts.dry_run) qs.set("dry_run", "true");
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return request<ReportSendResult>(
      `/api/clients/${clientId}/reports/send${tail}`,
      { method: "POST" },
    );
  },
  sendScorecardReport: (
    clientId: number,
    opts: { test_email?: string; dry_run?: boolean } = {},
  ) => {
    const qs = new URLSearchParams();
    if (opts.test_email) qs.set("test_email", opts.test_email);
    if (opts.dry_run) qs.set("dry_run", "true");
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return request<ReportSendResult>(
      `/api/clients/${clientId}/reports/scorecard/send${tail}`,
      { method: "POST" },
    );
  },
};
