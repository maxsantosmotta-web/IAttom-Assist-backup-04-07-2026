/* Financial adapter SPECIMEN for local testing only. No live Stripe, Clerk,
 * PostgreSQL, entitlement or credit access. Never wire to a public endpoint.
 */
import {OFFICIAL_MONTHLY_PLANS} from './official-checkout-contract.mjs';
const out=(code,info={})=>({mode:'ISOLATED_FINANCE_SIMULATION',code,
 accountActivated:false,creditsGranted:0,creativeCreditsGranted:0,productionWrites:0,...info});
const nonneg=x=>Number.isSafeInteger(x)&&x>=0;
function valid(e){
 const p=e?.commercialPlan&&OFFICIAL_MONTHLY_PLANS[e.commercialPlan];
 return !!(p&&e.mode==='READ_ONLY_PREFLIGHT'&&e.eligible===true&&
 e.code==='VERIFIED_READ_ONLY_AWAITING_SAFE_CLAIM'&&
 e.accountActivated===false&&e.creditsGranted===0&&e.productionWrites===0&&
 e.priceId===p.priceId&&e.internalPlan===p.planKey&&
 e.sessionId?.startsWith('cs_live_')&&e.subscriptionId?.startsWith('sub_')&&
 e.customerId?.startsWith('cus_')&&e.verifiedClerkId?.startsWith('user_')&&
 e.verifiedInvoiceId?.startsWith('in_')&&typeof e.registrationId==='string');
}
function creditPolicy(e,p){
 if(!p||p.simulationOnly!==true||p.approvedCommercialPolicy!==false)
  return 'VIRTUAL_CREDIT_POLICY_REQUIRED';
 if(!nonneg(p.general?.[e.internalPlan])||!nonneg(p.creative?.[e.internalPlan]))
  return 'VIRTUAL_PLAN_CREDITS_UNDEFINED';
 if(p.creative[e.internalPlan]!==0)
  return 'CREATIVE_CREDITS_NOT_SUPPORTED_BY_CANONICAL';
 return null;
}
/** Verify both mock canonical result AND an independent mock ledger/user read. */
export function assessMockFinancialReconciliation({preflight:e,canonical:r,ledger,user,policy}={}){
 if(!valid(e))return out('PREFLIGHT_NOT_VALID');
 const invalid=creditPolicy(e,policy);if(invalid)return out(invalid);
 if(!r||r.simulationOnly!==true||r.ok!==true||
  r.sourceMethod!=='handleCanonicalSubscriptionChange'||
  r.clerkUserId!==e.verifiedClerkId||r.subscriptionId!==e.subscriptionId||
  r.priceId!==e.priceId||r.targetPlan!==e.internalPlan||
  !Number.isSafeInteger(r.periodStart)||r.periodStart<=0||
  !Number.isSafeInteger(r.periodEnd)||r.periodEnd<=r.periodStart||
  !nonneg(r.generalGranted)||r.creativeGranted!==0||
  typeof r.generalAlreadyGranted!=='boolean')
  return out('CANONICAL_RESULT_MISMATCH');
 const amount=policy.general[e.internalPlan];
 if(r.generalAlreadyGranted?r.generalGranted!==0:r.generalGranted!==amount)
  return out('GENERAL_CREDITS_NOT_CONFIRMED');
 const key='subscription:'+r.subscriptionId+':'+r.priceId+':'+r.periodStart+':'+r.periodEnd+
  ':'+e.internalPlan+':general';
 if(!Array.isArray(ledger)||ledger.length!==1||ledger[0]?.idempotencyKey!==key||
  ledger[0].clerkUserId!==e.verifiedClerkId||ledger[0].amount!==amount||
  ledger[0].balanceType!=='general'||ledger[0].type!=='credit')
  return out('TRANSACTION_PROOF_MISSING');
 if(user?.simulationOnly!==true||user.clerkId!==e.verifiedClerkId||
  user.plan!==e.internalPlan||user.stripeCustomerId!==e.customerId||
  user.stripeSubscriptionId!==e.subscriptionId||
  user.stripeSubscriptionStatus!=='active'||user.planSelected!==true)
  return out('ACCOUNT_PLAN_MISMATCH');
 return out('VIRTUAL_CANONICAL_VERIFIED',{virtualPlan:e.commercialPlan,
  virtualGeneralCredits:amount,virtualCreativeCredits:0,
  virtualAlreadyGranted:r.generalAlreadyGranted,idempotencyKey:key});
}
/** Injected adapters must ONLY simulate, never import or call official handlers. */
export async function simulateCanonicalBridge({
 preflight:e,store,adapters,policy,simulationOnly=false,at,leaseMs=60000
}={}){
 if(simulationOnly!==true)return out('PRODUCTION_CALLS_DISABLED');
 if(!valid(e))return out('PREFLIGHT_NOT_VALID');
 const invalid=creditPolicy(e,policy);if(invalid)return out(invalid);
 if(!store||['register','acquire','completeVirtual','scheduleRetry'].some(
  k=>typeof store[k]!=='function')||
  !adapters||['mockAttachCustomer','mockCanonicalChange','readMockLedger',
  'readMockAccount'].some(k=>typeof adapters[k]!=='function'))
  return out('ADAPTERS_MISSING');
 let lease;
 try{
  const registration=store.register(e,{at});
  if(!['PERSISTED_PENDING','ALREADY_REGISTERED'].includes(registration.code))
   return out('CLAIM_'+registration.code);
  lease=store.acquire(e.sessionId,{at,leaseMs});
  if(lease.code==='ALREADY_DONE')return out('ALREADY_VIRTUALLY_COMPLETED');
  if(lease.code!=='LEASE_ACQUIRED')return out('CLAIM_'+lease.code);
  const c=lease.wouldInvokeCanonicalWith;
  if(!c||c.clerkUserId!==e.verifiedClerkId||c.subscriptionId!==e.subscriptionId||
   c.customerId!==e.customerId||c.priceId!==e.priceId||
   c.invoiceId!==e.verifiedInvoiceId||c.planKey!==e.internalPlan)
   throw Error('claim differs');
  const attached=await adapters.mockAttachCustomer({...c,simulationOnly:true});
  if(attached?.simulationOnly!==true||attached.ok!==true||
   attached.clerkUserId!==c.clerkUserId||attached.customerId!==c.customerId||
   attached.subscriptionId!==c.subscriptionId)
   throw Error('association mismatch');
  const receipt=await adapters.mockCanonicalChange({...c,simulationOnly:true});
  const [ledger,user]=await Promise.all([
   adapters.readMockLedger({subscriptionId:c.subscriptionId}),
   adapters.readMockAccount({clerkUserId:c.clerkUserId})
  ]);
  const verified=assessMockFinancialReconciliation({
   preflight:e,canonical:receipt,ledger,user,policy});
  if(verified.code!=='VIRTUAL_CANONICAL_VERIFIED'){
   store.scheduleRetry(e.sessionId,lease.token,{at});
   return out('FINANCE_'+verified.code);
  }
  const completed=store.completeVirtual(e.sessionId,lease.token,{
   simulationOnly:true,ok:true,clerkUserId:c.clerkUserId,
   subscriptionId:c.subscriptionId,invoiceId:c.invoiceId,
   priceId:c.priceId,planKey:c.planKey
  },{at});
  if(completed.code!=='VIRTUAL_COMPLETED')return out('CLAIM_'+completed.code);
  return out('VIRTUAL_FINANCIAL_HANDOFF_DONE',{
   virtualPlan:verified.virtualPlan,
   virtualGeneralCredits:verified.virtualGeneralCredits,
   virtualCreativeCredits:verified.virtualCreativeCredits,
   idempotencyKey:verified.idempotencyKey});
 }catch{
  if(lease?.code==='LEASE_ACQUIRED'){
   try{store.scheduleRetry(e.sessionId,lease.token,{at})}catch{}
  }
  return out('VIRTUAL_FINANCIAL_RETRY_REQUIRED');
 }
}
