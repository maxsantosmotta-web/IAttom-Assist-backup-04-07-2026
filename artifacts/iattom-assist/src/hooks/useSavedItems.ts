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

export interface TrashImageSourcePayload {
  title: string;
  origin: "gallery" | "library";
  name: string;
  base64: string;
  mimeType: "image/png" | "image/jpeg";
}

type PendingImageTrash = {
  payload: SavedItemPayload;
  asset?: AssetData;
};

const pendingImageTrash = new Map<string, PendingImageTrash>();
let tokenRequest: Promise<string> | null = null;

function parseImageMotionTrash(payload: SavedItemPayload): boolean {
  if (!payload.data || payload.type !== "creative") return false;
  try {
    const parsed = JSON.parse(payload.data) as { type?: string };
    return parsed.type === "image-motion-source";
  } catch {
    return false;
  }
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

async function resolveToken(getToken: () => Promise<string | null>): Promise<string> {
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const retryDelays = [0, 300, 700];

    for (const delay of retryDelays) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      const token = await getToken();
      if (token) return token;
    }

    throw new Error("Sessão ainda carregando. Tente novamente.");
  })().finally(() => {
    tokenRequest = null;
  });

  return tokenRequest;
}

export function useSavedItems() {
  const { getToken } = useAuth();

  const getItems = useCallback(async (): Promise<SavedItemRecord[]> => {
    const token = await resolveToken(getToken);
    return apiFetch<SavedItemRecord[]>("/api/saved-items", token);
  }, [getToken]);

  const saveItem = useCallback(async (payload: SavedItemPayload): Promise<void> => {
    if (parseImageMotionTrash(payload)) {
      pendingImageTrash.set(payload.id, { payload });
      return;
    }

    const token = await resolveToken(getToken);
    await apiFetch<SavedItemRecord>("/api/saved-items", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }, [getToken]);

  const saveItemAssets = useCallback(async (id: string, assets: AssetData[]): Promise<void> => {
    if (!assets.length) return;

    const pending = pendingImageTrash.get(id);
    if (pending) {
      pendingImageTrash.set(id, { ...pending, asset: assets[0] });
      return;
    }

    const token = await resolveToken(getToken);
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}/assets`, token, {
      method: "POST",
      body: JSON.stringify({ assets }),
    });
  }, [getToken]);

  const getItemAssets = useCallback(async (id: string): Promise<AssetData[]> => {
    const token = await resolveToken(getToken);
    const res = await apiFetch<{ assets: AssetData[] }>(`/api/saved-items/${id}/assets`, token);
    return res.assets ?? [];
  }, [getToken]);

  const saveItemVideoAssets = useCallback(async (id: string, videos: VideoAssetData[]): Promise<void> => {
    if (!videos.length) return;
    const token = await resolveToken(getToken);
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}/video-assets`, token, {
      method: "POST",
      body: JSON.stringify({ videos }),
    });
  }, [getToken]);

  const getItemVideoAssets = useCallback(async (id: string): Promise<VideoAssetData[]> => {
    const token = await resolveToken(getToken);
    const res = await apiFetch<{ videos: VideoAssetData[] }>(`/api/saved-items/${id}/video-assets`, token);
    return res.videos ?? [];
  }, [getToken]);

  const trashItem = useCallback(async (id: string): Promise<void> => {
    const pending = pendingImageTrash.get(id);
    if (pending) {
      const asset = pending.asset;
      if (!asset?.base64) {
        pendingImageTrash.delete(id);
        throw new Error("A imagem não foi preparada para a Lixeira");
      }

      const parsed = pending.payload.data ? JSON.parse(pending.payload.data) as { origin?: "gallery" | "library"; name?: string; mimeType?: "image/png" | "image/jpeg" } : {};
      const token = await resolveToken(getToken);

      const response = await apiFetch<{ ok: boolean; item?: { id: string; deletedAt: string | null } }>("/api/image-motion/trash-source", token, {
        method: "POST",
        body: JSON.stringify({
          title: pending.payload.title,
          origin: parsed.origin ?? (asset.format === "library" ? "library" : "gallery"),
          name: parsed.name ?? asset.label,
          base64: asset.base64,
          mimeType: parsed.mimeType ?? (/\.jpe?g$/i.test(asset.label) ? "image/jpeg" : "image/png"),
        } satisfies TrashImageSourcePayload),
      });

      pendingImageTrash.delete(id);
      if (!response.ok || !response.item?.id || !response.item.deletedAt) {
        throw new Error("A imagem não foi confirmada na Lixeira");
      }
      return;
    }

    const token = await resolveToken(getToken);
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}`, token, { method: "DELETE" });
  }, [getToken]);

  const trashImageSource = useCallback(async (payload: TrashImageSourcePayload): Promise<void> => {
    const token = await resolveToken(getToken);
    const response = await apiFetch<{ ok: boolean; item?: { id: string; deletedAt: string | null } }>("/api/image-motion/trash-source", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok || !response.item?.id || !response.item.deletedAt) {
      throw new Error("A imagem não foi confirmada na Lixeira");
    }
  }, [getToken]);

  const getTrash = useCallback(async (): Promise<SavedItemRecord[]> => {
    const res = await fetch("/api/saved-items/trash", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<SavedItemRecord[]>;
  }, []);

  const restoreItem = useCallback(async (id: string): Promise<void> => {
    const token = await resolveToken(getToken);
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}/restore`, token, { method: "POST" });
  }, [getToken]);

  const permanentDelete = useCallback(async (id: string): Promise<void> => {
    const token = await resolveToken(getToken);
    await apiFetch<{ ok: boolean }>(`/api/saved-items/${id}/permanent`, token, { method: "DELETE" });
  }, [getToken]);

  return { getItems, saveItem, saveItemAssets, getItemAssets, saveItemVideoAssets, getItemVideoAssets, trashItem, trashImageSource, getTrash, restoreItem, permanentDelete };
}
