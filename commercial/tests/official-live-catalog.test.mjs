import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFICIAL_MONTHLY_PLANS} from '../official-checkout-contract.mjs';
import {LIVE_OFFICIAL_CATALOG_URL,validateOfficialPublicCatalog,fetchOfficialPublicCatalog}
 from '../official-live-catalog.mjs';
const json=()=>['START','PREMIUM','PRO'].map((name,i)=>{
 const v=OFFICIAL_MONTHLY_PLANS[name];
 return {planKey:v.planKey,name,priceId:v.priceId,amount:v.amountCents,
  currency:'brl',interval:'month',credits:[200,500,1000][i]};
});
const provider=(rows,config={})=>async(url,opts)=>{
 assert.equal(url,LIVE_OFFICIAL_CATALOG_URL);
 assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
 return new Response(JSON.stringify(rows),{status:200,
  headers:{'content-type':'application/json',...config}});
};
test('official public API returns same commercial plan pricing and credit entitlements',async()=>{
 const r=await fetchOfficialPublicCatalog({fetcher:provider(json())});
 assert.equal(r.verified,true);assert.equal(r.plans.length,3);
 assert.deepEqual(r.plans.map(x=>x.generalCredits),[200,500,1000]);
 assert.deepEqual(r.plans.map(x=>x.amountCents),[6900,15900,29900]);
 assert.equal(r.checkoutEnabled,false);assert.equal(r.realPayments,false);
});
test('any replaced price ID blocks verification',()=>{
 const rows=json();rows[1].priceId='price_trocado';
 assert.equal(validateOfficialPublicCatalog(rows).code,'OFFICIAL_PLAN_PRICE_OR_BENEFITS_MISMATCH');
});
test('currency or monthly amount mismatch never succeeds',()=>{
 for(const bad of [{currency:'usd'},{amount:50},{interval:'year'}]){
  const rows=json();Object.assign(rows[2],bad);
  assert.equal(validateOfficialPublicCatalog(rows).verified,false);
 }
});
test('credits mismatched from officially published config fail closed',()=>{
 const rows=json();rows[0].credits=500;
 assert.equal(validateOfficialPublicCatalog(rows).code,'OFFICIAL_PLAN_PRICE_OR_BENEFITS_MISMATCH');
});
test('repeated plan keys block ambiguous mapping',()=>{
 const rows=json();rows.push({...rows[1]});
 assert.equal(validateOfficialPublicCatalog(rows).code,'OFFICIAL_PLAN_KEY_DUPLICATED');
});
test('missing plan blocks catalog and no checkout allowed',()=>{
 assert.equal(validateOfficialPublicCatalog(json().slice(1)).verified,false);
});
test('an upstream 503 cannot be treated as verified',async()=>{
 const r=await fetchOfficialPublicCatalog({fetcher:async()=>new Response('{}',{status:503})});
 assert.equal(r.code,'OFFICIAL_CATALOG_HTTP_UNAVAILABLE');assert.equal(r.checkoutEnabled,false);
});
test('malformed json or HTML content fails closed',async()=>{
 for(const fetcher of [async()=>new Response('<html>error</html>',{status:200,
  headers:{'content-type':'text/html'}}),
  async()=>new Response('{broken',{status:200,headers:{'content-type':'application/json'}})]){
  const r=await fetchOfficialPublicCatalog({fetcher});
  assert.equal(r.verified,false);
 }
});
test('oversized response rejected before parsing',async()=>{
 const r=await fetchOfficialPublicCatalog({fetcher:async()=>new Response(' '.repeat(35000),{
  status:200,headers:{'content-type':'application/json'}})});
 assert.equal(r.code,'OFFICIAL_CATALOG_TOO_LARGE');
});
test('network timeout/error fails closed',async()=>{
 const r=await fetchOfficialPublicCatalog({fetcher:async()=>{throw Error('timeout')}});
 assert.equal(r.code,'OFFICIAL_CATALOG_NETWORK_OR_PARSE_FAILED');
});
