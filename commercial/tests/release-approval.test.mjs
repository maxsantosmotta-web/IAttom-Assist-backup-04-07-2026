import test from 'node:test';
import assert from 'node:assert/strict';
import {officialReleaseFlags,validateCommercialPublicOrigin} from '../release-approval.mjs';
const full={IATTOM_COMMERCIAL_OPERATOR_APPROVED:'true',
 IATTOM_COMMERCIAL_CHECKOUT_RELEASED:'true',
 IATTOM_COMMERCIAL_BRIDGE_READY:'true',
 IATTOM_COMMERCIAL_PAYMENT_AUTHORIZED:'true'};
test('checkout remains closed by default, even if one approval is present',()=>{
 const empty=officialReleaseFlags({});
 assert.equal(empty.officialCheckoutReleased,false);
 assert.equal(empty.bridgeReconciliationReady,false);
 assert.equal(empty.authorizedProductionRelease,false);
 for(const key of Object.keys(full)){
  const env={...full};delete env[key];
  const result=officialReleaseFlags(env);
  assert.ok(Object.values(result).some(x=>x===false),key);
 }
});
test('full explicit server approval is required separately for all releases',()=>{
 assert.deepEqual(officialReleaseFlags(full),{
  officialCheckoutReleased:true,bridgeReconciliationReady:true,authorizedProductionRelease:true
 });
 assert.equal(officialReleaseFlags({...full,IATTOM_COMMERCIAL_OPERATOR_APPROVED:'false'}).authorizedProductionRelease,false);
 assert.equal(officialReleaseFlags({...full,IATTOM_COMMERCIAL_PAYMENT_AUTHORIZED:'FALSE'}).authorizedProductionRelease,false);
});
test('a real live landing requires a safe custom HTTPS domain; no preview hostname allowed',()=>{
 assert.equal(validateCommercialPublicOrigin({}),null);
 for(const candidate of ['http://vendas.iattomassist.com.br',
  'https://landing-comercial-preview-preview.up.railway.app',
  'https://iattomassist.com.br.evil.com','https://vendas.iattomassist.com.br/extra',
  'https://vendas.iattomassist.com.br:444'])assert.equal(
   validateCommercialPublicOrigin({COMMERCIAL_LANDING_PUBLIC_ORIGIN:candidate}),null,candidate);
 assert.equal(validateCommercialPublicOrigin({COMMERCIAL_LANDING_PUBLIC_ORIGIN:'https://vendas.iattomassist.com.br'}),
  'https://vendas.iattomassist.com.br');
});
