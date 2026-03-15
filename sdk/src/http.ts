import { LogiqicalError, LogiqicalAuthError } from "./errors.js";

export class HttpClient {
  private apiKey: string | null;

  constructor(
    private baseUrl: string,
    apiKey?: string,
  ) {
    this.apiKey = apiKey ?? null;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>, skipAuth = false): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {};
    if (!skipAuth && this.apiKey) headers["X-API-Key"] = this.apiKey;

    const res = await fetch(url.toString(), { headers });
    return this.handleResponse<T>(res, path);
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;

    const res = await fetch(url.toString(), { method: "POST", headers, body: JSON.stringify(body) });
    return this.handleResponse<T>(res, path);
  }

  private async handleResponse<T>(res: Response, endpoint: string): Promise<T> {
    if (res.status === 401) throw new LogiqicalAuthError(endpoint);

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = (data as any)?.error ?? `HTTP ${res.status}`;
      throw new LogiqicalError(msg, res.status, endpoint);
    }

    return data as T;
  }
}
