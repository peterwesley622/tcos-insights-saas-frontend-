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
  simpro_url: string | null;
  simpro_company_id: number | null;
  xero_tenant_id: string | null;
  gp_threshold_low: number | null;
  gp_threshold_high: number | null;
  num_site_workers: number | null;
  report_day: string | null;
  report_hour: number | null;
  active: boolean;
};

export type Target = {
  id: number;
  client_id: number;
  period_start: string;
  period_end: string;
  revenue: number | null;
  materials: number | null;
  subcontractors: number | null;
  wages: number | null;
  gross_profit: number | null;
  overheads: number | null;
  net_profit: number | null;
  rev_per_worker: number | null;
};

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

export const api = {
  health: () => request<{ status: string }>("/health"),
  listClients: () => request<Client[]>("/api/clients"),
  getClient: (id: number) => request<Client>(`/api/clients/${id}`),
  createClient: (body: Partial<Client>) =>
    request<Client>("/api/clients", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateClient: (id: number, body: Partial<Client>) =>
    request<Client>(`/api/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteClient: (id: number) =>
    request<void>(`/api/clients/${id}`, { method: "DELETE" }),
  testSimpro: (id: number) =>
    request<{ ok: boolean; message?: string }>(
      `/api/clients/${id}/test-simpro`,
      { method: "POST" },
    ),
  testXero: (id: number) =>
    request<{ ok: boolean; message?: string }>(
      `/api/clients/${id}/test-xero`,
      { method: "POST" },
    ),
  listTargets: (clientId: number) =>
    request<Target[]>(`/api/clients/${clientId}/targets`),
  schedulerStatus: () =>
    request<{ last_run: string | null; status: string }>(
      "/api/scheduler/status",
    ),
};
