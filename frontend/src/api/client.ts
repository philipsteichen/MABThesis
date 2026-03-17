const BASE = "/api";

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getBasisData: (params?: {
    location?: string;
    crop?: string;
    start_date?: string;
    end_date?: string;
  }) =>
    fetchJson<{ data: import("../types").BasisDataPoint[]; count: number }>(
      `${BASE}/basis/data`,
      params as Record<string, string>,
    ),

  getLocations: () =>
    fetchJson<{ locations: string[] }>(`${BASE}/basis/locations`),

  getCrops: () => fetchJson<{ crops: string[] }>(`${BASE}/basis/crops`),

  getSummary: (params?: { location?: string; crop?: string }) =>
    fetchJson<import("../types").BasisSummary>(
      `${BASE}/basis/summary`,
      params as Record<string, string>,
    ),

  getSeasonal: (params?: { location?: string; crop?: string }) =>
    fetchJson<{ data: import("../types").SeasonalBasis[] }>(
      `${BASE}/basis/seasonal`,
      params as Record<string, string>,
    ),

  getBasisByYear: (params?: { location?: string; crop?: string }) =>
    fetchJson<{ data: { date: string; year: number; week: number; basis: number; location: string }[] }>(
      `${BASE}/basis/by-year`,
      params as Record<string, string>,
    ),

  getForecast: (params?: {
    location?: string;
    crop?: string;
    years?: string;
  }) =>
    fetchJson<import("../types").ForecastResponse>(
      `${BASE}/forecast/basis`,
      params as Record<string, string>,
    ),

  // Market data endpoints
  getMarketSources: () =>
    fetchJson<{
      sources: {
        id: string;
        name: string;
        available: boolean;
        commodities: string[];
      }[];
    }>(`${BASE}/market/sources`),

  fetchMarketData: (params: { source: string; commodity: string; start_date?: string }) =>
    fetchJson<{ data: { date: string; price: number }[]; count: number; commodity: string; source: string }>(
      `${BASE}/market/fetch`,
      params as Record<string, string>,
    ),

  uploadCsv: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/market/upload`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Upload failed: ${res.status}` }));
      throw new Error(err.detail || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<{ data: { date: string; price: number }[]; count: number; filename: string }>;
  },

  forecastPrice: async (params: {
    source?: string;
    commodity?: string;
    start_date?: string;
    years: string;
    file?: File;
  }) => {
    const { file, ...queryParams } = params;
    const url = new URL(`${BASE}/market/forecast`, window.location.origin);
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });

    let res: Response;
    if (file) {
      const form = new FormData();
      form.append("file", file);
      res = await fetch(url.toString(), { method: "POST", body: form });
    } else {
      res = await fetch(url.toString(), { method: "POST" });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Forecast failed: ${res.status}` }));
      throw new Error(err.detail || `Forecast failed: ${res.status}`);
    }
    return res.json() as Promise<import("../types").PriceForecastResponse>;
  },
};
