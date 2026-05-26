const ACTIVE_KEY = "iattom_saved_items_v1";
const TRASH_KEY = "iattom_trash_items_v1";
const TRASH_TTL_MS = 48 * 60 * 60 * 1000;

export interface SavedItemBase {
  id: string;
  title: string;
  type: string;
  platform?: string;
  content: string;
  data?: string;
  hasImages?: boolean;
  createdAt: string;
}

export interface TrashedItem extends SavedItemBase {
  deletedAt: string;
  expiresAt: string;
}

function readActive(): SavedItemBase[] {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as SavedItemBase[]) : [];
  } catch { return []; }
}

function writeActive(items: SavedItemBase[]): void {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(items)); } catch {}
}

export function readTrash(): TrashedItem[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    return raw ? (JSON.parse(raw) as TrashedItem[]) : [];
  } catch { return []; }
}

function writeTrash(items: TrashedItem[]): void {
  try { localStorage.setItem(TRASH_KEY, JSON.stringify(items)); } catch {}
}

export function moveToTrash(item: SavedItemBase): void {
  writeActive(readActive().filter(i => i.id !== item.id));
  const now = new Date();
  const trashed: TrashedItem = {
    ...item,
    deletedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TRASH_TTL_MS).toISOString(),
  };
  const trash = readTrash();
  trash.unshift(trashed);
  writeTrash(trash);
}

export function restoreFromTrash(id: string): SavedItemBase | null {
  const trash = readTrash();
  const item = trash.find(i => i.id === id);
  if (!item) return null;
  writeTrash(trash.filter(i => i.id !== id));
  const { deletedAt: _d, expiresAt: _e, ...restored } = item;
  const active = readActive();
  active.unshift(restored);
  writeActive(active);
  return restored;
}

export function deleteFromTrash(id: string): void {
  writeTrash(readTrash().filter(i => i.id !== id));
}

export function purgeExpired(): string[] {
  const now = Date.now();
  const trash = readTrash();
  const expired = trash.filter(i => new Date(i.expiresAt).getTime() <= now);
  if (expired.length === 0) return [];
  writeTrash(trash.filter(i => new Date(i.expiresAt).getTime() > now));
  return expired.map(i => i.id);
}

export function timeUntilExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expirando agora";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h ${m}min restantes`;
  return `${m}min restantes`;
}
