import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUEST_MONTHLY} from '../../artifacts/api-server/src/lib/guestCommercialProof.ts';
import {LIVE_OFFICIAL_CATALOG_URL,validateOfficialPublicCatalog} from '../official-live-catalog.mjs';

const stripeRoute=readFileSync(
 new URL('../../artifacts/api-server/src/routes/stripe.ts',import.meta.url),'utf8');
const canonicalCredits=readFileSync(
 new URL('../../artifacts/api-server/src/lib/credits.ts',import.meta.url),'utf8');

test('dedicated commercial catalog never replaces the legacy subscriber catalog',()=>{
 assert.match(stripeRoute,/router\.get\("\/stripe\/plans"/);
 assert.match(stripeRoute,/router\.get\("\/stripe\/commercial\/plans"/);
 assert.ok(stripeRoute.indexOf('router.get("/stripe/commercial/plans"') <
           stripeRoute.indexOf('router.get("/stripe/plans"'));
 assert.match(stripeRoute,/stripe\.prices\.retrieve\(spec\.priceId\)/);
 assert.match(stripeRoute,/price\.livemode !== true/);
 assert.match(stripeRoute,/price\.currency !== "brl"/);
 assert.match(stripeRoute,/price\.unit_amount !== spec\.cents/);
 assert.match(stripeRoute,/price\.recurring\?\.interval !== "month"/);
 assert.match(stripeRoute,/return res\.status\(503\)/);
 assert.ok(LIVE_OFFICIAL_CATALOG_URL.endsWith('/api/stripe/commercial/plans'));
});

test('commercial monthly plans match actual canonical ledger credits without changing legacy plans',()=>{
 const rows=Object.entries(GUEST_MONTHLY).map(([name,spec])=>({
  name,planKey:spec.planKey,priceId:spec.priceId,amount:spec.cents,
  currency:'brl',interval:'month',credits:spec.credits
 }));
 assert.deepEqual(rows.map(x=>x.credits),[200,500,1000]);
 assert.equal(validateOfficialPublicCatalog(rows).verified,true);
 for(const {planKey,credits} of rows){
  const key=new RegExp('\\b'+planKey+':\\s*'+credits+'\\b');
  assert.match(canonicalCredits,key);
 }
});
