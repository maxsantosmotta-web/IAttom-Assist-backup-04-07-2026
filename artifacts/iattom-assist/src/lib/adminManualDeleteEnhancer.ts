const PROTECTED_ADMIN_EMAIL = "maxsantosmotta@gmail.com";
const BUTTON_MARKER = "data-iattom-delete-user";

interface ClerkWindow extends Window {
  Clerk?: {
    session?: {
      getToken: () => Promise<string | null>;
    };
  };
}

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
  const confirmed = window.confirm(
    `Excluir definitivamente o usuário ${email}?\n\nA conta será removida do Clerk e do banco de dados.`,
  );
  if (!confirmed) return;

  button.disabled = true;
  button.style.opacity = "0.45";

  try {
    const token = await getAuthToken();
    if (!token) throw new Error("Sessão administrativa não encontrada. Atualize a página e tente novamente.");

    const userId = await resolveUserId(email, token);
    const response = await fetch(`/api/admin/users/${userId}/remove-manual`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? "Falha ao excluir usuário.");

    window.location.reload();
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
    if (cells.length < 2) return;

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

export function initializeAdminManualDeleteEnhancer(): void {
  const observer = new MutationObserver(() => enhanceRows());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", enhanceRows);
  window.setInterval(enhanceRows, 1500);
  enhanceRows();
}
