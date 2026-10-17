import test from 'node:test';
import assert from 'node:assert/strict';
import {auditCommercialLivePriceCatalog,auditOfficialCreditsDiscrepancy} from '../real-price-contract.mjs';
const names=[['START','pro',6900],['PREMIUM','business',15900],['PRO','agency',29900]];
function fixture(){
 const catalog=Object.fromEntries(names.map(([name,key,cents],i)=>{
  const product={id:'prod_mock_'+i,active:true,metadata:{plan:key}};
  return [name,{product,price:{id:'price_mock_'+i,active:true,livemode:true,
   product:product.id,currency:'brl',unit_amount:cents,type:'recurring',
   recurring:{interval:'month',interval_count:1}}}];
 }));
 return {catalog,authenticatedStripeRead:true,officialStripeAccountId:'acct_oficial',
  observedStripeAccountId:'acct_oficial',approvedPlanKeyMapping:true,approvedCreditPolicy:true};
}
const check=change=>auditCommercialLivePriceCatalog({...fixture(),...change});
test('valores em centavos exatos com nomes comerciais distintos das chaves',()=>{
 const r=check();assert.equal(r.verified,true);assert.equal(r.checkoutPermitted,false);
 assert.deepEqual(r.priceMappings.map(x=>x.amountBRLInCents),[6900,15900,29900]);
 assert.deepEqual(r.priceMappings.map(x=>x.internalPlanKey),['pro','business','agency']);
});
test('sem catalogo live confiavel nao libera cobranca',()=>{
 assert.equal(auditCommercialLivePriceCatalog().code,'LIVE_CATALOG_NOT_VERIFIED');
 assert.equal(check({authenticatedStripeRead:false}).verified,false);
});
test('conta Stripe precisa ser a mesma aprovada',()=>{
 assert.equal(check({observedStripeAccountId:'acct_outro'}).code,'OFFICIAL_STRIPE_ACCOUNT_NOT_VERIFIED');
});
test('recusa 50 centavos reais antigos, nao confunde com 50 reais',()=>{
 const f=fixture();f.catalog.START.price.unit_amount=50;
 const r=auditCommercialLivePriceCatalog(f);
 assert.equal(r.code,'EXACT_CENTS_MISMATCH');assert.equal(r.detail.expectedCents,6900);
});
test('recusa numeros 7900, 19900 e 49900 do codigo legado',()=>{
 for(const [name,cents] of [['START',7900],['PREMIUM',19900],['PRO',49900]]){
  const f=fixture();f.catalog[name].price.unit_amount=cents;
  assert.equal(auditCommercialLivePriceCatalog(f).code,'EXACT_CENTS_MISMATCH');
 }
});
test('mesmo valor em USD nao serve, exige BRL',()=>{
 const f=fixture();f.catalog.PRO.price.currency='usd';
 assert.equal(auditCommercialLivePriceCatalog(f).code,'PRICE_NOT_BRL');
});
test('recusa preco anual ou renovacao bimestral',()=>{
 for(const recurrence of [{interval:'year',interval_count:1},{interval:'month',interval_count:2}]){
  const f=fixture();f.catalog.PREMIUM.price.recurring=recurrence;
  assert.equal(auditCommercialLivePriceCatalog(f).code,'NOT_MONTHLY');
 }
});
test('recusa produto inativo ou vinculacao incorreta',()=>{
 const f=fixture();f.catalog.START.product.active=false;
 assert.equal(auditCommercialLivePriceCatalog(f).code,'PRODUCT_NOT_MATCHED_OR_ACTIVE');
});
test('recusa preco de teste ou inativo',()=>{
 for(const bad of [{livemode:false},{active:false}]){
  const f=fixture();Object.assign(f.catalog.START.price,bad);
  assert.equal(auditCommercialLivePriceCatalog(f).code,'PRICE_NOT_LIVE_ACTIVE');
 }
});
test('recusa preco reutilizado em dois planos',()=>{
 const f=fixture();f.catalog.PRO.price.id=f.catalog.START.price.id;
 assert.equal(auditCommercialLivePriceCatalog(f).code,'DUPLICATE_OR_INVALID_PRICE_PRODUCT');
});
test('PRO comercial nunca e pro interno',()=>{
 const f=fixture();f.catalog.PRO.product.metadata.plan='pro';
 assert.equal(auditCommercialLivePriceCatalog(f).code,'PRODUCT_INTERNAL_PLAN_MISMATCH');
});
test('aprovacao de mapeamento interno e separada do valor',()=>{
 assert.equal(check({approvedPlanKeyMapping:false}).code,'PLAN_MAPPING_AWAITING_APPROVAL');
});
test('politica de creditos precisa ser aprovada separadamente',()=>{
 assert.equal(check({approvedCreditPolicy:false}).code,'CREDIT_POLICY_AWAITING_APPROVAL');
});
test('creditos exibidos divergentes dos creditos de concessao',()=>{
 const r=auditOfficialCreditsDiscrepancy({
  generalGrants:{pro:200,business:500,agency:1000},
  creativeGrants:{pro:100,business:150,agency:250},
  displayedGeneral:{pro:500,business:2000,agency:10000}});
 assert.equal(r.consistent,false);
 assert.equal(r.code,'DISPLAY_CONFLICTS_WITH_CANONICAL_GRANTS');
 assert(r.items.every(x=>x.mismatch));
});
test('nao confunde credito criativo com geral',()=>{
 const generals={pro:200,business:500,agency:1000};
 const r=auditOfficialCreditsDiscrepancy({
  generalGrants:generals,creativeGrants:{pro:100,business:150,agency:250},
  displayedGeneral:generals});
 assert.equal(r.consistent,true);
 assert.deepEqual(r.items.map(x=>x.actualCreativeConfig),[100,150,250]);
});
