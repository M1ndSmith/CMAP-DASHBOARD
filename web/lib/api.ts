const BASE = process.env.ML_API_URL ?? "http://127.0.0.1:8000";

export async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
