import { randomBytes } from "node:crypto";
import { createIattomClient } from "./iattom-client.js";
import { publicCatalog } from "./catalog.js";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  isClerkAuthInfo,
  mcpAuth,
  protectedResourceMetadataHandler,
  streamableHttpHandler,
} from "@clerk/mcp-tools/express";

// Preserve the supplied input without stripping fields or duplicating module validation.
// The operational API is the authoritative validator.
export const moduleInput = z.object({}).passthrough().refine(input => Object.keys(input).length > 0 && Object.values(input).some(value => typeof value === "string" && value.trim().length > 0), { message: "Informe os dados do módulo" });

// A separate entry point keeps the connected development preview unchanged.
// Both keys must belong to the existing IAttom Clerk production instance.
export function startOfficial(port = Number(process.env.PORT ?? 8787), host = "127.0.0.1") {
  const resourceUrl = process.env.MCP_RESOURCE_URL;
  const accountApiUrl = process.env.IATTOM_ACCOUNT_API_URL;
  if (!resourceUrl || !accountApiUrl || !process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    throw new Error("MCP_RESOURCE_URL, IATTOM_ACCOUNT_API_URL and the existing IAttom Clerk keys are required");
  }
  if (new URL(resourceUrl).protocol !== "https:" || new URL(accountApiUrl).protocol !== "https:") {
    throw new Error("Hosted MCP and account API must use HTTPS");
  }
  const authOptions = { resourceUrl, requiredScopes: ["profile"], publicAccess: { tools: ["conhecer_iattom"] } };
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id"] }));
  app.use(express.json());
  app.get("/.well-known/openai-apps-challenge", (_req, res) => {
    const token = process.env.OPENAI_APPS_CHALLENGE;
    if (!token) return res.sendStatus(404);
    return res.type("text/plain").set("Cache-Control", "no-store").send(token);
  });

  // Short-lived, unguessable download capabilities, issued only after authenticated owner retrieval.
  const downloads = new Map();
  const downloadTTL = 5 * 60 * 1000;
  const downloadCleanup = setInterval(pruneDownloads, 30000);
  downloadCleanup.unref();
  function pruneDownloads() {
    for (const [key, value] of downloads) if (value.expires <= Date.now()) downloads.delete(key);
  }
  app.get("/downloads/:ticket", (req, res) => {
    pruneDownloads();
    const ticket = String(req.params.ticket);
    const entry = /^[a-f0-9]{64}$/.test(ticket) ? downloads.get(ticket) : undefined;
    res.set({"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});
    if (!entry) {res.status(404).send("Arquivo indisponível ou link expirado."); return;}
    res.set({"Content-Type":entry.mimeType,"Content-Disposition":`attachment; filename="${entry.filename}"`});
    downloads.delete(ticket);
    res.send(entry.bytes);
  });
  function createServer() {
    const server = new McpServer({ name: "iattom-assist", version: "1.0.0" });
    server.registerTool("conhecer_iattom", {
      title: "Conhecer o IAttom Assist",
      description: "Mostra informações públicas do IAttom Assist. Não acessa contas ou funções pagas.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: "noauth" }] },
    }, async () => ({ content: [{ type: "text", text: JSON.stringify(publicCatalog) }] }));
    server.registerTool("consultar_minha_conta", {
      title: "Consultar minha conta IAttom",
      description: "Consulta o plano e o saldo da conta IAttom conectada. Somente leitura; não consome créditos.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (_args, { authInfo }) => {
      if (!isClerkAuthInfo(authInfo)) {
        return { content: [{ type: "text", text: "Conecte sua conta IAttom para consultar o plano." }], isError: true };
      }
      try {
        const response = await createIattomClient({ baseUrl: accountApiUrl, token: authInfo.token })("/api/chatgpt/account");
        if (!response.ok) {
          const message = response.status === 404 ? "Conta IAttom não encontrada." :
            response.status === 401 || response.status === 403 ? "Autorização da conta inválida." :
            "Não foi possível consultar a conta agora.";
          return { content: [{ type: "text", text: message }], isError: true };
        }
        const account = await response.json();
        const planNames = { free: "FREE", pro: "START", business: "PREMIUM", agency: "PRO" };
        const planName = planNames[account.plan];
        if (!planName) throw new Error("Unknown plan code");
        return { content: [{ type: "text", text: JSON.stringify({
          plan: planName,
          balance: account.balance,
          creativeBalance: account.creativeBalance,
          videoBalance: account.videoBalance,
        }) }] };
      } catch {
        return { content: [{ type: "text", text: "Não foi possível consultar a conta agora." }], isError: true };
      }
    });
    server.registerTool("listar_meus_projetos", {
      title: "Listar meus projetos IAttom",
      description: "Lista até 20 projetos recentes da conta IAttom conectada. Somente leitura; não consome créditos.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (_args, { authInfo }) => {
      if (!isClerkAuthInfo(authInfo)) {
        return { content: [{ type: "text", text: "Conecte sua conta IAttom para consultar os projetos." }], isError: true };
      }
      try {
        const response = await createIattomClient({ baseUrl: process.env.IATTOM_OPERATION_API_URL || accountApiUrl, token: authInfo.token })("/api/chatgpt/projects");
        if (!response.ok) {
          const message = response.status === 401 || response.status === 403
            ? "Autorização da conta inválida."
            : "Não foi possível consultar os projetos agora.";
          return { content: [{ type: "text", text: message }], isError: true };
        }
        const data = await response.json();
        if (!Array.isArray(data.projects)) throw new Error("Invalid projects response");
        return { content: [{ type: "text", text: JSON.stringify({ projects: data.projects }) }] };
      } catch {
        return { content: [{ type: "text", text: "Não foi possível consultar os projetos agora." }], isError: true };
      }
    });
    server.registerTool("listar_meus_prompts", {
      title: "Listar meus prompts salvos IAttom",
      description: "Lista até 20 prompts salvos da conta conectada. Exige acesso ao módulo Criar Prompt. Somente leitura; não consome créditos.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (_args, { authInfo }) => {
      if (!isClerkAuthInfo(authInfo)) {
        return { content: [{ type: "text", text: "Conecte sua conta IAttom para consultar os prompts." }], isError: true };
      }
      try {
        const response = await createIattomClient({ baseUrl: process.env.IATTOM_OPERATION_API_URL || accountApiUrl, token: authInfo.token })("/api/chatgpt/prompts");
        if (!response.ok) {
          const message = response.status === 403 ? "Plano necessário para acessar Criar Prompt." :
            response.status === 401 ? "Autorização da conta inválida." :
            "Não foi possível consultar os prompts agora.";
          return { content: [{ type: "text", text: message }], isError: true };
        }
        const data = await response.json();
        if (!Array.isArray(data.prompts)) throw new Error("Invalid prompts response");
        return { content: [{ type: "text", text: JSON.stringify({ prompts: data.prompts }) }] };
      } catch {
        return { content: [{ type: "text", text: "Não foi possível consultar os prompts agora." }], isError: true };
      }
    });

    server.registerTool("consultar_uso_iattom_help", {
      title: "Consultar uso do IAttom Help",
      description: "Consulta elegibilidade e custo em créditos gerais do IAttom Help sem enviar mensagens ou consumir créditos.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (_args, { authInfo }) => {
      if (!isClerkAuthInfo(authInfo)) {
        return { content: [{ type: "text", text: "Conecte sua conta IAttom." }], isError: true };
      }
      try {
        const response = await createIattomClient({ baseUrl: process.env.IATTOM_OPERATION_API_URL || accountApiUrl, token: authInfo.token })("/api/chatgpt/help/usage");
        if (!response.ok) return { content: [{ type: "text", text: "Consulta do IAttom Help indisponível." }], isError: true };
        const data = await response.json();
        if (typeof data.canUse !== "boolean" || typeof data.creditCost !== "number") {
          throw new Error("Invalid IAttom Help usage response");
        }
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch {
        return { content: [{ type: "text", text: "Consulta do IAttom Help indisponível." }], isError: true };
      }
    });
    server.registerTool("listar_minha_biblioteca", {
      title: "Consultar minha biblioteca IAttom",
      description: "Lista até 20 materiais salvos na biblioteca da conta conectada. Somente leitura, sem consumo de créditos.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (_args, { authInfo }) => {
      if (!isClerkAuthInfo(authInfo)) {
        return { content: [{ type: "text", text: "Conecte sua conta IAttom para consultar a biblioteca." }], isError: true };
      }
      try {
        const response = await createIattomClient({ baseUrl: process.env.IATTOM_OPERATION_API_URL || accountApiUrl, token: authInfo.token })("/api/chatgpt/library");
        if (!response.ok) {
          return { content: [{ type: "text", text: response.status === 401 || response.status === 403
            ? "Autorização da conta inválida." : "Não foi possível consultar a biblioteca agora." }], isError: true };
        }
        const data = await response.json();
        if (!Array.isArray(data.items)) throw new Error("Invalid library response");
        return { content: [{ type: "text", text: JSON.stringify({ items: data.items }) }] };
      } catch {
        return { content: [{ type: "text", text: "Não foi possível consultar a biblioteca agora." }], isError: true };
      }
    });

    server.registerTool("consultar_disponibilidade_modulo", {
      title: "Consultar disponibilidade de módulo IAttom",
      description: "Verifica sem executar se plano e saldo permitem solicitar um módulo. É uma prévia, não reserva créditos nem garante geração.",
      inputSchema: { feature: z.enum(["product_discovery", "product_validation", "campaign", "content", "video_script", "prompt_creation", "creativeImage1", "creativeImage2", "creativeImage3"]) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async ({ feature }, { authInfo }) => {
      if (!isClerkAuthInfo(authInfo)) {
        return { content: [{ type: "text", text: "Conecte sua conta IAttom para verificar a disponibilidade." }], isError: true };
      }
      try {
        // Preflight must use the same configured environment as operational execution.
        const response = await createIattomClient({ baseUrl: process.env.IATTOM_OPERATION_API_URL || accountApiUrl, token: authInfo.token })(`/api/chatgpt/operations/preflight/${feature}`);
        if (!response.ok) {
          // Expose only documented error codes, never arbitrary upstream data.
          const body = await response.json().catch(() => ({}));
          const allowed = new Set(["user_not_found", "unsupported_external_feature", "external_operations_disabled", "OAuth token required", "Invalid OAuth token", "Profile scope required"]);
          const error = typeof body.error === "string" && allowed.has(body.error) ? body.error : "preflight_unavailable";
          return { content: [{ type: "text", text: JSON.stringify({ status: response.status, error }) }], isError: true };
        }
        const result = await response.json();
        if (result.feature !== feature || typeof result.executionEnabled !== "boolean" || result.reserved !== false) {
          throw new Error("Invalid preflight response");
        }
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch {
        return { content: [{ type: "text", text: "Não foi possível consultar a disponibilidade do módulo." }], isError: true };
      }
    });

    // Operational tools are exposed only with an explicit isolated API.
    // Read-only tools may continue using the existing account API.
    if (process.env.CHATGPT_MCP_WRITES_ENABLED === "true" && process.env.CHATGPT_PRODUCTION_RELEASED === "true" && process.env.IATTOM_OPERATION_API_URL) {
      const operationsBase = new URL(process.env.IATTOM_OPERATION_API_URL);
      const accountBase = new URL(accountApiUrl);
      if (operationsBase.protocol !== "https:" || operationsBase.origin !== accountBase.origin ||
          operationsBase.pathname !== "/" || operationsBase.username || operationsBase.password ||
          operationsBase.search || operationsBase.hash) {
        throw new Error("The official HTTPS account API origin is required");
      }

      server.registerTool("consultar_status_iattom_help", {
        title: "Consultar resposta anterior do IAttom Help",
        description: "Recupera a resposta de uma solicitação anterior do IAttom Help sem gerar novamente nem cobrar créditos.",
        inputSchema: { requestId: z.string().regex(/^[A-Za-z0-9_-]{16,72}$/) },
        annotations: { readOnlyHint: true, openWorldHint: false },
      }, async ({ requestId }, { authInfo }) => {
        if (!isClerkAuthInfo(authInfo)) {
          return { content: [{ type: "text", text: "Conecte sua conta IAttom." }], isError: true };
        }
        try {
          const response = await createIattomClient({ baseUrl: operationsBase.origin, token: authInfo.token })(
            `/api/chatgpt/help/status/${requestId}`);
          const data = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(data) }], ...(response.ok ? { structuredContent: data } : { isError: true }) };
        } catch {
          return { content: [{ type: "text", text: "Não foi possível recuperar a resposta do Help." }], isError: true };
        }
      });
      server.registerTool("perguntar_ao_iattom_help", {
        title: "Perguntar ao IAttom Help",
        description: "Consulta o assistente de suporte interno original do IAttom. Desconta o custo real em créditos gerais apenas quando a resposta é concluída e salva na biblioteca do ambiente autorizado.",
        inputSchema: {
          message: z.string().min(1).max(4000),
          requestId: z.string().regex(/^[A-Za-z0-9_-]{16,72}$/),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      }, async ({ message, requestId }, { authInfo }) => {
        if (!isClerkAuthInfo(authInfo)) {
          return { content: [{ type: "text", text: "Conecte sua conta IAttom." }], isError: true };
        }
        try {
          const response = await createIattomClient({ baseUrl: operationsBase.origin, token: authInfo.token, allowWrites: true })(
            "/api/chatgpt/help/execute", { method: "POST", body: { message, requestId } });
          const data = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(data) }], ...(response.ok ? { structuredContent: data } : { isError: true }) };
        } catch {
          return { content: [{ type: "text", text: "Não foi possível confirmar a resposta do Help. Consulte o registro original antes de repetir." }], isError: true };
        }
      });
      server.registerTool("iniciar_efeito_video_iattom", {
        title: "Gerar Vídeo com Efeito",
        description: "Inicia a animação de uma imagem já salva na biblioteca IAttom. Utiliza o saldo independente de vídeos, sem débito até a entrega final. Somente ambiente autorizado.",
        inputSchema: {
          requestId: z.string().regex(/^[A-Za-z0-9_-]{16,72}$/),
          sourceProjectId: z.string().min(1),
          conceptIndex: z.number().int().nonnegative(),
          prompt: z.string().min(1).max(2000),
          format: z.enum(["vertical", "horizontal", "automatic"]),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      }, async (args, { authInfo }) => {
        if (!isClerkAuthInfo(authInfo)) {
          return { content: [{ type: "text", text: "Conecte sua conta IAttom." }], isError: true };
        }
        try {
          const response = await createIattomClient({ baseUrl: operationsBase.origin, token: authInfo.token, allowWrites: true })(
            "/api/chatgpt/video/submit", { method: "POST", body: args });
          const data = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(data) }], ...(response.ok ? { structuredContent: data } : { isError: true }) };
        } catch {
          return { content: [{ type: "text", text: "Não foi possível confirmar o envio. Consulte o status pela mesma chave antes de tentar novamente." }], isError: true };
        }
      });
      server.registerTool("consultar_status_efeito_video_iattom", {
        title: "Consultar processamento de Vídeo com Efeito",
        description: "Consulta a geração pela chave original sem criar novo vídeo ou consumir créditos.",
        inputSchema: { requestId: z.string().regex(/^[A-Za-z0-9_-]{16,72}$/) },
        annotations: { readOnlyHint: true, openWorldHint: false },
      }, async ({ requestId }, { authInfo }) => {
        if (!isClerkAuthInfo(authInfo)) {
          return { content: [{ type: "text", text: "Conecte sua conta IAttom." }], isError: true };
        }
        try {
          const response = await createIattomClient({ baseUrl: operationsBase.origin, token: authInfo.token })(
            `/api/chatgpt/video/status/${requestId}`);
          const data = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(data) }], ...(response.ok ? { structuredContent: data } : { isError: true }) };
        } catch {
          return { content: [{ type: "text", text: "Não foi possível consultar o processamento." }], isError: true };
        }
      });
      server.registerTool("receber_efeito_video_iattom", {
        title: "Receber Vídeo com Efeito finalizado",
        description: "Entrega o vídeo pronto, com desconto único do saldo de vídeos e salvamento na biblioteca. Apenas para solicitações já iniciadas no ambiente autorizado.",
        inputSchema: { requestId: z.string().regex(/^[A-Za-z0-9_-]{16,72}$/) },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      }, async ({ requestId }, { authInfo }) => {
        if (!isClerkAuthInfo(authInfo)) {
          return { content: [{ type: "text", text: "Conecte sua conta IAttom." }], isError: true };
        }
        try {
          const response = await createIattomClient({ baseUrl: operationsBase.origin, token: authInfo.token, allowWrites: true })(
            "/api/chatgpt/video/collect", { method: "POST", body: { requestId } });
          const data = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(data) }], ...(response.ok ? { structuredContent: data } : { isError: true }) };
        } catch {
          return { content: [{ type: "text", text: "A entrega não pôde ser confirmada. Consulte a mesma chave antes de repetir." }], isError: true };
        }
      });
      async function deliverOperationAssets(data, token, explicitId) {
        const id = explicitId || data.operationId || data.projectId;
        const content = [{ type: "text", text: JSON.stringify(data) }];
        if (!id || (!explicitId && !data.hasImages && !data.imageCount && !data.result?.concepts)) return {content, structuredContent:data};
        const response = await createIattomClient({baseUrl:operationsBase.origin,token})(`/api/chatgpt/operations/assets/${id}`);
        if (!response.ok) return {content:[...content,{type:"text",text:"Arquivo visual indisponível. Não gere novamente; consulte o material salvo."}],isError:true};
        const payload = await response.json();
        const links = [];
        pruneDownloads();
        for (const [index, asset] of payload.assets.entries()) {
          content.push({type:"image",data:asset.base64,mimeType:asset.mimeType});
          const ext = {"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[asset.mimeType];
          if (!ext) continue;
          const bytes = Buffer.from(asset.base64,"base64");
          if (bytes.length > 15000000) continue;
          while (downloads.size >= 12) downloads.delete(downloads.keys().next().value);
          const ticket = randomBytes(32).toString("hex");
          const filename = `iattom-${id.slice(8,20)}-${index+1}.${ext}`;
          downloads.set(ticket,{bytes,mimeType:asset.mimeType,filename,expires:Date.now()+downloadTTL});
          links.push({filename,url:new URL("/downloads/"+ticket,resourceUrl).href,expiresInSeconds:300});
        }
        if (links.length) content.push({type:"text",text:JSON.stringify({downloads:links,instruction:"Apresente os links de download ao usuário. São de uso único, expiram em cinco minutos; não compartilhe com terceiros."})});
        return {content,structuredContent:{...data,downloads:links}};
      }
      server.registerTool("recuperar_imagens_iattom", {
        title:"Recuperar imagens IAttom",
        description:"Recupera imagens de um material existente pelo ID da biblioteca, sem gerar ou cobrar novamente.",
        inputSchema:{id:z.string().regex(/^chatgpt-[a-f0-9]{64}$/)},
        annotations:{readOnlyHint:true,openWorldHint:false},
      }, async ({id},{authInfo}) => {
        if (!isClerkAuthInfo(authInfo)) return {content:[{type:"text",text:"Conecte sua conta IAttom."}],isError:true};
        try {return await deliverOperationAssets({projectId:id},authInfo.token,id);}
        catch {return {content:[{type:"text",text:"Não foi possível recuperar as imagens."}],isError:true};}
      });
      server.registerTool("consultar_status_operacao_iattom", {
        title: "Consultar status de operação IAttom",
        description: "Recupera o resultado de uma solicitação de geração pela mesma chave, sem regenerar nem descontar créditos adicionais.",
        inputSchema: { requestId: z.string().regex(/^[A-Za-z0-9_-]{16,72}$/) },
        annotations: { readOnlyHint: true, openWorldHint: false },
      }, async ({ requestId }, { authInfo }) => {
        if (!isClerkAuthInfo(authInfo)) {
          return { content: [{ type: "text", text: "Conecte sua conta IAttom para consultar a operação." }], isError: true };
        }
        try {
          const response = await createIattomClient({ baseUrl: operationsBase.origin, token: authInfo.token })(
            `/api/chatgpt/operations/status/${requestId}`);
          const data = await response.json();
          if (!response.ok) {
            return { content: [{ type: "text", text: JSON.stringify({ error: data.error ?? "status_unavailable", status: response.status }) }], isError: true };
          }
          return await deliverOperationAssets(data, authInfo.token);
        } catch {
          return { content: [{ type: "text", text: "Não foi possível recuperar o status agora." }], isError: true };
        }
      });
      server.registerTool("salvar_material_iattom", {
        title: "Salvar material no IAttom",
        description: "Salva um resultado já gerado somente após solicitação explícita do usuário. Use a mesma requestId da geração. Não gera novamente nem cobra créditos.",
        inputSchema: { requestId: z.string().regex(/^[A-Za-z0-9_-]{16,72}$/) },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      }, async ({ requestId }, { authInfo }) => {
        if (!isClerkAuthInfo(authInfo)) return { content: [{ type: "text", text: "Conecte sua conta IAttom." }], isError: true };
        try {
          const response = await createIattomClient({ baseUrl: operationsBase.origin, token: authInfo.token, allowWrites: true })("/api/chatgpt/operations/save", { method: "POST", body: { requestId } });
          const data = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(data) }], ...(response.ok ? { structuredContent: data } : { isError: true }) };
        } catch {
          return { content: [{ type: "text", text: "Não foi possível confirmar o salvamento. Use a mesma chave para consultar ou repetir o salvamento." }], isError: true };
        }
      });
      server.registerTool("executar_modulo_iattom", {
        title: "Executar módulo IAttom",
        description: "Executa um módulo existente no IAttom com pedido explícito e chave única. input por feature: product_discovery {query,niche?,priceRange?,targetMarket?}; product_validation {productName,description?,targetMarket?,pricePoint?}; campaign {product,audience?,goal?,mode?,platforms?,budget?,productType?}; content {topic,tone?,contentTypes?,additionalContext?}; video_script {product,format?,duration?,hook?,style?}; prompt_creation {tipo,subject}; creativeImage1/2/3 {prompt,platform,selectedFormats}, com respectivamente 1/2/3 formatos distintos compatíveis com a plataforma. A API original valida os dados, permissões e créditos. Entregue o resultado ao usuário; não salve sem solicitação explícita.",
        inputSchema: {
          feature: z.enum(["product_discovery", "product_validation", "campaign", "content", "video_script", "prompt_creation", "creativeImage1", "creativeImage2", "creativeImage3"]),
          input: moduleInput,
          requestId: z.string().regex(/^[A-Za-z0-9_-]{16,72}$/),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      }, async ({ feature, input, requestId }, { authInfo }) => {
        if (!isClerkAuthInfo(authInfo)) {
          return { content: [{ type: "text", text: "Conecte sua conta IAttom para executar o módulo." }], isError: true };
        }
        try {
          const response = await createIattomClient({ baseUrl: operationsBase.origin, token: authInfo.token, allowWrites: true })(
            "/api/chatgpt/operations/execute", { method: "POST", body: { feature, input, requestId } });
          const data = await response.json();
          if (!response.ok) {
            return { content: [{ type: "text", text: JSON.stringify({ error: data.error ?? "operation_failed", status: response.status }) }], isError: true };
          }
          return await deliverOperationAssets(data, authInfo.token);
        } catch {
          return { content: [{ type: "text", text: "Falha na comunicação com a API operacional isolada. Não repita automaticamente a mesma operação com outra chave." }], isError: true };
        }
      });
    }
    return server;
  }

  app.all("/mcp", mcpAuth(authOptions), streamableHttpHandler(createServer, StreamableHTTPServerTransport));
  app.all("/.well-known/oauth-protected-resource/mcp", protectedResourceMetadataHandler(authOptions));
  const server = app.listen(port, host);
  if (new URL(resourceUrl).hostname === "iattom-mcp-preview-test.up.railway.app") {
    server.once("listening", async () => {
      const tickets = [];
      try {
        const base = "http://127.0.0.1:" + server.address().port + "/downloads/";
        const fixture = Buffer.from("sandbox-download-check");
        const issue = (expires) => {
          const ticket = randomBytes(32).toString("hex");
          tickets.push(ticket);
          downloads.set(ticket, {bytes:fixture,mimeType:"image/png",filename:"sandbox-check.png",expires});
          return ticket;
        };
        const valid = issue(Date.now()+downloadTTL);
        const first = await fetch(base+valid);
        if (first.status !== 200 || !Buffer.from(await first.arrayBuffer()).equals(fixture) || first.headers.get("cache-control") !== "private, no-store") throw Error("first_download");
        if ((await fetch(base+valid)).status !== 404) throw Error("replay");
        const expired = issue(Date.now()-1);
        if ((await fetch(base+expired)).status !== 404) throw Error("expiry");
        if ((await fetch(base+randomBytes(32).toString("hex"))).status !== 404) throw Error("unknown_ticket");
        console.log("STAGE10_DOWNLOAD_PASS first_download replay expiry unknown_ticket");
      } catch (err) { console.error("STAGE10_DOWNLOAD_FAIL", err.message); }
      finally { for (const ticket of tickets) downloads.delete(ticket); }
    });
  }
  return server;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  startOfficial(Number(process.env.PORT ?? 8787), process.env.HOST ?? "127.0.0.1");
}
