/** Landing preview only. A selection record is NOT payment, identity or credits. */
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync} from 'node:fs';
import {dirname,isAbsolute} from 'node:path';
import {OFFICIAL_MONTHLY_PLANS} from './official-checkout-contract.mjs';
export const INTENT_TTL_MS=86400000;
const CREDITS=Object.freeze({START:200,PREMIUM:500,PRO:1000});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const digest=x=>createHash('sha256').update(x).digest();
const fail=code=>({ok:false,code,accountActivated:false,creditsGranted:0});
const view=r=>({intentId:r.id,plan:r.plan,priceId:r.priceId,
 amountCents:r.amountCents,generalCredits:r.generalCredits,
 expiresAt:r.expiresAt,status:'AWAITING_CHECKOUT',
 paymentConfirmed:false,accountActivated:false,creditsGranted:0});
export function openCheckoutIntentStore({file,clock=()=>Date.now()}={}){
 if(typeof file!=='string'||!isAbsolute(file)||!file.endsWith('.jsonl'))throw Error('ABSOLUTE_INTENT_FILE_REQUIRED');
 mkdirSync(dirname(file),{recursive:true,mode:0o700});
 const records=new Map();
 if(existsSync(file))for(const l of readFileSync(file,'utf8').split('\n')){
  if(!l.trim())continue;
  try{const r=JSON.parse(l);
   if(uuid(r.id)&&uuid(r.registrationId)&&
    Object.hasOwn(OFFICIAL_MONTHLY_PLANS,r.plan)&&
    r.priceId===OFFICIAL_MONTHLY_PLANS[r.plan].priceId&&
    r.amountCents===OFFICIAL_MONTHLY_PLANS[r.plan].amountCents&&
    r.generalCredits===CREDITS[r.plan]&&
    typeof r.tokenHash==='string'&&/^[a-f0-9]{64}$/.test(r.tokenHash)&&
    Number.isSafeInteger(r.createdAt)&&r.expiresAt===r.createdAt+INTENT_TTL_MS)
    records.set(r.id,r);
  }catch{/* partial trailing line after crash is ignored */}
 }
 function create({registrationId,plan,priceId,amountCents,generalCredits}={}){
  const p=typeof plan==='string'&&OFFICIAL_MONTHLY_PLANS[plan];
  if(!uuid(registrationId)||!p||priceId!==p.priceId||
     amountCents!==p.amountCents||generalCredits!==CREDITS[plan])
   return fail('INVALID_SELECTION');
  const id=randomUUID(),token=randomBytes(32).toString('base64url'),createdAt=clock();
  if(!Number.isSafeInteger(createdAt)||createdAt<0||!Number.isSafeInteger(createdAt+INTENT_TTL_MS))
   return fail('INVALID_CLOCK');
  const r={id,registrationId,plan,priceId,amountCents,generalCredits,
   tokenHash:digest(id+'.'+token).toString('hex'),
   createdAt,expiresAt:createdAt+INTENT_TTL_MS};
  const fd=openSync(file,'a',0o600);
  try{const bytes=Buffer.from(JSON.stringify(r)+'\n');let pos=0;
   while(pos<bytes.length){const written=writeSync(fd,bytes,pos,bytes.length-pos);if(written<=0)throw Error('APPEND_FAILED');pos+=written}
   fsyncSync(fd);
  }finally{closeSync(fd)}
  records.set(id,r);
  return {ok:true,code:'SELECTION_RECORDED_NOT_PAID',...view(r),intentToken:token,checkoutEnabled:false};
 }
 function status({intentId,intentToken}={}){
  if(!uuid(intentId)||typeof intentToken!=='string'||
     !/^[a-zA-Z0-9_-]{43}$/.test(intentToken))return fail('INTENT_NOT_FOUND');
  const r=records.get(intentId);
  if(!r)return fail('INTENT_NOT_FOUND');
  if(!timingSafeEqual(digest(intentId+'.'+intentToken),Buffer.from(r.tokenHash,'hex')))
   return fail('INTENT_NOT_FOUND');
  if(clock()>=r.expiresAt)return fail('INTENT_EXPIRED');
  return {ok:true,code:'SELECTION_RESTORED_NOT_PAID',...view(r),checkoutEnabled:false};
 }
 function resolveInternal({intentId,intentToken}={}){
  const verified=status({intentId,intentToken});
  if(!verified.ok)return {ok:false,code:verified.code};
  const rec=records.get(intentId);
  if(!rec)return {ok:false,code:'INTENT_NOT_FOUND'};
  return {ok:true,registrationId:rec.registrationId,plan:rec.plan,
   paymentConfirmed:false,accountActivated:false,creditsGranted:0};
 }
 return Object.freeze({create,status,resolveInternal});
}
