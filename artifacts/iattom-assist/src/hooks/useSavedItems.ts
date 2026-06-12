import { useAuth } from "@clerk/react";
import { useCallback } from "react";

export interface SavedItemPayload {
  id: string;
  title: string;
  type: string;
  platform?: string;
  content?: string;
  data?: string;
  hasImages?: boolean;
}

export interface SavedItemRecord extends SavedItemPayload {
  clerkUserId: string;
  videosData?: string | null;
  createdAt: string;
  deletedAt: string | null;
  expiresAt: string | null;
}

export interface AssetData {
  conceptIndex: number;
  base64: string;
  label: string;
  format: string;
}

export interface VideoAssetData {
  videoUrl: string;
  title: string;
  durationSeconds?: number;
  savedAt: string;
  provider?: string;
  videoEstilo?: string;
  videoAvatar?: string;
}

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function resolveToken(getToken: () => Promise<string | null>): Promise<string | null> {
  let token = await getToken();
  if (!token) {
    await new Promise(r => setTimeout(r, 700));
    token = await getToken();
  }
  return token;
}

export function useSavedItems() {
  const { getToken } = useAuth();

  const getItems = useCallback(async (): Promise<SavedItemRecord[]> => {
    const token = await resolveToken(getToken);
    if (!token) return [];
    return apiFetch<SavedItemRecord[]>("/api/saved-items", token);
  }, [getToken]);

  const saveItem = useCallback(async (payload: SavedItemPayload): Promise<void> => {
    const token = await resolveToken(getToken);
    if (!token) throw new Error("Não autenticado");
    await apiFetch<SavedItemRecord>("/api/saved-items", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }, [getToken]);

  const saveItemAssets = useCallback(async (id: string, assets: AssetData[]): Promise<void> => {
    if (!assets.length) return;
    const token = await resolveToken(getToken);
    if (!token) throw new Error("Não autenticado");
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}/assets`, token, {
      method: "POST",
      body: JSON.stringify({ assets }),
    });
  }, [getToken]);

  const getItemAssets = useCallback(async (id: string): Promise<AssetData[]> => {
    const token = await resolveToken(getToken);
    if (!token) return [];
    const res = await apiFetch<{ assets: AssetData[] }>(`/api/saved-items/${id}/assets`, token);
    return res.assets ?? [];
  }, [getToken]);

  const saveItemVideoAssets = useCallback(async (id: string, videos: VideoAssetData[]): Promise<void> => {
    if (!videos.length) return;
    const token = await resolveToken(getToken);
    if (!token) throw new Error("Não autenticado");
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}/video-assets`, token, {
      method: "POST",
      body: JSON.stringify({ videos }),
    });
  }, [getToken]);

  const getItemVideoAssets = useCallback(async (id: string): Promise<VideoAssetData[]> => {
    const token = await resolveToken(getToken);
    if (!token) return [];
    const res = await apiFetch<{ videos: VideoAssetData[] }>(`/api/saved-items/${id}/video-assets`, token);
    return res.videos ?? [];
  }, [getToken]);

  const trashItem = useCallback(async (id: string): Promise<void> => {
    const token = await resolveToken(getToken);
    if (!token) throw new Error("Não autenticado");
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}`, token, { method: "DELETE" });
  }, [getToken]);

  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
    const token = await resolveToken(getToken);
    if (!token) return [];
    return apiFetch<SavedItemRecord[]>("/api/saved-items/trash", token);
  }, [getToken]);

  const restoreItem = useCallback(async (id: string): Promise<void> => {
    const token = await resolveToken(getToken);
    if (!token) throw new Error("Não autenticado");
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}/restore`, token, { method: "POST" });
  }, [getToken]);

  const permanentDelete = useCallback(async (id: string): Promise<void> => {
    const token = await resolveToken(getToken);
    if (!token) throw new Error("Não autenticado");
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}/permanent`, token, { method: "DELETE" });
  }, [getToken]);

  return { getItems, saveItem, saveItemAssets, getItemAssets, saveItemVideoAssets, getItemVideoAssets, trashItem, getTrash, restoreItem, permanentDelete };
}
