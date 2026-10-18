/**
 * Conexão REAL apenas de leitura com o catálogo público do backend IAttom Assist
 * em produção. Sem Stripe secrets, Clerk secrets, autorização, DB ou faturamento.
 * A origem é fixada no código, NÃO pode ser definida por parâmetro de navegador.
 */
import {OFFICIAL_MONTHLY_PLANS} from './official-checkout-contract.mjs';
export const LIVE_OFFICIAL_CATALOG_URL=
 'https://www.iattomassist.com.br/api/stripe/commercial/plans';
const CREDIT_LIMITS=Object.freeze({START:200,PREMIUM:500,PRO:1000});
const result=(verified,code,items=[])=>Object.freeze({
 verified,code,source:'official_public_api',readOnly:true,
 checkoutEnabled:false,realPayments:false,accountActivated:false,
 creditsGranted:0,plans:items
});
export function validateOfficialPublicCatalog(raw){
 if(!Array.isArray(raw)||raw.length<3||raw.length>20)
  return result(false,'OFFICIAL_CATALOG_NOT_A_PLAN_LIST');
 const byKey=new Map();
 for(const record of raw){
  if(!record||typeof record!=='object'||Array.isArray(record)||
     typeof record.planKey!=='string')
   return result(false,'OFFICIAL_PLAN_INVALID');
  if(byKey.has(record.planKey))return result(false,'OFFICIAL_PLAN_KEY_DUPLICATED');
  byKey.set(record.planKey,record);
 }
 const plans=[];
 for(const name of ['START','PREMIUM','PRO']){
  const local=OFFICIAL_MONTHLY_PLANS[name];
  const live=byKey.get(local.planKey);
  if(!live)return result(false,'OFFICIAL_PLAN_MISSING');
  if(live.name!==name||live.priceId!==local.priceId||
     live.amount!==local.amountCents||live.currency!=='brl'||
     live.interval!=='month'||live.credits!==CREDIT_LIMITS[name])
   return result(false,'OFFICIAL_PLAN_PRICE_OR_BENEFITS_MISMATCH');
  plans.push(Object.freeze({name,internalPlanKey:local.planKey,
   priceId:live.priceId,amountCents:live.amount,
   currency:live.currency,interval:live.interval,
   generalCredits:live.credits}));
 }
 return result(true,'OFFICIAL_CATALOG_VERIFIED',plans);
}
export async function fetchOfficialPublicCatalog({fetcher=fetch}={}){
 // Apenas a URL fechada e sem parâmetros do servidor pode ser consultada.
 try{
  const remote=await fetcher(LIVE_OFFICIAL_CATALOG_URL,{
   method:'GET',headers:{Accept:'application/json'},
   redirect:'error',signal:AbortSignal.timeout(6500)
  });
  if(!remote||remote.status!==200)return result(false,'OFFICIAL_CATALOG_HTTP_UNAVAILABLE');
  if(!remote.headers?.get('content-type')?.toLowerCase().includes('application/json'))
   return result(false,'OFFICIAL_CATALOG_NOT_JSON');
  const len=remote.headers.get('content-length');
  if(len!==null&&(!/^\d+$/.test(len)||Number(len)>32768))
   return result(false,'OFFICIAL_CATALOG_TOO_LARGE');
  const reader=remote.body?.getReader();
  if(!reader)return result(false,'OFFICIAL_CATALOG_BODY_UNAVAILABLE');
  const parts=[];let size=0;
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>32768){await reader.cancel();return result(false,'OFFICIAL_CATALOG_TOO_LARGE')}
   parts.push(value);
  }
  const raw=JSON.parse(Buffer.concat(parts.map(p=>Buffer.from(p))).toString('utf8'));
  return validateOfficialPublicCatalog(raw);
 }catch{
  return result(false,'OFFICIAL_CATALOG_NETWORK_OR_PARSE_FAILED');
 }
}
