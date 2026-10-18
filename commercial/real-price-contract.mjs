/* Auditoria PURA da correspondência de preços. Não cobra, não escreve, não acessa APIs. */
import {COMMERCIAL_PREVIEW_PLANS} from './official-compatibility.mjs';
const order=['START','PREMIUM','PRO'];
const blocked=(code,detail=null)=>({verified:false,code,detail,checkoutPermitted:false,productionWrites:0});
export function auditCommercialLivePriceCatalog({
 catalog,authenticatedStripeRead=false,
 officialStripeAccountId,observedStripeAccountId,
 approvedPlanKeyMapping=false,approvedCreditPolicy=false
}={}){
 if(!authenticatedStripeRead||!catalog)return blocked('LIVE_CATALOG_NOT_VERIFIED');
 if(!officialStripeAccountId?.startsWith('acct_')||
    observedStripeAccountId!==officialStripeAccountId)
   return blocked('OFFICIAL_STRIPE_ACCOUNT_NOT_VERIFIED');
 const prices=new Set(),products=new Set(),matches=[];
 for(const name of order){
  const expected=COMMERCIAL_PREVIEW_PLANS[name];
  const {price,product}=catalog[name]??{};
  if(!price||!product)return blocked('PLAN_PRICE_MISSING',name);
  if(typeof price.id!=='string'||!price.id.startsWith('price_')||
     typeof product.id!=='string'||!product.id.startsWith('prod_')||
     prices.has(price.id)||products.has(product.id))
    return blocked('DUPLICATE_OR_INVALID_PRICE_PRODUCT',name);
  prices.add(price.id);products.add(product.id);
  const productRef=typeof price.product==='string'?price.product:price.product?.id;
  if(productRef!==product.id||product.active!==true)
    return blocked('PRODUCT_NOT_MATCHED_OR_ACTIVE',name);
  if(price.livemode!==true||price.active!==true)
    return blocked('PRICE_NOT_LIVE_ACTIVE',name);
  if(price.currency!=='brl')return blocked('PRICE_NOT_BRL',name);
  if(!Number.isInteger(price.unit_amount)||price.unit_amount!==expected.amountBRL)
    return blocked('EXACT_CENTS_MISMATCH',{
     plan:name,expectedCents:expected.amountBRL,observedCents:price.unit_amount
    });
  if(price.type!=='recurring'||price.recurring?.interval!=='month'||
     price.recurring?.interval_count!==1)return blocked('NOT_MONTHLY',name);
  if(product.metadata?.plan!==expected.legacyPlanKey)
    return blocked('PRODUCT_INTERNAL_PLAN_MISMATCH',name);
  matches.push({commercialName:name,internalPlanKey:expected.legacyPlanKey,
    amountBRLInCents:expected.amountBRL,priceId:price.id,productId:product.id,
    currency:'brl',period:'month'});
 }
 if(!approvedPlanKeyMapping)return blocked('PLAN_MAPPING_AWAITING_APPROVAL');
 if(!approvedCreditPolicy)return blocked('CREDIT_POLICY_AWAITING_APPROVAL');
 return {verified:true,code:'MATCHES_PROPOSED_PRICES_NOT_AUTHORIZED_TO_CHARGE',
   priceMappings:matches,checkoutPermitted:false,productionWrites:0,
   requiresSpecificReleaseAuthorization:true};
}
export function auditOfficialCreditsDiscrepancy({generalGrants,creativeGrants,displayedGeneral}={}){
 const keys=['pro','business','agency'];
 if(!generalGrants||!creativeGrants||!displayedGeneral)
   return {consistent:false,code:'NO_CREDIT_SOURCE',items:[]};
 const items=keys.map(planKey=>({planKey,
   actualGeneralGrant:generalGrants[planKey],actualCreativeConfig:creativeGrants[planKey],
   displayedGeneral:displayedGeneral[planKey],
   mismatch:generalGrants[planKey]!==displayedGeneral[planKey]}));
 return {consistent:items.every(x=>!x.mismatch),
   code:items.some(x=>x.mismatch)?'DISPLAY_CONFLICTS_WITH_CANONICAL_GRANTS':'AGREE',items};
}
