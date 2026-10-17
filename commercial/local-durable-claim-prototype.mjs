/** LOCAL SQLITE TEST ONLY. No real Stripe, Clerk, database or credit access.
 * Demonstrates durable guest claims, unique ownership, lease and fencing.
 * NOT a production bridge, NOT safe to import into official backend.
 */
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {OFFICIAL_MONTHLY_PLANS} from './official-checkout-contract.mjs';
const result=(code,more={})=>({mode:'LOCAL_SQLITE_SIMULATION',code,accountActivated:false,
 creditsGranted:0,productionWrites:0,...more});
const id=(v,p)=>typeof v==='string'&&v.startsWith(p)&&v.length>p.length;
const when=n=>Number.isSafeInteger(n)&&n>=0?n:Date.now();
function valid(e){
 const p=e?.commercialPlan&&OFFICIAL_MONTHLY_PLANS[e.commercialPlan];
 return e?.mode==='READ_ONLY_PREFLIGHT'&&e.code==='VERIFIED_READ_ONLY_AWAITING_SAFE_CLAIM'&&
 e.eligible===true&&e.accountActivated===false&&e.creditsGranted===0&&
 e.productionWrites===0&&p&&p.priceId===e.priceId&&p.planKey===e.internalPlan&&
 id(e.sessionId,'cs_live_')&&id(e.subscriptionId,'sub_')&&id(e.customerId,'cus_')&&
 id(e.verifiedClerkId,'user_')&&id(e.verifiedInvoiceId,'in_')&&
 typeof e.registrationId==='string'&&e.registrationId.length>=10;
}
export function openLocalClaimStore({file,simulationOnly=false}={}){
 if(!simulationOnly||typeof file!=='string'||!isAbsolute(file)||!/(\.sqlite|\.db)$/.test(file))
  throw Error('ISOLATED_SQLITE_REQUIRED');
 const db=new DatabaseSync(file,{timeout:3000});
 db.exec('PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL;');
 db.exec([
 'CREATE TABLE IF NOT EXISTS claims (session_id TEXT PRIMARY KEY NOT NULL,',
 'subscription_id TEXT NOT NULL UNIQUE,customer_id TEXT NOT NULL UNIQUE,',
 'registration_id TEXT NOT NULL UNIQUE,clerk_user_id TEXT NOT NULL UNIQUE,',
 'invoice_id TEXT NOT NULL,price_id TEXT NOT NULL,commercial_plan TEXT NOT NULL,',
 'internal_plan TEXT NOT NULL,',
 "state TEXT NOT NULL CHECK(state IN ('PENDING','LEASED','RETRYABLE','DONE')),",
 'lease_token TEXT,lease_until_ms INTEGER,attempts INTEGER NOT NULL DEFAULT 0,',
 'virtual_receipt TEXT,updated_at_ms INTEGER NOT NULL)'
 ].join(' '));
 const one=db.prepare('SELECT * FROM claims WHERE session_id = ?');
 const conflicts=db.prepare('SELECT * FROM claims WHERE session_id=? OR subscription_id=? OR customer_id=? OR registration_id=? OR clerk_user_id=? LIMIT 1');
 const insert=db.prepare('INSERT INTO claims(session_id,subscription_id,customer_id,registration_id,clerk_user_id,invoice_id,price_id,commercial_plan,internal_plan,state,updated_at_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
 const lease=db.prepare("UPDATE claims SET state='LEASED',lease_token=?,lease_until_ms=?,attempts=attempts+1,updated_at_ms=? WHERE session_id=?");
 const done=db.prepare("UPDATE claims SET state='DONE',lease_token=NULL,lease_until_ms=NULL,virtual_receipt=?,updated_at_ms=? WHERE session_id=? AND lease_token=?");
 const retry=db.prepare("UPDATE claims SET state='RETRYABLE',lease_token=NULL,lease_until_ms=NULL,updated_at_ms=? WHERE session_id=? AND lease_token=?");
 function atomic(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const v=fn();db.exec('COMMIT');return v}
  catch(err){db.exec('ROLLBACK');throw err}
 }
 function register(e,{at}={}){
  if(!valid(e))return result('INVALID_PREFLIGHT');
  return atomic(()=>{
   const old=conflicts.get(e.sessionId,e.subscriptionId,e.customerId,e.registrationId,e.verifiedClerkId);
   if(old){
    const same=old.session_id===e.sessionId&&old.subscription_id===e.subscriptionId&&
     old.customer_id===e.customerId&&old.registration_id===e.registrationId&&
     old.clerk_user_id===e.verifiedClerkId&&old.invoice_id===e.verifiedInvoiceId&&
     old.price_id===e.priceId&&old.commercial_plan===e.commercialPlan&&
     old.internal_plan===e.internalPlan;
    return result(same?'ALREADY_REGISTERED':'OWNERSHIP_CONFLICT');
   }
   insert.run(e.sessionId,e.subscriptionId,e.customerId,e.registrationId,
    e.verifiedClerkId,e.verifiedInvoiceId,e.priceId,e.commercialPlan,e.internalPlan,
    'PENDING',when(at));
   return result('PERSISTED_PENDING');
  });
 }
 function acquire(sessionId,{at,leaseMs=60000}={}){
  if(!id(sessionId,'cs_live_')||!Number.isSafeInteger(leaseMs)||
     leaseMs<1000||leaseMs>600000)return result('INVALID_LEASE');
  return atomic(()=>{
   const row=one.get(sessionId);
   if(!row)return result('NOT_FOUND');
   if(row.state==='DONE')return result('ALREADY_DONE');
   const current=when(at);
   if(row.state==='LEASED'&&row.lease_until_ms>current)return result('LEASE_BUSY');
   const token=randomUUID();
   lease.run(token,current+leaseMs,current,sessionId);
   return result('LEASE_ACQUIRED',{token,attempt:row.attempts+1,
    wouldInvokeCanonicalWith:{clerkUserId:row.clerk_user_id,
     subscriptionId:row.subscription_id,customerId:row.customer_id,
     invoiceId:row.invoice_id,priceId:row.price_id,planKey:row.internal_plan}});
  });
 }
 function completeVirtual(sessionId,token,receipt,{at}={}){
  return atomic(()=>{
   const row=one.get(sessionId);
   if(!row)return result('NOT_FOUND');
   if(row.state==='DONE')return result('ALREADY_DONE');
   if(row.state!=='LEASED'||row.lease_token!==token||
      row.lease_until_ms<=when(at))return result('STALE_WORKER');
   if(receipt?.simulationOnly!==true||receipt.ok!==true||
     receipt.clerkUserId!==row.clerk_user_id||
     receipt.subscriptionId!==row.subscription_id||
     receipt.invoiceId!==row.invoice_id||
     receipt.priceId!==row.price_id||receipt.planKey!==row.internal_plan)
    return result('RECEIPT_MISMATCH');
   done.run(JSON.stringify({simulationOnly:true,subscriptionId:row.subscription_id}),
    when(at),sessionId,token);
   return result('VIRTUAL_COMPLETED',{virtualPlan:row.commercial_plan});
  });
 }
 function scheduleRetry(sessionId,token,{at}={}){
  return atomic(()=>{
   const row=one.get(sessionId);
   if(!row)return result('NOT_FOUND');
   if(row.state!=='LEASED'||row.lease_token!==token||
      row.lease_until_ms<=when(at))return result('STALE_WORKER');
   retry.run(when(at),sessionId,token);
   return result('RETRYABLE');
  });
 }
 function inspect(sessionId){
  const row=one.get(sessionId);
  return row?Object.freeze({state:row.state,attempts:row.attempts,
   plan:row.commercial_plan,priceId:row.price_id,
   simulationOnly:true,accountActivated:false,creditsGranted:0,productionWrites:0}):null;
 }
 return Object.freeze({register,acquire,completeVirtual,scheduleRetry,inspect,close:()=>db.close()});
}
