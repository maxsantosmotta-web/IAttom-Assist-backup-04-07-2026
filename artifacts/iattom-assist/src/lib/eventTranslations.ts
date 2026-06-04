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
};

export const MODULE_LABELS: Record<string, string> = {
  campaign: "Campanha",
  content: "Conteúdo",
  creative: "Criativo",
  video_script: "Script de Vídeo",
  product_discovery: "Descoberta de Produto",
  product_validation: "Validação de Produto",
  marketing: "Marketing",
};

export function translateAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function translateModule(module: string): string {
  return MODULE_LABELS[module] ?? module.replace(/_/g, " ");
}
