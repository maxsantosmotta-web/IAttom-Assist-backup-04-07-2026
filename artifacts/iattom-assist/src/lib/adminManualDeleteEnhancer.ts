const PROTECTED_ADMIN_EMAIL = "maxsantosmotta@gmail.com";
const BUTTON_MARKER = "data-iattom-delete-user";
const AUDIT_MARKER = "data-iattom-deleted-audit";

interface ClerkWindow extends Window {
  Clerk?: {
    session?: {
      getToken: () => Promise<string | null>;
    };
  };
}

type DeletedAuditRow = {
  id: number;
  email: string;
  reason?: string | null;
};

let deletedAuditRows: DeletedAuditRow[] = [];
let deletedAuditLoading = false;
let deletedAuditLoaded = false;

function isAdminUsersPage(): boolean {
  return window.location.pathname.includes("/admin/users");
}

function createTrashIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>';
  return svg;
}

async function getAuthToken(): Promise<string | null> {
  const clerk = (window as ClerkWindow).Clerk;
  return clerk?.session?.getToken?.() ?? null;
}

async function resolveUserId(email: string, token: string): Promise<number> {
  const response = await fetch(`/api/admin/users?search=${encodeURIComponent(email)}&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!response.ok) throw new Error("Não foi possível localizar o usuário no painel.");

  const payload = (await response.json()) as {
    users?: Array<{ id: number; email: string }>;
  };

  const exactUser = payload.users?.find(
    (user) => user.email.trim().toLowerCase() === email.trim().toLowerCase(),
  );

  if (!exactUser) throw new Error("Usuário não encontrado.");
  return exactUser.id;
}

async function deleteUser(email: string, button: HTMLButtonElement): Promise<void> {
  const reason = window.prompt(`Informe o motivo da exclusão de ${email}:`)?.trim() ?? "";
  if (!reason) {
    window.alert("O motivo da exclusão é obrigatório.");
    return;
  }
  if (reason.length > 500) {
    window.alert("O motivo deve ter no máximo 500 caracteres.");
    return;
  }

  const confirmed = window.confirm(`Excluir o usuário ${email}?\n\nMotivo: ${reason}`);
  if (!confirmed) return;

  button.disabled = true;
  button.style.opacity = "0.45";

  try {
    const token = await getAuthToken();
    if (!token) throw new Error("Sessão administrativa não encontrada. Atualize a página e tente novamente.");

    const userId = await resolveUserId(email, token);
    const response = await fetch(`/api/admin/users/${userId}/remove-manual`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reason }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? "Falha ao excluir usuário.");

    window.dispatchEvent(new CustomEvent("iattom:admin-user-deleted"));
    await refreshDeletedAuditRows();
  } catch (error) {
    button.disabled = false;
    button.style.opacity = "1";
    window.alert(error instanceof Error ? error.message : "Falha ao excluir usuário.");
  }
}

function enhanceRows(): void {
  if (!isAdminUsersPage()) return;

  const rows = document.querySelectorAll<HTMLTableRowElement>("table tbody tr");
  rows.forEach((row) => {
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    if (cells.length < 2 || row.hasAttribute(AUDIT_MARKER)) return;

    const emailCandidates = Array.from(cells[0].querySelectorAll("p"));
    const email = emailCandidates
      .map((element) => element.textContent?.trim() ?? "")
      .find((value) => value.includes("@"));

    if (!email || email.toLowerCase() === PROTECTED_ADMIN_EMAIL) return;

    const actions = cells[cells.length - 1].querySelector<HTMLDivElement>("div");
    if (!actions || actions.querySelector(`[${BUTTON_MARKER}]`)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.title = "Excluir usuário";
    button.setAttribute(BUTTON_MARKER, "true");
    button.className = "text-muted-foreground hover:text-red-500 transition-colors p-1";
    button.appendChild(createTrashIcon());
    button.addEventListener("click", () => void deleteUser(email, button));
    actions.appendChild(button);
  });
}

async function fetchDeletedAuditRows(): Promise<boolean> {
  if (deletedAuditLoading || !isAdminUsersPage()) return false;
  deletedAuditLoading = true;
  try {
    const token = await getAuthToken();
    if (!token) return false;
    const response = await fetch("/api/admin/deleted-users", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return false;
    deletedAuditRows = await response.json() as DeletedAuditRow[];
    deletedAuditLoaded = true;
    return true;
  } catch {
    return false;
  } finally {
    deletedAuditLoading = false;
  }
}

async function removeDeletedAuditRow(item: DeletedAuditRow, button: HTMLButtonElement): Promise<void> {
  const confirmed = window.confirm(`Remover este registro do histórico?\n\n${item.email}`);
  if (!confirmed) return;

  button.disabled = true;
  try {
    const token = await getAuthToken();
    if (!token) throw new Error("Sessão administrativa não encontrada.");
    const response = await fetch(`/api/admin/deleted-users/${item.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!response.ok) throw new Error("Não foi possível remover o registro.");
    deletedAuditRows = deletedAuditRows.filter((row) => row.id !== item.id);
    const tableRow = button.closest("tr");
    tableRow?.remove();
  } catch (error) {
    button.disabled = false;
    window.alert(error instanceof Error ? error.message : "Não foi possível remover o registro.");
  }
}

function findDeletedUsersSection(): { section: HTMLElement; table: HTMLTableElement } | null {
  const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h3"))
    .find((element) => element.textContent?.trim() === "Usuários excluídos");
  const section = heading?.parentElement?.parentElement;
  const table = section?.querySelector<HTMLTableElement>("table");
  return section && table ? { section, table } : null;
}

function ensureDeletedSearch(section: HTMLElement, table: HTMLTableElement): HTMLInputElement {
  let input = section.querySelector<HTMLInputElement>("[data-iattom-deleted-search]");
  if (input) return input;

  const wrapper = document.createElement("div");
  wrapper.className = "relative w-full max-w-sm";
  wrapper.setAttribute("data-iattom-deleted-search-wrapper", "true");

  input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Pesquisar e-mail excluído";
  input.setAttribute("data-iattom-deleted-search", "true");
  input.className = "flex h-10 w-full rounded-md border border-white/5 bg-[#111111] px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary";
  input.addEventListener("input", () => applyDeletedSearch(table, input?.value ?? ""));
  wrapper.appendChild(input);

  const card = table.closest("div.overflow-x-auto")?.parentElement;
  card?.parentElement?.insertBefore(wrapper, card);
  return input;
}

function rowEmail(row: HTMLTableRowElement): string {
  const firstCell = row.querySelector<HTMLTableCellElement>("td");
  if (!firstCell) return "";
  return Array.from(firstCell.querySelectorAll("p"))
    .map((element) => element.textContent?.trim().toLowerCase() ?? "")
    .find((value) => value.includes("@")) ?? "";
}

function applyDeletedSearch(table: HTMLTableElement, value: string): void {
  const query = value.trim().toLowerCase();
  table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
    const email = row.getAttribute("data-email") ?? rowEmail(row);
    row.style.display = !query || email.includes(query) ? "" : "none";
  });
}

function ensureAuditHeaders(table: HTMLTableElement): void {
  const headerRow = table.querySelector<HTMLTableRowElement>("thead tr");
  if (!headerRow || headerRow.querySelector("[data-iattom-reason-header]")) return;

  const dateHeader = headerRow.lastElementChild;
  if (!dateHeader) return;

  const reasonHeader = document.createElement("th");
  reasonHeader.textContent = "Motivo";
  reasonHeader.setAttribute("data-iattom-reason-header", "true");
  reasonHeader.className = "text-left px-4 py-3.5 text-xs text-muted-foreground";
  headerRow.insertBefore(reasonHeader, dateHeader);

  const actionHeader = document.createElement("th");
  actionHeader.setAttribute("data-iattom-action-header", "true");
  actionHeader.className = "w-12 px-3 py-3.5";
  headerRow.appendChild(actionHeader);
}

function enhanceDeletedUsersHistory(): void {
  if (!isAdminUsersPage()) return;
  const target = findDeletedUsersSection();
  if (!target) return;
  const { section, table } = target;
  const input = ensureDeletedSearch(section, table);

  const scrollContainer = table.parentElement;
  if (scrollContainer) {
    scrollContainer.style.maxHeight = "360px";
    scrollContainer.style.overflow = "auto";
  }

  if (!deletedAuditLoaded) {
    applyDeletedSearch(table, input.value);
    return;
  }

  ensureAuditHeaders(table);

  const rows = table.querySelectorAll<HTMLTableRowElement>("tbody tr");
  rows.forEach((row) => {
    const email = rowEmail(row);
    if (!email) return;

    const item = deletedAuditRows.find((audit) => audit.email.toLowerCase() === email);
    if (!item) return;

    row.setAttribute(AUDIT_MARKER, "true");
    row.setAttribute("data-email", email);

    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    const dateCell = cells[cells.length - 1];
    if (!dateCell) return;

    if (!row.querySelector("[data-iattom-reason-cell]")) {
      const reasonCell = document.createElement("td");
      reasonCell.setAttribute("data-iattom-reason-cell", "true");
      reasonCell.className = "max-w-[220px] px-4 py-3 text-xs text-zinc-400";
      reasonCell.textContent = item.reason?.trim() || "Não informado";
      reasonCell.title = reasonCell.textContent;
      row.insertBefore(reasonCell, dateCell);
    }

    if (!row.querySelector("[data-iattom-audit-delete]")) {
      const actionCell = document.createElement("td");
      actionCell.className = "px-3 py-3 text-right";
      const button = document.createElement("button");
      button.type = "button";
      button.title = "Remover do histórico";
      button.setAttribute("data-iattom-audit-delete", "true");
      button.className = "rounded-md p-1.5 text-muted-foreground transition-colors hover:text-red-400";
      button.appendChild(createTrashIcon());
      button.addEventListener("click", () => void removeDeletedAuditRow(item, button));
      actionCell.appendChild(button);
      row.appendChild(actionCell);
    }
  });

  applyDeletedSearch(table, input.value);
}

async function refreshDeletedAuditRows(): Promise<void> {
  deletedAuditLoaded = false;
  const loaded = await fetchDeletedAuditRows();
  if (loaded) enhanceDeletedUsersHistory();
}

export function initializeAdminManualDeleteEnhancer(): void {
  const observer = new MutationObserver(() => {
    enhanceRows();
    enhanceDeletedUsersHistory();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", () => {
    enhanceRows();
    void refreshDeletedAuditRows();
  });
  window.addEventListener("iattom:admin-user-deleted", () => void refreshDeletedAuditRows());
  window.setInterval(() => {
    enhanceRows();
    enhanceDeletedUsersHistory();
    if (!deletedAuditLoaded && !deletedAuditLoading) void refreshDeletedAuditRows();
  }, 1500);

  enhanceRows();
  enhanceDeletedUsersHistory();
  void refreshDeletedAuditRows();
}
