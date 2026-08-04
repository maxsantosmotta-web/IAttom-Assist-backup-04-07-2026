export const ACTION_LABELS: Record<string, string> = {
  "Campaign created": "Campanha criada",
  "Generated content": "Conteúdo gerado",
  "Updated project": "Projeto atualizado",
  "Created project": "Projeto criado",
  "Completed project": "Projeto concluído",
  "Ran product validation": "Validação de produto executada",
  "Product discovery": "Descoberta de produto",
  "Created campaign": "Campanha criada",
  "Content generated": "Conteúdo gerado",
  "Video script generated": "Script de vídeo gerado",
  "Creative generated": "Criativo gerado",
  "AI product discovery": "Descoberta de produto com inteligência",
};

export const MODULE_LABELS: Record<string, string> = {
  campaign: "Campanha",
  content: "Conteúdo",
  creative: "Criativo",
  video_script: "Script de Vídeo",
  product_discovery: "Descoberta de Produto",
  product_validation: "Validação de Produto",
  find_products: "Descoberta de Produto",
  validate_products: "Validação de Produto",
  prompts: "Criar Prompt",
  criar_prompt: "Criar Prompt",
  "Criar Prompt": "Criar Prompt",
  "Find Products": "Buscar Produtos",
  "Validate Products": "Validar Produtos",
  "Creative": "Criativo",
  "Campaign": "Campanha",
  "Content": "Conteúdo",
  "Product Discovery": "Descoberta de Produto",
  "Product Validation": "Validação de Produto",
  "Video Script": "Script de Vídeo",
  marketing: "Marketing",
};

const DEMO_NAME_MAP: Record<string, string> = {
  "summer sale campaign": "Campanha de Venda de Verão",
  "fittrack app content": "Conteúdo do App FitTrack",
  "ecobottle product discovery": "Descoberta de Produto EcoBottle",
  "brand video script": "Script de Vídeo da Marca",
  "ai tool validation": "Validação de Ferramenta de Inteligência",
};

export function translateDemoName(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, pt] of Object.entries(DEMO_NAME_MAP)) {
    const idx = lower.indexOf(key);
    if (idx !== -1) {
      return text.slice(0, idx) + pt + text.slice(idx + key.length);
    }
  }
  return text;
}

export function translateAction(action: string): string {
  // 1. Exact match (case-sensitive)
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];

  // 2. Case-insensitive exact match against demo names
  const lowerAction = action.toLowerCase().trim();
  for (const [key, pt] of Object.entries(DEMO_NAME_MAP)) {
    if (lowerAction === key) return pt;
  }

  // 3. Prefix matchers — translate prefix then apply demo name translation
  if (/^Campaign created:/i.test(action))
    return translateDemoName(action.replace(/^Campaign created:/i, "Campanha criada:"));
  if (/^Campanha criada:/i.test(action))
    return translateDemoName(action);
  if (/^Campaign block refined:/i.test(action))
    return "Bloco de campanha refinado";
  if (/^Script created:/i.test(action))
    return translateDemoName(action.replace(/^Script created:/i, "Script criado:"));
  if (/^Script criado:/i.test(action))
    return translateDemoName(action);
  if (/^Content created:/i.test(action))
    return translateDemoName(action.replace(/^Content created:/i, "Conteúdo criado:"));
  if (/^Conteúdo criado:/i.test(action))
    return translateDemoName(action);
  if (/^Created campaign:/i.test(action))
    return translateDemoName(action.replace(/^Created campaign:/i, "Campanha criada:"));

  // 4. Substring fallback — replace any demo name found anywhere in the string
  return translateDemoName(action);
}

export function translateModule(module: string): string {
  return MODULE_LABELS[module] ?? module.replace(/_/g, " ");
}
