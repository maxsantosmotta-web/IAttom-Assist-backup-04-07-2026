import http from 'node:http';
import { readFileSync, appendFileSync, existsSync, mkdirSync, openSync, closeSync, chmodSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {verifyStripeTestSignature,evaluateStripeTestEvent} from './stripe-test-event.mjs';
import {getCommercialPreviewPlan} from './official-compatibility.mjs';
import {planPendingHandoffs} from './pending-handoff.mjs';
import {prepareOfficialCheckout,createAuthorizedOfficialSession} from './official-checkout-contract.mjs';
import {fetchOfficialPublicCatalog} from './official-live-catalog.mjs';
import {openCheckoutIntentStore} from './checkout-intent-store.mjs';
import {verifyProductionClerkJwt,checkPublicClerkJwks} from './clerk-isolated-verifier.mjs';
import {getClerkVerifiedPrimaryEmail,compareVerifiedEmail} from './clerk-primary-email-readonly.mjs';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.PRE_SIGNUP_DATA_DIR || '/data';
const FILE = join(DATA_DIR, 'pre-registrations.jsonl');
const checkoutIntents=openCheckoutIntentStore({file:join(DATA_DIR,'checkout-selections.jsonl')});
const records = new Map();
const emailsByRegistrationId = new Map();
const visitors = new Map();
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
try { chmodSync(DATA_DIR, 0o700); } catch {}
if (!existsSync(FILE)) { const fd = openSync(FILE, 'a', 0o600); closeSync(fd); }
if (existsSync(FILE)) {
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const record = JSON.parse(line); if (record.email && record.id) { records.set(record.email, record.id); emailsByRegistrationId.set(record.id, record.email); } } catch {}
  }
}
function send(res, status, obj, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(obj));
}
function throttle(key) {
  const now = Date.now();
  const recent = (visitors.get(key) || []).filter(t => now - t < 3600000);
  recent.push(now); visitors.set(key, recent);
  return recent.length > 20;
}

const MEDIA_HOST = "https://fdb0ddbd-d838-437e-905b-7933427055a4.sandbox.floot.app";
const MEDIA_IMAGES = Object.freeze({"/assets/landing/modulos.png":"/_cdn/static/38fb713c-5196-46a1-8aac-4874691ce194-painel_modulos.png","/assets/landing/buscar.png":"/_cdn/static/738ba327-484c-4ee1-bf55-0050df9efbdb-buscar_produtos.png","/assets/landing/validar.png":"/_cdn/static/c021f130-b9c8-4406-8a88-fb86aac44886-validar_produtos.png","/assets/landing/campanha.png":"/_cdn/static/71cbbdfc-b88a-4fe8-8502-85bf6ab34d24-criar_campanha.png","/assets/landing/conteudo.png":"/_cdn/static/f2a5f0b0-ada2-476d-acc1-1c97d01e4588-criar_conteudo.png","/assets/landing/imagem.png":"/_cdn/static/240944a0-f68b-4946-bd95-d78270e069cf-gerar_imagem.png","/assets/landing/video.png":"/_cdn/static/0502d8b7-c772-43b1-9434-9b5f031a6a8c-video_efeito.png","/assets/landing/biblioteca.png":"/_cdn/static/1308e5b8-0a94-4281-aa08-117a082257eb-biblioteca.png"});
const MEDIA_DIR = join(DATA_DIR, 'landing-images');
const mediaPending = new Map();
mkdirSync(MEDIA_DIR,{recursive:true,mode:0o700});
async function getLandingImage(path) {
 const name=path.split('/').pop();
 const saved=join(MEDIA_DIR,name);
 if (existsSync(saved)) return readFileSync(saved);
 if (!mediaPending.has(path)) mediaPending.set(path,(async ()=>{
  const response=await fetch(MEDIA_HOST+MEDIA_IMAGES[path],{signal:AbortSignal.timeout(16000)});
  if(!response.ok || !response.headers.get('content-type')?.startsWith('image/png'))throw Error('Download do arquivo falhou');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<50000||bytes.length>3000000||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('PNG inválido');
  const temporary=saved+'.'+randomUUID()+'.tmp';
  writeFileSync(temporary,bytes,{mode:0o600});renameSync(temporary,saved);
  return bytes;
 })());
 try{return await mediaPending.get(path)}finally{mediaPending.delete(path)}
}


/* Checkout Stripe oficial: preparado, MAS IMPOSSÍVEL COBRAR nesta prévia isolada.
   Essas constantes não vêm do Railway e permanecem falsas até aprovação específica.
   A implementação segura Clerk/webhook/créditos é pré-condição adicional. */
const OFFICIAL_CHECKOUT_RELEASED = false;
const OFFICIAL_CLERK_CREDITS_BRIDGE_READY = false;
const OFFICIAL_PAYMENT_AUTHORIZED = false;
async function officialStripeRequest(path,fields=null,idempotencyKey=null){
 if(!OFFICIAL_CHECKOUT_RELEASED||!OFFICIAL_CLERK_CREDITS_BRIDGE_READY||!OFFICIAL_PAYMENT_AUTHORIZED)
  throw Error('Pagamento oficial não habilitado');
 const secret=process.env.STRIPE_LIVE_SECRET_KEY||'';
 if(!/^sk_live_[A-Za-z0-9]+$/.test(secret))throw Error('Stripe live não configurado');
 const headers={Authorization:'Bearer '+secret};
 if(fields)headers['Content-Type']='application/x-www-form-urlencoded';
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 const r=await fetch('https://api.stripe.com/v1'+path,{
  method:fields?'POST':'GET',headers,
  body:fields?new URLSearchParams(fields):undefined,
  signal:AbortSignal.timeout(12000)
 });
 const data=await r.json().catch(()=>null);
 if(!r.ok||!data)throw Error('Stripe oficial indisponível');
 return data;
}
const officialStripeAdapter=Object.freeze({
 retrievePrice:id=>officialStripeRequest('/prices/'+encodeURIComponent(id)),
 createCheckoutSession:(fields,idempotencyKey)=>{
  const body={
   mode:fields.mode,client_reference_id:fields.client_reference_id,
   'line_items[0][price]':fields.line_items[0].price,
   'line_items[0][quantity]':String(fields.line_items[0].quantity),
   success_url:fields.success_url,cancel_url:fields.cancel_url
  };
  for(const [key,value] of Object.entries(fields.metadata||{}))body['metadata['+key+']']=value;
  for(const [key,value] of Object.entries(fields.subscription_data?.metadata||{}))
   body['subscription_data[metadata]['+key+']']=value;
  return officialStripeRequest('/checkout/sessions',body,idempotencyKey);
 }
});
async function officialCheckout(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Método não permitido'},{Allow:'POST'});
 try {
  if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)
   return send(res,403,{error:'Origem não permitida'});
 }catch{return send(res,403,{error:'Origem inválida'})}
 if(throttle('official-plan:'+(req.socket.remoteAddress||'unknown')))
  return send(res,429,{error:'Muitas tentativas'});
 let raw='';
 try{
  for await(const chunk of req){
   raw+=chunk.toString('utf8');
   if(raw.length>2048)return send(res,413,{error:'Solicitação muito grande'});
  }
  const input=JSON.parse(raw),plan=input?.plan,registrationId=input?.registrationId;
  // Nem priceId, nem email, nem valor enviados pelo browser são aceitos como verdade.
  const storedEmail=emailsByRegistrationId.get(registrationId);
  if(!storedEmail)return send(res,403,{error:'Pré-cadastro não encontrado'});
  const prepared=prepareOfficialCheckout({
   plan,registrationId,registeredEmail:storedEmail,
   officialCheckoutReleased:OFFICIAL_CHECKOUT_RELEASED
  });
  if(!prepared.ok)return send(res,400,{error:'Plano ou pré-cadastro inválido',code:prepared.code});
  // Consulta REAL (somente GET) à API pública da versão oficial. Em qualquer
  // indisponibilidade/divergência, o botão falha fechado sem iniciar pagamento.
  const liveCatalog=await fetchOfficialPublicCatalog();
  if(!liveCatalog.verified)return send(res,503,{
   error:'Não foi possível confirmar o plano com a plataforma oficial. Tente novamente.',
   code:liveCatalog.code,checkoutEnabled:false,realPayments:false
  });
  const live=liveCatalog.plans.find(x=>x.name===plan);
  if(!live||live.priceId!==prepared.priceId||
     live.amountCents!==prepared.amountCents||live.internalPlanKey!==prepared.internalPlanKey)
   return send(res,409,{error:'Plano comercial não coincide com o catálogo oficial.',
    code:'OFFICIAL_PLAN_DISAGREEMENT',checkoutEnabled:false,realPayments:false});
  // Criamos um registro REAL exclusivamente no armazenamento do preview.
  // Isto NÃO constitui pagamento e não concede acesso.
  if(!OFFICIAL_CHECKOUT_RELEASED){
   const selection=checkoutIntents.create({registrationId,plan,
    priceId:live.priceId,amountCents:live.amountCents,
    generalCredits:live.generalCredits});
   if(!selection.ok)return send(res,503,{error:'Não foi possível salvar a seleção comercial.'});
   return send(res,200,{...prepared,prepared:true,
    officialCatalogVerified:true,generalCredits:live.generalCredits,
    selection:{id:selection.intentId,token:selection.intentToken,expiresAt:selection.expiresAt,
     status:selection.status},
    message:'Seleção gravada com segurança no servidor da landing. Não houve pagamento.'});
  }
  const session=await createAuthorizedOfficialSession({
   plan,registrationId,registeredEmail:storedEmail,
   officialCheckoutReleased:OFFICIAL_CHECKOUT_RELEASED,
   bridgeReconciliationReady:OFFICIAL_CLERK_CREDITS_BRIDGE_READY,
   authorizedProductionRelease:OFFICIAL_PAYMENT_AUTHORIZED,
   // O ID e o e-mail vieram do armazenamento do servidor. O comprovante
   // HMAC é criado no contrato; a titularidade é verificada depois pelo
   // e-mail principal confirmado no Clerk, nunca pelo pagador do Stripe.
   serverRegistrationProofVerified:true,
   callbackOrigin:'https://landing-comercial-preview-preview.up.railway.app',
   // Chave separada e compartilhada apenas entre os backends autorizados.
   // Não configurar no preview até existir a ponte homologada.
   sharedSigningKey:process.env.COMMERCIAL_REGISTRATION_HMAC_KEY,
   proofIssuedAt:Math.floor(Date.now()/1000),
   officialStripe:officialStripeAdapter,attemptId:randomUUID()
  });
  if(!session.ok)return send(res,503,{
   error:'Checkout não liberado até a reconciliação segura com Clerk e créditos',
   code:session.code
  });
  return send(res,200,session);
 }catch(e){
  console.error('Checkout oficial: intenção recusada',e.message);
  return send(res,400,{error:'Não foi possível preparar o checkout'});
 }
}

/* Checkout experimental isolado: nunca compartilha credenciais, preços nem banco com produção. */
const TEST_LANDING_ORIGIN = 'https://landing-comercial-preview-preview.up.railway.app';
const TEST_PRICES = Object.freeze({
  START: { env: 'STRIPE_TEST_PRICE_START', amount: 6900 },
  PREMIUM: { env: 'STRIPE_TEST_PRICE_PREMIUM', amount: 15900 },
  PRO: { env: 'STRIPE_TEST_PRICE_PRO', amount: 29900 }
});
function stripeTestConfigured() {
  const key = process.env.STRIPE_TEST_SECRET_KEY || '';
  return process.env.STRIPE_TEST_CHECKOUT_ENABLED === 'true' &&
    key.startsWith('sk_test_') &&
    Object.values(TEST_PRICES).every(v => /^price_[A-Za-z0-9]+$/.test(process.env[v.env] || ''));
}
function stripeTestRequest(path, fields = null, idempotencyKey = null) {
  const key = process.env.STRIPE_TEST_SECRET_KEY;
  if (!key?.startsWith('sk_test_')) throw new Error('Stripe test mode required');
  const headers = { Authorization: 'Bearer ' + key };
  if (fields) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return fetch('https://api.stripe.com/v1' + path, {
    method: fields ? 'POST' : 'GET',
    headers,
    body: fields ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(12000)
  }).then(async response => {
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error('Stripe test API unavailable (' + response.status + ')');
    return result;
  });
}
async function stripeTestCheckout(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' }, { Allow: 'POST' });
  if (req.headers.origin !== TEST_LANDING_ORIGIN) return send(res, 403, { error: 'Origem não permitida' });
  if (throttle('stripe-test:' + (req.socket.remoteAddress || 'unknown'))) return send(res, 429, { error: 'Muitas tentativas.' });
  let raw = '';
  try {
    for await (const chunk of req) {
      raw += chunk.toString('utf8');
      if (raw.length > 2048) return send(res, 413, { error: 'Solicitação muito grande' });
    }
    const input = JSON.parse(raw);
    const plan = typeof input.plan === 'string' ? input.plan.toUpperCase() : '';
    const id = typeof input.registrationId === 'string' ? input.registrationId : '';
    if (!Object.hasOwn(TEST_PRICES, plan) || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)) {
      return send(res, 400, { error: 'Plano ou pré-cadastro inválido.' });
    }
    const email = emailsByRegistrationId.get(id);
    if (!email) return send(res, 403, { error: 'Pré-cadastro não encontrado. Registre seu e-mail antes de escolher um plano.' });
    if (!stripeTestConfigured()) {
      return send(res, 503, { error: 'Checkout de teste ainda não configurado. Nenhuma cobrança foi realizada.' });
    }
    const selected = TEST_PRICES[plan];
    const contract = getCommercialPreviewPlan(plan);
    if (!contract || contract.amountBRL !== selected.amount) return send(res,409,{error:'Plano comercial incompatível'});
    const priceId = process.env[selected.env];
    // Confere plano/valor/moeda/ciclo e impede IDs ou chaves de modo real.
    const price = await stripeTestRequest('/prices/' + encodeURIComponent(priceId));
    if (price.id !== priceId || price.livemode !== false || price.active !== true ||
        price.currency !== 'brl' || price.unit_amount !== selected.amount ||
        price.type !== 'recurring' || price.recurring?.interval !== 'month' ||
        price.recurring?.interval_count !== 1) {
      return send(res, 409, { error: 'O preço de testes não corresponde ao plano mensal configurado.' });
    }
    // Stripe coleta o e-mail de pagamento separadamente e cria o Customer.
    const session = await stripeTestRequest('/checkout/sessions', {
      mode: 'subscription',
      client_reference_id: id,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: TEST_LANDING_ORIGIN + '/?checkout_test=retorno&session_id={CHECKOUT_SESSION_ID}#planos',
      cancel_url: TEST_LANDING_ORIGIN + '/?checkout_test=cancelado#planos',
      'metadata[pre_registration_id]': id,
      'metadata[plan]': plan,
      'subscription_data[metadata][pre_registration_id]': id,
      'subscription_data[metadata][plan]': plan,
      'subscription_data[metadata][planKey]': contract.legacyPlanKey
    });
    if (session.livemode !== false || !session.id?.startsWith('cs_test_') ||
        !session.url?.startsWith('https://checkout.stripe.com/')) {
      throw new Error('Invalid test checkout session');
    }
    const sessionRecord={sessionId:session.id,registrationId:id,email,customerId:null,
      amount:selected.amount,plan,createdAt:new Date().toISOString()};
    // Grava o vínculo antes de fornecer a URL, para reconciliação idempotente por webhook.
    appendFileSync(TEST_SESSIONS_FILE,JSON.stringify(sessionRecord)+'\n',{flag:'a',encoding:'utf8',mode:0o600});
    testSessions.set(session.id,sessionRecord);
    return send(res, 200, { ok: true, mode: 'test', plan, url: session.url });
  } catch (error) {
    console.error('Stripe checkout isolado: erro na preparação do teste:', error.message);
    return send(res, 502, { error: 'Não foi possível criar o checkout de teste. Nenhuma assinatura foi ativada.' });
  }
}


/* Confirmações virtuais em /data, jamais no banco/Clerk do IAttom em produção. */
const TEST_SESSIONS_FILE=join(DATA_DIR,'stripe-test-sessions.jsonl');
const TEST_EVENTS_FILE=join(DATA_DIR,'stripe-test-events.jsonl');
const TEST_HANDOFFS_FILE=join(DATA_DIR,'stripe-test-handoffs.jsonl');
const testSessions=new Map();
const processedTestEvents=new Set();
const testPaymentStatus=new Map();
const pendingTestHandoffs=new Map();
for(const line of existsSync(TEST_SESSIONS_FILE)?readFileSync(TEST_SESSIONS_FILE,'utf8').split('\n'):[]){
 if(!line.trim())continue;
 try{
   const saved=JSON.parse(line);
   if(saved.sessionId?.startsWith('cs_test_')&&saved.registrationId&&saved.email)
     testSessions.set(saved.sessionId,saved);
 }catch{}
}
for(const line of existsSync(TEST_EVENTS_FILE)?readFileSync(TEST_EVENTS_FILE,'utf8').split('\n'):[]){
 if(!line.trim())continue;
 try{
   const row=JSON.parse(line);
   if(row.eventId&&row.sessionId){
     processedTestEvents.add(row.eventId);testPaymentStatus.set(row.sessionId,row.status);
     const saved=testSessions.get(row.sessionId);
     if(saved&&row.customerId?.startsWith('cus_')){
       if(saved.customerId&&saved.customerId!==row.customerId)console.error('Customer diferente em evento persistido');
       else saved.customerId=row.customerId;
     }
   }
 }catch{}
}
for(const line of existsSync(TEST_HANDOFFS_FILE)?readFileSync(TEST_HANDOFFS_FILE,'utf8').split('\n'):[]){
 if(!line.trim())continue;
 try{const row=JSON.parse(line);if(row.sessionId?.startsWith('cs_test_')&&row.accountActivated===false)
   pendingTestHandoffs.set(row.sessionId,row)}catch{}
}
// Recuperação após falha entre evento durável e fila de pendências.
for(const line of existsSync(TEST_EVENTS_FILE)?readFileSync(TEST_EVENTS_FILE,'utf8').split('\n'):[]){
 if(!line.trim())continue;
 try{
   const eventRow=JSON.parse(line);
   if(eventRow.status!=='PAID_TEST'||pendingTestHandoffs.has(eventRow.sessionId))continue;
   const rows=planPendingHandoffs(eventRow,testSessions.get(eventRow.sessionId),pendingTestHandoffs);
   for(const row of rows){
     appendFileSync(TEST_HANDOFFS_FILE,JSON.stringify(row)+'\n',{flag:'a',encoding:'utf8',mode:0o600});
     pendingTestHandoffs.set(row.sessionId,row);
   }
 }catch(error){console.error('Recuperação de pendência isolada:',error.message)}
}
function stripeTestWebhookEnabled(){
 return stripeTestConfigured()&&process.env.STRIPE_TEST_WEBHOOK_ENABLED==='true'&&
    typeof process.env.STRIPE_TEST_WEBHOOK_SECRET==='string'&&
    process.env.STRIPE_TEST_WEBHOOK_SECRET.startsWith('whsec_');
}
async function stripeTestWebhook(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Método não permitido'},{Allow:'POST'});
 if(!stripeTestWebhookEnabled())return send(res,503,{error:'Webhook de testes não habilitado'});
 let raw=Buffer.alloc(0);
 try{
   for await(const chunk of req){
     raw=Buffer.concat([raw,chunk]);
     if(raw.length>262144)return send(res,413,{error:'Evento muito grande'});
   }
   if(!verifyStripeTestSignature(raw,req.headers['stripe-signature'],process.env.STRIPE_TEST_WEBHOOK_SECRET))
     return send(res,400,{error:'Assinatura inválida'});
   const event=JSON.parse(raw.toString('utf8'));
   const decision=evaluateStripeTestEvent(event,{
      sessions:testSessions,registrations:emailsByRegistrationId,
      seenEvents:processedTestEvents,statusBySession:testPaymentStatus
   });
   if(decision.ignored)return send(res,200,{received:true,ignored:true,mode:'test'});
   if(decision.duplicate)return send(res,200,{received:true,duplicate:true,mode:'test'});
   appendFileSync(TEST_EVENTS_FILE,JSON.stringify({
      eventId:decision.eventId,sessionId:decision.sessionId,registrationId:decision.registrationId,
      plan:decision.plan,status:decision.status,customerId:decision.customerId,receivedAt:new Date().toISOString(),
      accountActivated:false
   })+'\n',{flag:'a',encoding:'utf8',mode:0o600});
   processedTestEvents.add(decision.eventId);testPaymentStatus.set(decision.sessionId,decision.status);
   const savedSession=testSessions.get(decision.sessionId);
   if(savedSession&&!savedSession.customerId)savedSession.customerId=decision.customerId;
   if(decision.status==='PAID_TEST'){
     const rows=planPendingHandoffs(decision,testSessions.get(decision.sessionId),pendingTestHandoffs);
     for(const row of rows){
       appendFileSync(TEST_HANDOFFS_FILE,JSON.stringify(row)+'\n',{flag:'a',encoding:'utf8',mode:0o600});
       pendingTestHandoffs.set(row.sessionId,row);
     }
   }
   return send(res,200,{received:true,mode:'test',accountActivated:false});
 }catch(error){
   console.error('Webhook Stripe de testes rejeitado:',error.message);
   if(error instanceof SyntaxError||/Evento inválido|vínculo válido|diverge|Estado de pagamento|Sucesso sem/.test(error.message))
     return send(res,400,{error:'Evento de teste inválido'});
   return send(res,503,{error:'Evento não confirmado'});
 }
}

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/assets/screens.svg': ['assets/screens.svg', 'image/svg+xml'],
  '/assets/brand.jpg': ['assets/brand.jpg', 'image/jpeg'],
  '/favicon.svg': ['assets/favicon.svg', 'image/svg+xml']
};
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  if (path === '/healthz') return send(res, 200, { ok: true });
  if (path === '/api/stripe/test-status') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido' }, { Allow: 'GET' });
    return send(res, 200, { mode: 'test', ready: stripeTestConfigured(), realPayments: false });
  }
  if (path === '/api/official/catalog-status') {
    if(req.method!=='GET')return send(res,405,{error:'Método não permitido'},{Allow:'GET'});
    const live=await fetchOfficialPublicCatalog();
    if(!live.verified)return send(res,503,live);
    return send(res,200,live);
  }
  if(path==='/api/checkout/selection-status'){
   if(req.method!=='POST')return send(res,405,{error:'Método não permitido'},{Allow:'POST'});
   try{
    if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)
     return send(res,403,{error:'Origem não permitida'});
   }catch{return send(res,403,{error:'Origem inválida'})}
   if(throttle('selection-status:'+(req.socket.remoteAddress||'unknown')))
    return send(res,429,{error:'Muitas tentativas'});
   let raw='';
   try{
    for await(const chunk of req){
     raw+=chunk.toString('utf8');
     if(raw.length>512)return send(res,413,{error:'Solicitação muito grande'});
    }
    const payload=JSON.parse(raw);
    const v=checkoutIntents.status({
     intentId:payload?.id,intentToken:payload?.token
    });
    if(!v.ok)return send(res,v.code==='INTENT_EXPIRED'?410:404,{
     error:'Seleção indisponível ou expirada',code:v.code});
    return send(res,200,v);
   }catch{return send(res,400,{error:'Seleção inválida'})}
  }
  // Independent read-only Clerk signature validation. Never an entitlement.
  if(path==='/api/bridge/clerk-key-status'){
   if(req.method!=='GET')return send(res,405,{error:'Método não permitido'},{Allow:'GET'});
   const proof=await checkPublicClerkJwks();
   return send(res,proof.ok?200:503,proof);
  }
  if(path==='/api/bridge/verify-clerk-session'){
   if(req.method!=='POST')return send(res,405,{error:'Método não permitido'},{Allow:'POST'});
   try{
    if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)
     return send(res,403,{error:'Origem não permitida'});
   }catch{return send(res,403,{error:'Origem inválida'})}
   if(throttle('verify-clerk:'+(req.socket.remoteAddress||'unknown')))
    return send(res,429,{error:'Muitas tentativas'});
   const authorization=req.headers.authorization;
   if(typeof authorization!=='string'||!authorization.startsWith('Bearer ')){
    return send(res,401,{error:'Sessão Clerk necessária'});
   }
   const auth=await verifyProductionClerkJwt(authorization.slice(7));
   if(!auth.ok)return send(res,401,{error:'Sessão Clerk não verificada'});
   // Do NOT return userId, sid, token, emails or any entitlement here.
   return send(res,200,{ok:true,code:auth.code,issuer:'https://clerk.iattomassist.com.br',
    sessionSignatureVerified:true,revocationNotChecked:true,
    emailVerified:false,paymentConfirmed:false,subscriptionLinked:false,
    accountActivated:false,creditsGranted:0});
  }
  // Protected match: read-only. Disabled until separate credential is explicitly authorised.
  if(path==='/api/bridge/verify-registration-email'){
   if(req.method!=='POST')return send(res,405,{error:'Método não permitido'},{Allow:'POST'});
   if(process.env.CLERK_BRIDGE_READ_ENABLED!=='true')
    return send(res,503,{ok:false,code:'CLERK_READ_DISABLED',
      paymentConfirmed:false,accountActivated:false,creditsGranted:0});
   try{
    if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)
     return send(res,403,{error:'Origem não permitida'});
   }catch{return send(res,403,{error:'Origem inválida'})}
   if(throttle('email-clerk:'+(req.socket.remoteAddress||'unknown')))
    return send(res,429,{error:'Muitas tentativas'});
   const authorization=req.headers.authorization;
   if(typeof authorization!=='string'||!authorization.startsWith('Bearer '))
    return send(res,401,{ok:false,code:'CLERK_JWT_MISSING'});
   const auth=await verifyProductionClerkJwt(authorization.slice(7));
   if(!auth.ok)return send(res,401,{ok:false,code:'CLERK_JWT_INVALID'});
   let raw='';
   try{
    for await(const part of req){
     raw+=part.toString('utf8');
     if(raw.length>512)return send(res,413,{error:'Solicitação muito grande'});
    }
    const fields=JSON.parse(raw);
    const selection=checkoutIntents.resolveInternal({intentId:fields?.id,intentToken:fields?.token});
    if(!selection.ok)return send(res,404,{ok:false,code:'SELECTION_NOT_FOUND'});
    const registrationEmail=emailsByRegistrationId.get(selection.registrationId);
    if(!registrationEmail)return send(res,404,{ok:false,code:'REGISTRATION_NOT_FOUND'});
    const verified=await getClerkVerifiedPrimaryEmail({
      userId:auth.clerkUserId,secret:process.env.CLERK_BRIDGE_READ_SECRET_KEY,
      enabled:process.env.CLERK_BRIDGE_READ_ENABLED==='true'});
    if(!verified.ok)return send(res,503,{ok:false,code:verified.code,
      paymentConfirmed:false,accountActivated:false,creditsGranted:0});
    const matched=compareVerifiedEmail(verified.verifiedEmail,registrationEmail);
    return send(res,matched.ok?200:409,{ok:matched.ok,code:matched.code,
      identityMatch:matched.ok,subscriptionLinked:false,
      paymentConfirmed:false,accountActivated:false,creditsGranted:0});
   }catch{return send(res,400,{ok:false,code:'REGISTRATION_MATCH_FAILED'})}
  }
  if (path === '/api/stripe/official-checkout') return officialCheckout(req, res);
  if (path === '/api/stripe/test-checkout') return stripeTestCheckout(req, res);
  if (path === '/api/stripe/test-webhook') return stripeTestWebhook(req, res);
  if (path === '/api/pre-register') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' }, { Allow: 'POST' });
    const origin = req.headers.origin;
    if (origin) { try { if (new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'Origem não permitida' }); } catch { return send(res, 403, { error: 'Origem inválida' }); } }
    const key = req.socket.remoteAddress || 'unknown';
    if (throttle(key)) return send(res, 429, { error: 'Muitas tentativas. Tente novamente mais tarde.' });
    let raw = '';
    try {
      for await (const chunk of req) {
        raw += chunk.toString('utf8');
        if (raw.length > 4096) return send(res, 413, { error: 'Solicitação muito grande' });
      }
      const data = JSON.parse(raw);
      if (data.website) return send(res, 200, { ok: true });
      const email = String(data.email || '').trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: 'Informe um e-mail válido.' });
      let id = records.get(email);
      if (!id) {
        id = randomUUID();
        appendFileSync(FILE, JSON.stringify({ id, email, createdAt: new Date().toISOString(), source: 'commercial-preview' }) + '\n', { encoding: 'utf8', flag: 'a', mode: 0o600 });
        records.set(email, id);
        emailsByRegistrationId.set(id, email);
      }
      return send(res, 200, { ok: true, registrationId: id, email, next: 'plans' });
    } catch { return send(res, 400, { error: 'Não foi possível processar o e-mail.' }); }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Método não permitido' });

  if(Object.hasOwn(MEDIA_IMAGES,path)){
    try{
      const bytes=await getLandingImage(path);
      res.writeHead(200,{"Content-Type":"image/png","Content-Length":bytes.length,"Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff"});
      return req.method==="HEAD"?res.end():res.end(bytes);
    }catch(err){console.error('Imagem comercial',path,err.message);return send(res,503,{error:"Imagem temporariamente indisponível"})}
  }
  if (path === '/assets/screens.webp') {
    try {
      const encoded = [1,2,3,4,5].map(i=>readFileSync(join(import.meta.dirname,'assets','screens.b64.'+i),'utf8')).join('');
      const bytes = Buffer.from(encoded,'base64');
      if (bytes.length !== 10204 || bytes.subarray(0,4).toString('ascii') !== 'RIFF' || bytes.subarray(8,12).toString('ascii') !== 'WEBP') throw new Error('Invalid screenshot sprite');
      res.writeHead(200, { 'Content-Type':'image/webp','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff' });
      if (req.method==='HEAD') return res.end();
      return res.end(bytes);
    } catch { return send(res,500,{error:'Imagem indisponível'}); }
  }
  const f = files[path];
  if (!f) return send(res, 404, { error: 'Não encontrado' });
  try {
    const bytes = readFileSync(join(import.meta.dirname, f[0]));
    res.writeHead(200, { 'Content-Type': f[1], 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none';" });
    if (req.method === 'HEAD') return res.end();
    return res.end(bytes);
  } catch { return send(res, 404, { error: 'Arquivo indisponível' }); }
});
server.listen(PORT, '0.0.0.0', () => console.log('commercial preview listening on', PORT));
