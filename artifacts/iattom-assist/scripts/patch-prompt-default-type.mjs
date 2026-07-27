import fs from "node:fs";

const pagePath = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let source = fs.readFileSync(pagePath, "utf8");

const oldLine = '  const [guidedTipo, setGuidedTipo]       = useState("");';
const newLine = '  const [guidedTipo, setGuidedTipo]       = useState("Personalizado");';

if (source.includes(oldLine)) {
  source = source.replace(oldLine, newLine);
} else if (!source.includes(newLine)) {
  throw new Error("SavedPrompts guidedTipo state marker not found");
}

source = source.replace(
  '    setGuidedTipo("");',
  '    setGuidedTipo("Personalizado");',
);

const videoWithImageOption = '  "Vídeo com Imagem",';
if (!source.includes(videoWithImageOption)) {
  const imageOption = '  "Imagem",';
  if (!source.includes(imageOption)) throw new Error("SavedPrompts Imagem option marker not found");
  source = source.replace(imageOption, `${imageOption}\n${videoWithImageOption}`);
}

const videoWithImageColor = '  "Vídeo com Imagem": "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",';
if (!source.includes(videoWithImageColor)) {
  const imageColor = '  "Imagem":       "text-violet-400 bg-violet-400/10 border-violet-400/20",';
  if (!source.includes(imageColor)) throw new Error("SavedPrompts Imagem color marker not found");
  source = source.replace(imageColor, `${imageColor}\n${videoWithImageColor}`);
}

const infoMapMarker = "const TIPO_INFO: Record<string, { description: string; example: string }>";
if (!source.includes(infoMapMarker)) {
  const colorMapEnd = `  "Personalizado":"text-zinc-400 bg-zinc-400/10 border-zinc-400/20",\n};`;
  if (!source.includes(colorMapEnd)) throw new Error("SavedPrompts color map end marker not found");
  const infoMap = `${colorMapEnd}\n\nconst TIPO_INFO: Record<string, { description: string; example: string }> = {\n  "Imagem": {\n    description: "Cria prompts para gerar imagens profissionais, definindo cenário, composição, iluminação, estilo visual e acabamento.",\n    example: "Exemplo: uma moto esportiva preta em uma rua molhada à noite, com luzes neon.",\n  },\n  "Vídeo com Imagem": {\n    description: "Cria prompts para dar vida a uma imagem pronta, definindo movimentos, efeitos, câmera, elementos fixos e o que não deve ser alterado.",\n    example: "Exemplo: movimentar a fumaça e os reflexos, mantendo a moto e a câmera paradas.",\n  },\n  "Vídeo": {\n    description: "Cria prompts para vídeos completos, com cenas, ações, narrativa, ritmo, enquadramento e direção visual.",\n    example: "Exemplo: vídeo curto apresentando uma scooter elétrica em um cenário urbano.",\n  },\n  "Copy": {\n    description: "Cria prompts para textos persuasivos de vendas, com headline, benefícios, objeções, gatilhos e chamada para ação.",\n    example: "Exemplo: copy para vender proteção veicular com economia e assistência 24 horas.",\n  },\n  "Anúncio": {\n    description: "Cria prompts para anúncios pagos ou orgânicos, considerando público, plataforma, objetivo, oferta e formato.",\n    example: "Exemplo: anúncio para Instagram de uma scooter elétrica seminova.",\n  },\n  "Marketplace": {\n    description: "Cria prompts para títulos, descrições e apresentações de produtos em marketplaces, com foco em clareza e conversão.",\n    example: "Exemplo: anúncio completo de uma scooter elétrica para marketplace.",\n  },\n  "Pesquisa": {\n    description: "Cria prompts para pesquisar mercado, concorrência, tendências, demanda, oportunidades e comportamento do público.",\n    example: "Exemplo: analisar a demanda por scooters elétricas em uma cidade específica.",\n  },\n  "Estratégia": {\n    description: "Cria prompts para planejar posicionamento, vendas, canais, precificação, diferenciação e crescimento.",\n    example: "Exemplo: estratégia para lançar um serviço regional de proteção veicular.",\n  },\n  "Automação": {\n    description: "Cria prompts para organizar fluxos automáticos de mensagens, gatilhos, condições e ações em ferramentas de atendimento e marketing.",\n    example: "Exemplo: enviar uma mensagem no direct quando alguém comentar EU QUERO.",\n  },\n  "Personalizado": {\n    description: "Cria um prompt profissional para uma necessidade que não se encaixa nas demais categorias.",\n    example: "Exemplo: analisar um contrato e destacar cláusulas que exigem atenção.",\n  },\n};`;
  source = source.replace(colorMapEnd, infoMap);
}

const createStateAnchor = '  const [guidedSubject, setGuidedSubject] = useState("");';
const createInfoStates = `${createStateAnchor}\n  const [pendingTipo, setPendingTipo]       = useState<string | null>(null);\n  const subjectInputRef                     = useRef<HTMLInputElement | null>(null);`;
if (!source.includes("const [pendingTipo, setPendingTipo]")) {
  if (!source.includes(createStateAnchor)) throw new Error("SavedPrompts guidedSubject state marker not found");
  source = source.replace(createStateAnchor, createInfoStates);
}

const resetAnchor = '    setGuidedSubject("");';
if (!source.includes('    setPendingTipo(null);')) {
  if (!source.includes(resetAnchor)) throw new Error("SavedPrompts reset subject marker not found");
  source = source.replace(resetAnchor, `${resetAnchor}\n    setPendingTipo(null);`);
}

const oldTipoClick = '                      onClick={() => setGuidedTipo(t)}';
const newTipoClick = '                      onClick={() => setPendingTipo(t)}';
if (source.includes(oldTipoClick)) {
  source = source.replace(oldTipoClick, newTipoClick);
} else if (!source.includes(newTipoClick)) {
  throw new Error("SavedPrompts type button click marker not found");
}

const tipoSectionEnd = `                </div>\n              </div>\n\n              {/* Assunto */}`;
const infoBox = `                </div>\n\n                <AnimatePresence>\n                  {pendingTipo && (\n                    <motion.div\n                      initial={{ opacity: 0, y: -4 }}\n                      animate={{ opacity: 1, y: 0 }}\n                      exit={{ opacity: 0, y: -4 }}\n                      transition={{ duration: 0.18 }}\n                      className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 space-y-3"\n                    >\n                      <div className="space-y-1.5">\n                        <p className="text-xs font-bold text-primary">{pendingTipo}</p>\n                        <p className="text-xs leading-relaxed text-zinc-400">\n                          {TIPO_INFO[pendingTipo]?.description}\n                        </p>\n                        <p className="text-[11px] leading-relaxed text-zinc-600">\n                          {TIPO_INFO[pendingTipo]?.example}\n                        </p>\n                      </div>\n                      <div className="flex justify-end gap-2">\n                        <Button\n                          type="button"\n                          size="sm"\n                          variant="outline"\n                          onClick={() => setPendingTipo(null)}\n                          className="h-8 border-white/10 text-xs text-zinc-400 hover:text-white"\n                        >\n                          Sair\n                        </Button>\n                        <Button\n                          type="button"\n                          size="sm"\n                          onClick={() => {\n                            setGuidedTipo(pendingTipo);\n                            setPendingTipo(null);\n                            window.setTimeout(() => subjectInputRef.current?.focus(), 0);\n                          }}\n                          className="h-8 bg-primary px-4 text-xs font-bold text-black hover:bg-primary/90"\n                        >\n                          Continuar\n                        </Button>\n                      </div>\n                    </motion.div>\n                  )}\n                </AnimatePresence>\n              </div>\n\n              {/* Assunto */}`;
if (!source.includes("TIPO_INFO[pendingTipo]?.description")) {
  if (!source.includes(tipoSectionEnd)) throw new Error("SavedPrompts type section end marker not found");
  source = source.replace(tipoSectionEnd, infoBox);
}

const subjectInputAnchor = `                <Input\n                  value={guidedSubject}`;
const subjectInputWithRef = `                <Input\n                  ref={subjectInputRef}\n                  value={guidedSubject}`;
if (!source.includes("ref={subjectInputRef}")) {
  if (!source.includes(subjectInputAnchor)) throw new Error("SavedPrompts subject input marker not found");
  source = source.replace(subjectInputAnchor, subjectInputWithRef);
}

const legacyChargeRef = '  const chargedRef          = useRef(false);';
const pendingChargeRef = '  const pendingChargeRef    = useRef<(() => void) | null>(null);';
if (source.includes(legacyChargeRef)) {
  source = source.replace(legacyChargeRef, pendingChargeRef);
} else if (!source.includes(pendingChargeRef)) {
  throw new Error("SavedPrompts charge reference marker not found");
}

const toastAnchor = '  const { toast } = useToast();';
const postDeliveryEffect = `${toastAnchor}\n\n  useEffect(() => {\n    if (!generated || !newTitle.trim() || !newPrompt.trim()) return;\n    const charge = pendingChargeRef.current;\n    if (!charge) return;\n    pendingChargeRef.current = null;\n    charge();\n  }, [generated, newTitle, newPrompt]);`;
if (!source.includes("const charge = pendingChargeRef.current;")) {
  if (!source.includes(toastAnchor)) throw new Error("SavedPrompts toast anchor not found");
  source = source.replace(toastAnchor, postDeliveryEffect);
}

const legacyGenerateBlock = `  const generatePromptCore = async () => {\n    setGenerating(true);\n    setGenerated(false);\n    try {\n      const res = await fetch("/api/prompts/generate", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ tipo: guidedTipo, subject: guidedSubject.trim() }),\n      });\n      const data = await res.json() as { title?: string; prompt?: string; error?: string };\n      if (res.ok && data.title && data.prompt) {\n        setNewTitle(data.title);\n        setNewPrompt(data.prompt);\n        setGenerated(true);\n        toast({ description: "Prompt gerado. Revise e salve." });\n      } else {\n        if (chargedRef.current) {\n          void fetch("/api/credits/refund", {\n            method: "POST",\n            headers: { "Content-Type": "application/json" },\n            body: JSON.stringify({ feature: "prompt_creation" }),\n          });\n        }\n        toast({ description: data.error ?? "Erro ao gerar prompt. Tente novamente.", variant: "destructive" });\n      }\n    } catch {\n      if (chargedRef.current) {\n        void fetch("/api/credits/refund", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ feature: "prompt_creation" }),\n        });\n      }\n      toast({ description: "Erro de conexão. Tente novamente.", variant: "destructive" });\n    } finally {\n      setGenerating(false);\n      chargedRef.current = false;\n    }\n  };`;

const postDeliveryGenerateBlock = `  const generatePromptCore = async (charge: () => void) => {\n    setGenerating(true);\n    setGenerated(false);\n    pendingChargeRef.current = null;\n    try {\n      const res = await fetch("/api/prompts/generate", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ tipo: guidedTipo, subject: guidedSubject.trim() }),\n      });\n      const data = await res.json() as { title?: string; prompt?: string; error?: string };\n      if (res.ok && data.title?.trim() && data.prompt?.trim()) {\n        setNewTitle(data.title);\n        setNewPrompt(data.prompt);\n        pendingChargeRef.current = charge;\n        setGenerated(true);\n        toast({ description: "Prompt gerado. Revise e salve." });\n      } else {\n        pendingChargeRef.current = null;\n        toast({ description: data.error ?? "Erro ao gerar prompt. Tente novamente.", variant: "destructive" });\n      }\n    } catch {\n      pendingChargeRef.current = null;\n      toast({ description: "Erro de conexão. Tente novamente.", variant: "destructive" });\n    } finally {\n      setGenerating(false);\n    }\n  };`;

if (source.includes(legacyGenerateBlock)) {
  source = source.replace(legacyGenerateBlock, postDeliveryGenerateBlock);
} else if (!source.includes("const generatePromptCore = async (charge: () => void) =>")) {
  throw new Error("SavedPrompts generatePromptCore marker not found");
}

const legacyOnSuccess = `                onSuccess={(charge) => {\n                  charge();\n                  chargedRef.current = true;\n                  void generatePromptCore();\n                }}`;
const postDeliveryOnSuccess = `                onSuccess={(charge) => {\n                  void generatePromptCore(charge);\n                }}`;
source = source.split(legacyOnSuccess).join(postDeliveryOnSuccess);

const legacyRetryOnSuccess = `                        onSuccess={(charge) => {\n                          charge();\n                          chargedRef.current = true;\n                          void generatePromptCore();\n                        }}`;
const postDeliveryRetryOnSuccess = `                        onSuccess={(charge) => {\n                          void generatePromptCore(charge);\n                        }}`;
source = source.split(legacyRetryOnSuccess).join(postDeliveryRetryOnSuccess);

if (source.includes("chargedRef") || source.includes('/api/credits/refund')) {
  throw new Error("Criar Prompt still contains pre-charge or refund logic");
}
if (!source.includes("pendingChargeRef.current = charge") || !source.includes("const charge = pendingChargeRef.current;")) {
  throw new Error("Criar Prompt post-delivery charge rule was not installed");
}
if (source.includes("charge();\n                  void generatePromptCore")) {
  throw new Error("Criar Prompt still charges before generation");
}
if (!source.includes(videoWithImageOption) || !source.includes(videoWithImageColor)) {
  throw new Error("Criar Prompt Vídeo com Imagem option was not installed");
}
if (!source.includes(infoMapMarker) || !source.includes("TIPO_INFO[pendingTipo]?.description") || !source.includes("Continuar")) {
  throw new Error("Criar Prompt type information flow was not installed");
}

fs.writeFileSync(pagePath, source);
console.log("Criar Prompt now explains every type before continuing");