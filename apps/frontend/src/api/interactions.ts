import type { MediaType } from "./cinemeta";

const BASE_URL = "/api/interactions";

export interface ImpressionItem {
  type: MediaType;
  id: string;
}

export async function apiRecordDetailView(type: MediaType, id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/detail/${type}/${encodeURIComponent(id)}`, {
      method: "POST",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiRecordImpressions(items: ImpressionItem[]): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/impression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiGetUserRating(type: MediaType, id: string): Promise<number | null> {
  try {
    const res = await fetch(`${BASE_URL}/rating/${type}/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.rating ?? null;
  } catch {
    return null;
  }
}

export async function apiSetUserRating(
  type: MediaType,
  id: string,
  rating: number,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/rating/${type}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message };
  } catch {
    return { ok: false, message: "Error de conexión" };
  }
}

export async function apiListUserRatings(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${BASE_URL}/ratings`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function apiListNotInterested(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE_URL}/not-interested`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.notInterested ?? [];
  } catch {
    return [];
  }
}

export async function apiSetNotInterested(
  type: MediaType,
  id: string,
  on: boolean,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/not-interested/${type}/${encodeURIComponent(id)}`, {
      method: on ? "PUT" : "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message };
  } catch {
    return { ok: false, message: "Error de conexión" };
  }
}
