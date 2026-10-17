import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openLocalClaimStore} from '../local-durable-claim-prototype.mjs';
import {OFFICIAL_MONTHLY_PLANS} from '../official-checkout-contract.mjs';
const p=(plan='PREMIUM',n='1')=>({
 mode:'READ_ONLY_PREFLIGHT',code:'VERIFIED_READ_ONLY_AWAITING_SAFE_CLAIM',
 eligible:true,accountActivated:false,creditsGranted:0,productionWrites:0,
 commercialPlan:plan,internalPlan:OFFICIAL_MONTHLY_PLANS[plan].planKey,
 priceId:OFFICIAL_MONTHLY_PLANS[plan].priceId,
 sessionId:'cs_live_'+n,subscriptionId:'sub_'+n,customerId:'cus_'+n,
 verifiedClerkId:'user_'+n,verifiedInvoiceId:'in_'+n,
 registrationId:'reg_valid_'+n+'_id'
});
function withStore(fn){
 const folder=mkdtempSync(join(tmpdir(),'iattom-claims-')),file=join(folder,'claims.sqlite');
 const store=openLocalClaimStore({file,simulationOnly:true});
 try{return fn({store,open:()=>openLocalClaimStore({file,simulationOnly:true})})}
 finally{store.close();rmSync(folder,{recursive:true,force:true})}
}
const receipt=w=>({
 simulationOnly:true,ok:true,
 clerkUserId:w.wouldInvokeCanonicalWith.clerkUserId,
 subscriptionId:w.wouldInvokeCanonicalWith.subscriptionId,
 invoiceId:w.wouldInvokeCanonicalWith.invoiceId,
 priceId:w.wouldInvokeCanonicalWith.priceId,
 planKey:w.wouldInvokeCanonicalWith.planKey
});
test('requires explicit local simulation and absolute SQLite path',()=>{
 assert.throws(()=>openLocalClaimStore({file:'/tmp/should-not-exist.sqlite'}));
 assert.throws(()=>openLocalClaimStore({file:'relative.sqlite',simulationOnly:true}));
});
test('START PREMIUM PRO official Price IDs persist without credit changes',()=>{
 for(const plan of ['START','PREMIUM','PRO'])withStore(({store})=>{
  const e=p(plan,plan);
  assert.equal(store.register(e).code,'PERSISTED_PENDING');
  assert.equal(store.inspect(e.sessionId).priceId,OFFICIAL_MONTHLY_PLANS[plan].priceId);
  assert.equal(store.inspect(e.sessionId).creditsGranted,0);
 });
});
test('reject Price ID or preflight tampering',()=>withStore(({store})=>{
 const e=p();e.priceId='price_wrong';
 assert.equal(store.register(e).code,'INVALID_PREFLIGHT');
 assert.equal(store.inspect(e.sessionId),null);
}));
test('idempotent retries and 20 same-session submit calls',()=>withStore(({store})=>{
 const e=p(),responses=Array.from({length:20},()=>store.register(e).code);
 assert.equal(responses.filter(x=>x==='PERSISTED_PENDING').length,1);
 assert.equal(responses.filter(x=>x==='ALREADY_REGISTERED').length,19);
}));
test('all five ownership keys reject conflicting associations',()=>withStore(({store})=>{
 store.register(p());
 for(const field of ['sessionId','subscriptionId','customerId','registrationId','verifiedClerkId']){
  const e=p('START','2');e[field]=p()[field];
  assert.equal(store.register(e).code,'OWNERSHIP_CONFLICT',field);
 }
 assert.equal(store.inspect('cs_live_2'),null);
}));
test('two SQLite connections cannot lease one claim simultaneously',()=>withStore(({store,open})=>{
 const e=p();store.register(e);const other=open();
 try{
  const first=store.acquire(e.sessionId,{at:100,leaseMs:1000});
  assert.equal(first.code,'LEASE_ACQUIRED');
  assert.equal(other.acquire(e.sessionId,{at:101}).code,'LEASE_BUSY');
  assert.equal(store.inspect(e.sessionId).attempts,1);
 }finally{other.close()}
}));
test('restart-style reopen preserves state, expired lease takeover fences stale worker',()=>withStore(({store,open})=>{
 const e=p();store.register(e);
 const first=store.acquire(e.sessionId,{at:100,leaseMs:1000});
 const reopened=open();
 try{
  assert.equal(reopened.inspect(e.sessionId).state,'LEASED');
  assert.equal(reopened.acquire(e.sessionId,{at:300}).code,'LEASE_BUSY');
  const newer=reopened.acquire(e.sessionId,{at:1101});
  assert.equal(newer.code,'LEASE_ACQUIRED');
  assert.notEqual(newer.token,first.token);
  assert.equal(store.completeVirtual(e.sessionId,first.token,receipt(first),{at:1102}).code,
   'STALE_WORKER');
  assert.equal(reopened.completeVirtual(e.sessionId,newer.token,receipt(newer),{at:1102}).code,
   'VIRTUAL_COMPLETED');
 }finally{reopened.close()}
}));
test('cannot finish on mismatched Clerk, subscription, price, invoice or plan',()=>withStore(({store})=>{
 const e=p();store.register(e);
 const worker=store.acquire(e.sessionId,{at:100,leaseMs:2000});
 for(const bad of [{clerkUserId:'user_b'}, {subscriptionId:'sub_fake'},
  {priceId:'price_false'}, {invoiceId:'in_fake'}, {planKey:'agency'},
  {simulationOnly:false}]){
  assert.equal(store.completeVirtual(e.sessionId,worker.token,
   {...receipt(worker),...bad},{at:101}).code,'RECEIPT_MISMATCH');
 }
 assert.equal(store.completeVirtual(e.sessionId,worker.token,receipt(worker),{at:102}).code,
  'VIRTUAL_COMPLETED');
 assert.equal(store.acquire(e.sessionId,{at:103}).code,'ALREADY_DONE');
}));
test('failure can retry with new fencing token',()=>withStore(({store})=>{
 const e=p();store.register(e);
 const first=store.acquire(e.sessionId,{at:100});
 assert.equal(store.scheduleRetry(e.sessionId,first.token,{at:101}).code,'RETRYABLE');
 const second=store.acquire(e.sessionId,{at:102});
 assert.notEqual(second.token,first.token);
 assert.equal(store.completeVirtual(e.sessionId,first.token,receipt(first),{at:103}).code,
  'STALE_WORKER');
 assert.equal(store.completeVirtual(e.sessionId,second.token,receipt(second),{at:103}).code,
  'VIRTUAL_COMPLETED');
}));
test('no lease means no completion and never real credits',()=>withStore(({store})=>{
 const e=p();store.register(e);
 assert.equal(store.completeVirtual(e.sessionId,'made-up',{ok:true}).code,'STALE_WORKER');
 assert.equal(store.inspect(e.sessionId).state,'PENDING');
 assert.equal(store.inspect(e.sessionId).creditsGranted,0);
}));
