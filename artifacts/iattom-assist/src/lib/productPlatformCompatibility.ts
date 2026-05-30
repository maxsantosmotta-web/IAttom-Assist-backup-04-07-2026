const PHYSICAL_PLATFORM_KEYWORDS = ["shopee", "mercado", "facebook", "instagram", "tiktok"];
const DIGITAL_PLATFORM_KEYWORDS = ["hotmart", "kiwify"];

const PHYSICAL_PRODUCT_TERMS = [
  "scooter", "cadeira", "relógio", "celular", "roupa", "tênis", "sapato",
  "bolsa", "perfume", "eletrônico", "fone", "câmera", "bicicleta", "moto",
  "carro", "produto físico", "acessório", "equipamento",
];

const DIGITAL_PRODUCT_TERMS = [
  "curso", "ebook", "e-book", "mentoria", "consultoria", "treinamento",
  "aula", "método", "assinatura", "comunidade", "produto digital", "planilha",
  "template", "software", "saas", "ferramenta digital",
];

function isPlatformDigital(platform: string): boolean {
  const lower = platform.toLowerCase();
  return DIGITAL_PLATFORM_KEYWORDS.some((k) => lower.includes(k));
}

function isPlatformPhysical(platform: string): boolean {
  const lower = platform.toLowerCase();
  return PHYSICAL_PLATFORM_KEYWORDS.some((k) => lower.includes(k));
}

export function inferProductType(text: string): "físico" | "digital" | null {
  const lower = text.toLowerCase();
  const isPhysical = PHYSICAL_PRODUCT_TERMS.some((t) => lower.includes(t));
  const isDigital = DIGITAL_PRODUCT_TERMS.some((t) => lower.includes(t));
  if (isPhysical && !isDigital) return "físico";
  if (isDigital && !isPhysical) return "digital";
  return null;
}

/**
 * Returns the effective product type used for compatibility checks.
 * Inferred type from product text takes priority over selected type.
 * If text inference is inconclusive, falls back to selected type.
 * If both are inconclusive, returns null (no blocking).
 */
export function getEffectiveProductType(
  productText: string,
  selectedType: string | null,
): string | null {
  const inferred = inferProductType(productText);
  if (inferred !== null) return inferred;
  if (!selectedType) return null;
  return selectedType.toLowerCase();
}

export type IncompatibilityType = "physical_on_digital" | "digital_on_physical" | null;

export function detectIncompatibility(
  productType: string | null,
  platform: string,
): IncompatibilityType {
  if (!productType || !platform) return null;
  const type = productType.toLowerCase();
  if (type === "físico") {
    if (isPlatformDigital(platform)) return "physical_on_digital";
  }
  if (type === "digital") {
    if (isPlatformPhysical(platform)) return "digital_on_physical";
  }
  return null;
}

export const INCOMPATIBILITY_MESSAGES: Record<NonNullable<IncompatibilityType>, string> = {
  physical_on_digital:
    "ATENÇÃO: O produto informado parece ser físico, mas a plataforma selecionada é voltada para produtos digitais. Use Mercado Livre, Shopee, Facebook, Instagram ou TikTok para produtos físicos.",
  digital_on_physical:
    "ATENÇÃO: O produto informado parece ser digital, mas a plataforma selecionada é voltada para produtos físicos. Use Hotmart ou Kiwify para produtos digitais.",
};
