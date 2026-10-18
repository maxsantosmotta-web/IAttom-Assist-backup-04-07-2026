import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OFFICIAL_MONTHLY_PLANS} from '../official-checkout-contract.mjs';
import {LIVE_OFFICIAL_CATALOG_URL,validateOfficialPublicCatalog} from '../official-live-catalog.mjs';

const stripeRoute=readFileSync(
 new URL('../../artifacts/api-server/src/routes/stripe.ts',import.meta.url),'utf8');
const guestProof=readFileSync(
 new URL('../../artifacts/api-server/src/lib/guestCommercialProof.ts',import.meta.url),'utf8');
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

test('commercial monthly plans match canonical ledger credits without changing legacy plans',()=>{
 const allowances={START:200,PREMIUM:500,PRO:1000};
 const rows=Object.entries(OFFICIAL_MONTHLY_PLANS).map(([name,spec])=>({
  name,planKey:spec.planKey,priceId:spec.priceId,amount:spec.amountCents,
  currency:'brl',interval:'month',credits:allowances[name]
 }));
 assert.deepEqual(rows.map(x=>x.credits),[200,500,1000]);
 assert.equal(validateOfficialPublicCatalog(rows).verified,true);
 for(const {name,planKey,credits,priceId,amount} of rows){
  assert.ok(guestProof.includes('priceId: "'+priceId+'", cents: '+amount+
    ', planKey: "'+planKey+'", credits: '+credits),
    'commercial '+name+' differs from the paid guest contract');
  assert.match(canonicalCredits,new RegExp('\\b'+planKey+':\\s*'+credits+'\\b'));
 }
});
