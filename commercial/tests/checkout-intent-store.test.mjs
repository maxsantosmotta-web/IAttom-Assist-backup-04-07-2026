import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {OFFICIAL_MONTHLY_PLANS} from '../official-checkout-contract.mjs';
import {openCheckoutIntentStore,INTENT_TTL_MS} from '../checkout-intent-store.mjs';
const opts=(plan='PREMIUM')=>({registrationId:randomUUID(),plan,
 priceId:OFFICIAL_MONTHLY_PLANS[plan].priceId,
 amountCents:OFFICIAL_MONTHLY_PLANS[plan].amountCents,
 generalCredits:{START:200,PREMIUM:500,PRO:1000}[plan]});
const fixture=fn=>{const dir=mkdtempSync(join(tmpdir(),'checkout-intent-')),file=join(dir,'intents.jsonl');
 try{return fn({file})}finally{rmSync(dir,{recursive:true,force:true})}};
test('all three plans are saved but never paid',()=>fixture(({file})=>{
 const store=openCheckoutIntentStore({file});
 for(const name of ['START','PREMIUM','PRO']){
  const v=store.create(opts(name));assert.equal(v.ok,true);
  assert.equal(v.paymentConfirmed,false);assert.equal(v.creditsGranted,0);
  assert.equal(store.status({intentId:v.intentId,intentToken:v.intentToken}).plan,name);
 }
}));
test('secret never persisted raw, no email or customer information',()=>fixture(({file})=>{
 const v=openCheckoutIntentStore({file}).create(opts());
 const content=readFileSync(file,'utf8');
 assert(!content.includes(v.intentToken));assert(!content.includes('customer_email'));
 assert.equal(JSON.parse(content.trim()).tokenHash.length,64);
}));
test('reopen restores status securely and never exposes token',()=>fixture(({file})=>{
 const v=openCheckoutIntentStore({file}).create(opts());
 const next=openCheckoutIntentStore({file}).status(v);
 assert.equal(next.ok,true);assert.equal(next.intentToken,undefined);
 assert.equal(next.status,'AWAITING_CHECKOUT');
}));
test('wrong token and unknown intent never reveal selection',()=>fixture(({file})=>{
 const s=openCheckoutIntentStore({file}),a=s.create(opts()),b=s.create(opts('START'));
 assert.equal(s.status({intentId:a.intentId,intentToken:b.intentToken}).code,'INTENT_NOT_FOUND');
 assert.equal(s.status({intentId:randomUUID(),intentToken:a.intentToken}).code,'INTENT_NOT_FOUND');
}));
test('expiry after 24h stops access',()=>fixture(({file})=>{
 let clock=1000;const s=openCheckoutIntentStore({file,clock:()=>clock});
 const a=s.create(opts());clock+=INTENT_TTL_MS;
 assert.equal(s.status(a).code,'INTENT_EXPIRED');
}));
test('tampered price, credits or registration fails without writing',()=>fixture(({file})=>{
 const s=openCheckoutIntentStore({file});
 for(const change of [{priceId:'price_fake'},{generalCredits:50},
  {amountCents:50},{registrationId:'bad'},{plan:'FREE'}])
  assert.equal(s.create({...opts(),...change}).ok,false);
 assert.equal(existsSync(file),false);
}));
test('selection is not Stripe checkout or a signed payment',()=>fixture(({file})=>{
 const v=openCheckoutIntentStore({file}).create(opts());
 assert.equal(v.checkoutEnabled,false);assert.equal(v.url,undefined);
 assert.equal(v.sessionId,undefined);assert.equal(v.accountActivated,false);
}));
