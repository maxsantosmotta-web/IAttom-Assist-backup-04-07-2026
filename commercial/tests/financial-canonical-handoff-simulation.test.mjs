import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLocalClaimStore} from '../local-durable-claim-prototype.mjs';
import {OFFICIAL_MONTHLY_PLANS} from '../official-checkout-contract.mjs';
import {simulateCanonicalBridge,assessMockFinancialReconciliation}
 from '../financial-canonical-handoff-simulation.mjs';
const policy={simulationOnly:true,approvedCommercialPolicy:false,
 general:{pro:7,business:13,agency:19},creative:{pro:0,business:0,agency:0}};
function preflight(name='PREMIUM'){
 const p=OFFICIAL_MONTHLY_PLANS[name];
 return {mode:'READ_ONLY_PREFLIGHT',code:'VERIFIED_READ_ONLY_AWAITING_SAFE_CLAIM',
  eligible:true,accountActivated:false,creditsGranted:0,productionWrites:0,
  commercialPlan:name,internalPlan:p.planKey,priceId:p.priceId,
  sessionId:'cs_live_mock',subscriptionId:'sub_mock',customerId:'cus_mock',
  registrationId:'registration_mock_id',verifiedClerkId:'user_mock',
  verifiedInvoiceId:'in_mock'};
}
function mocks(e,{mode='',replay=false}={}){
 const calls={attach:0,canonical:0};
 const start=1728000000,end=1730592000;
 const key='subscription:'+e.subscriptionId+':'+e.priceId+':'+start+':'+end+':'+e.internalPlan+':general';
 const canonical=()=>({simulationOnly:true,ok:true,sourceMethod:'handleCanonicalSubscriptionChange',
  clerkUserId:e.verifiedClerkId,subscriptionId:e.subscriptionId,
  priceId:e.priceId,targetPlan:e.internalPlan,periodStart:start,periodEnd:end,
  generalGranted:replay?0:policy.general[e.internalPlan],
  generalAlreadyGranted:replay,creativeGranted:0});
 const ledger=()=>[{idempotencyKey:key,clerkUserId:e.verifiedClerkId,
  amount:policy.general[e.internalPlan],balanceType:'general',type:'credit'}];
 const user=()=>({simulationOnly:true,clerkId:e.verifiedClerkId,plan:e.internalPlan,
  stripeCustomerId:e.customerId,stripeSubscriptionId:e.subscriptionId,
  stripeSubscriptionStatus:'active',planSelected:true});
 return {calls,canonical,ledger,user,adapters:{
  mockAttachCustomer:async()=>{calls.attach++;if(mode==='attachError')throw Error('mock');
   return {simulationOnly:true,ok:true,clerkUserId:e.verifiedClerkId,
    customerId:mode==='wrongCustomer'?'cus_wrong':e.customerId,
    subscriptionId:e.subscriptionId}},
  mockCanonicalChange:async()=>{calls.canonical++;if(mode==='canonicalError')throw Error('mock');
   const x=canonical();
   if(mode==='wrongPlan')x.targetPlan='agency';
   if(mode==='noCredits')x.generalGranted=0;
   return x},
  readMockLedger:async()=>mode==='noLedger'?[]:ledger(),
  readMockAccount:async()=>mode==='wrongAccount'?{...user(),plan:'free'}:user()
 }};
}
async function withStore(fn){
 const dir=mkdtempSync(join(tmpdir(),'bridge-financial-'));
 const store=openLocalClaimStore({file:join(dir,'claim.sqlite'),simulationOnly:true});
 try{return await fn(store)}finally{store.close();rmSync(dir,{recursive:true,force:true})}
}
const run=(e,store,adapters,override={})=>
 simulateCanonicalBridge({preflight:e,store,adapters,policy,simulationOnly:true,...override});
test('isolated by default: never call financial mock without opt-in',()=>withStore(async store=>{
 const e=preflight(),m=mocks(e);
 assert.equal((await simulateCanonicalBridge({preflight:e,store,
  adapters:m.adapters,policy})).code,'PRODUCTION_CALLS_DISABLED');
 assert.equal(m.calls.canonical,0);
}));
test('cannot use a production-approved policy as fictional credits',()=>withStore(async store=>{
 const e=preflight(),m=mocks(e);
 assert.equal((await run(e,store,m.adapters,{policy:{...policy,
  approvedCommercialPolicy:true}})).code,'VIRTUAL_CREDIT_POLICY_REQUIRED');
 assert.equal(m.calls.canonical,0);
}));
test('all official START PREMIUM PRO prices map to mock finance, zero real credits',async()=>{
 for(const name of ['START','PREMIUM','PRO'])await withStore(async store=>{
  const e=preflight(name),m=mocks(e),r=await run(e,store,m.adapters);
  assert.equal(r.code,'VIRTUAL_FINANCIAL_HANDOFF_DONE',name);
  assert.equal(r.virtualPlan,name);
  assert.equal(r.virtualGeneralCredits,policy.general[e.internalPlan]);
  assert.equal(r.creditsGranted,0);assert.equal(r.productionWrites,0);
  assert.equal(store.inspect(e.sessionId).state,'DONE');
 });
});
test('already DONE does not invoke canonical mock a second time',()=>withStore(async store=>{
 const e=preflight(),m=mocks(e);
 assert.equal((await run(e,store,m.adapters)).code,'VIRTUAL_FINANCIAL_HANDOFF_DONE');
 assert.equal((await run(e,store,m.adapters)).code,'ALREADY_VIRTUALLY_COMPLETED');
 assert.equal(m.calls.canonical,1);
}));
test('replayed grant requires exactly one matching ledger transaction',()=>{
 const e=preflight(),m=mocks(e,{replay:true});
 assert.equal(assessMockFinancialReconciliation({preflight:e,canonical:m.canonical(),
  ledger:m.ledger(),user:m.user(),policy}).code,'VIRTUAL_CANONICAL_VERIFIED');
 assert.equal(assessMockFinancialReconciliation({preflight:e,canonical:m.canonical(),
  ledger:[],user:m.user(),policy}).code,'TRANSACTION_PROOF_MISSING');
});
test('success without credited amount is not marked as DONE',()=>withStore(async store=>{
 const e=preflight(),m=mocks(e,{mode:'noCredits'}),r=await run(e,store,m.adapters);
 assert.equal(r.code,'FINANCE_GENERAL_CREDITS_NOT_CONFIRMED');
 assert.equal(store.inspect(e.sessionId).state,'RETRYABLE');
}));
test('creative credit policy required blocks canonical with creativeGranted=0',()=>withStore(async store=>{
 const e=preflight(),m=mocks(e);
 const r=await run(e,store,m.adapters,{policy:{...policy,
  creative:{...policy.creative,business:150}}});
 assert.equal(r.code,'CREATIVE_CREDITS_NOT_SUPPORTED_BY_CANONICAL');
 assert.equal(m.calls.canonical,0);
}));
test('wrong canonical price/subscription/plan/period cannot pass',()=>{
 const e=preflight(),m=mocks(e);
 for(const extra of [{priceId:'price_wrong'},{subscriptionId:'sub_other'},
  {targetPlan:'agency'},{periodEnd:1}]){
  assert.equal(assessMockFinancialReconciliation({preflight:e,
   canonical:{...m.canonical(),...extra},ledger:m.ledger(),user:m.user(),policy}).code,
   'CANONICAL_RESULT_MISMATCH');
 }
});
test('missing ledger and wrong user account trigger durable retry',async()=>{
 for(const [mode,expected] of [
  ['noLedger','FINANCE_TRANSACTION_PROOF_MISSING'],
  ['wrongAccount','FINANCE_ACCOUNT_PLAN_MISMATCH'],
  ['wrongPlan','FINANCE_CANONICAL_RESULT_MISMATCH']
 ])await withStore(async store=>{
  const e=preflight(),m=mocks(e,{mode}),r=await run(e,store,m.adapters);
  assert.equal(r.code,expected,mode);
  assert.equal(store.inspect(e.sessionId).state,'RETRYABLE');
 });
});
test('mock canonical crash: local retry then success',()=>withStore(async store=>{
 const e=preflight();
 assert.equal((await run(e,store,mocks(e,{mode:'canonicalError'}).adapters)).code,
  'VIRTUAL_FINANCIAL_RETRY_REQUIRED');
 assert.equal(store.inspect(e.sessionId).state,'RETRYABLE');
 assert.equal((await run(e,store,mocks(e).adapters)).code,
  'VIRTUAL_FINANCIAL_HANDOFF_DONE');
 assert.equal(store.inspect(e.sessionId).attempts,2);
}));
test('customer mismatch is rejected before canonical mock',()=>withStore(async store=>{
 const e=preflight(),m=mocks(e,{mode:'wrongCustomer'});
 assert.equal((await run(e,store,m.adapters)).code,'VIRTUAL_FINANCIAL_RETRY_REQUIRED');
 assert.equal(m.calls.canonical,0);
}));
test('malicious preflight Price ID rejected',()=>withStore(async store=>{
 const e=preflight();e.priceId='price_injected';const m=mocks(e);
 assert.equal((await run(e,store,m.adapters)).code,'PREFLIGHT_NOT_VALID');
 assert.equal(m.calls.canonical,0);
}));
test('10 concurrent attempts: one executes, remaining are busy or already done',()=>withStore(async store=>{
 const e=preflight(),m=mocks(e);
 const result=await Promise.all(Array.from({length:10},()=>run(e,store,m.adapters)));
 assert.equal(result.filter(x=>x.code==='VIRTUAL_FINANCIAL_HANDOFF_DONE').length,1);
 assert(result.every(x=>['VIRTUAL_FINANCIAL_HANDOFF_DONE','CLAIM_LEASE_BUSY',
  'ALREADY_VIRTUALLY_COMPLETED'].includes(x.code)));
 assert.equal(m.calls.canonical,1);
}));
