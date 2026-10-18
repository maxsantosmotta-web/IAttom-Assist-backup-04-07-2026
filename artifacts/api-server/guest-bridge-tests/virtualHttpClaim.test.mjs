import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import express from "express";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {sql} from "drizzle-orm";
import {GUEST_MONTHLY} from "../src/lib/guestCommercialProof.ts";
import {createAuthorizedOfficialSession} from "../../../commercial/official-checkout-contract.mjs";

// The release flags are true ONLY in disposable source copies, never the repo.
const tmp=mkdtempSync(join(import.meta.dirname,".virtual-http-"));
const write=(name,s)=>writeFileSync(join(tmp,name),s);
function copy(source,edits){
 let s=readFileSync(new URL("../src/"+source,import.meta.url),"utf8");
 for(const [from,to] of edits){
  assert.ok(s.includes(from),"source marker absent: "+from);
  s=s.replace(from,to);
 }
 return s;
}
write("fakeDb.mjs",[
'import {pgTable,text,integer,boolean,timestamp,bigserial} from "drizzle-orm/pg-core";',
'export let db;export const setDb=x=>db=x;',
'export const users=pgTable("users",{clerkId:text("clerk_id"),email:text("email"),role:text("role"),plan:text("plan"),credits:integer("credits"),stripeCustomerId:text("stripe_customer_id"),stripeSubscriptionId:text("stripe_subscription_id"),stripeSubscriptionStatus:text("stripe_subscription_status"),planSelected:boolean("plan_selected"),updatedAt:timestamp("updated_at")});',
'export const creditsTransactions=pgTable("credits_transactions",{id:bigserial("id",{mode:"number"}),clerkUserId:text("clerk_user_id"),amount:integer("amount"),type:text("type"),balanceType:text("balance_type"),description:text("description"),balanceBefore:integer("balance_before"),balanceAfter:integer("balance_after"),stripeSessionId:text("stripe_session_id")});'
].join("\n"));
write("fakeStripe.mjs",'export let client;export const setClient=x=>client=x;export async function getUncachableStripeClient(){return client}');
write("fakeClerk.mjs",[
'export const clerkClient={users:{getUser:async userId=>{',
'const email=userId==="user_joao123"?"joao@example.com":"maria@example.com";',
'return {banned:false,locked:false,primaryEmailAddressId:"primary",emailAddresses:[{id:"primary",emailAddress:email,verification:{status:"verified"}}]};',
'}}};'
].join("\n"));
write("fakeAuth.mjs",[
'export function requireAuth(req,res,next){',
'const t=req.headers.authorization;',
'if(t==="Bearer virtual-joao"){req.clerkUserId="user_joao123";return next()}',
'if(t==="Bearer virtual-maria"){req.clerkUserId="user_maria123";return next()}',
'res.status(401).json({error:"Unauthorized"});',
'}'
].join("\n"));
write("fakeCredits.mjs",'export const PLAN_CREDITS={free:0,pro:200,business:500,agency:1000};');
write("fakeLogger.mjs",'export const logger={info(){},warn(){},error(){}};');
write("canonical.ts",copy("lib/stripeCanonicalSubscription.ts",[
['from "@workspace/db"','from "./fakeDb.mjs"'],
['from "./stripeClient.js"','from "./fakeStripe.mjs"'],
['from "./credits.js"','from "./fakeCredits.mjs"'],
['from "./logger.js"','from "./fakeLogger.mjs"']]));
write("capture.ts",copy("lib/guestCommercialPaidCapture.ts",[
['from "@workspace/db"','from "./fakeDb.mjs"'],
['from "./stripeClient.js"','from "./fakeStripe.mjs"'],
['from "./guestPaidUnlinkedPolicy.js"','from "../../src/lib/guestPaidUnlinkedPolicy.ts"'],
['from "./guestCommercialJournal.js"','from "../../src/lib/guestCommercialJournal.ts"'],
['COMMERCIAL_GUEST_CAPTURE_RELEASED: boolean = false','COMMERCIAL_GUEST_CAPTURE_RELEASED: boolean = true']]));
write("claim.ts",copy("lib/guestCommercialClaim.ts",[
['from "@clerk/express"','from "./fakeClerk.mjs"'],
['from "@workspace/db"','from "./fakeDb.mjs"'],
['from "./stripeClient.js"','from "./fakeStripe.mjs"'],
['from "./stripeCanonicalSubscription.js"','from "./canonical.ts"'],
['from "./guestCommercialPolicy.js"','from "../../src/lib/guestCommercialPolicy.ts"'],
['from "./guestCommercialProof.js"','from "../../src/lib/guestCommercialProof.ts"'],
['from "./guestCommercialPaidCapture.js"','from "./capture.ts"'],
['from "./guestCommercialJournal.js"','from "../../src/lib/guestCommercialJournal.ts"'],
['COMMERCIAL_GUEST_WRITE_RELEASED: boolean = false','COMMERCIAL_GUEST_WRITE_RELEASED: boolean = true']]));
write("route.ts",copy("routes/guestCommercial.ts",[
['from "../middlewares/requireAuth.js"','from "./fakeAuth.mjs"'],
['from "../lib/guestCommercialClaim.js"','from "./claim.ts"']]));
const {setDb}=await import(pathToFileURL(join(tmp,"fakeDb.mjs")).href);
const {setClient}=await import(pathToFileURL(join(tmp,"fakeStripe.mjs")).href);
const capture=(await import(pathToFileURL(join(tmp,"capture.ts")).href)).captureServerVerifiedGuestPurchase;
const route=(await import(pathToFileURL(join(tmp,"route.ts")).href)).default;
const signingKey="0123456789abcdef".repeat(4);
process.env.COMMERCIAL_GUEST_CLAIM_ENABLED="true";
process.env.COMMERCIAL_REGISTRATION_HMAC_KEY=signingKey;
let schema=readFileSync(new URL("./DRIZZLE_JOURNAL_TEST_SCHEMA.sql",import.meta.url),"utf8");
assert.ok(schema.includes("credits integer NOT NULL DEFAULT 0,"));
schema=schema.replace("credits integer NOT NULL DEFAULT 0,","credits integer NOT NULL DEFAULT 0,plan_selected boolean DEFAULT false,updated_at timestamp DEFAULT now(),");
assert.ok(schema.includes("balance_type text NOT NULL,stripe_session_id text"));
schema=schema.replace("balance_type text NOT NULL,stripe_session_id text","balance_type text NOT NULL,description text,balance_before integer,balance_after integer,stripe_session_id text");
const registrationId="123e4567-e89b-42d3-a456-426614174000";
async function scenario(plan,fn){
 const pg=new PGlite();let server;
 try{
  await pg.exec(schema);
  // Stub only the unavailable advisory-lock builtin in disposable PGlite.
  // Dedicated transaction/duplicate tests still verify journal constraints.
  await pg.exec("CREATE FUNCTION pg_advisory_xact_lock(integer,integer) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;");
  const db=drizzle(pg);setDb(db);
  const spec=GUEST_MONTHLY[plan],now=Math.floor(Date.now()/1000),start=now-30;
  const sessionId="cs_live_virtual_http_"+plan.toLowerCase();
  const subscriptionId="sub_virtual_http_"+plan.toLowerCase();
  const customerId="cus_other_payer",invoiceId="in_virtual_http_"+plan.toLowerCase();
  let fields,invoiceCalls=0,failCanonical=false;
  const checkout=await createAuthorizedOfficialSession({
   plan,registrationId,registeredEmail:"joao@example.com",
   officialCheckoutReleased:true,bridgeReconciliationReady:true,
   authorizedProductionRelease:true,serverRegistrationProofVerified:true,
   callbackOrigin:"https://landing.example.test",attemptId:registrationId,
   proofIssuedAt:start,sharedSigningKey:signingKey,
   officialStripe:{
    retrievePrice:async id=>({id,livemode:true,active:true,currency:"brl",unit_amount:spec.cents,
     type:"recurring",recurring:{interval:"month",interval_count:1},product:"prod_virtual"}),
    createCheckoutSession:async data=>{
     fields=data;
     return {id:sessionId,livemode:true,url:"https://checkout.stripe.com/virtual-only"};
    }
   }
  });
  assert.equal(checkout.ok,true,JSON.stringify(checkout));
  assert.ok(fields.success_url.includes("/commercial/activate?session_id="));
  const session={id:sessionId,livemode:true,status:"complete",payment_status:"paid",
   mode:"subscription",subscription:subscriptionId,customer:customerId,
   invoice:invoiceId,created:now,currency:"brl",amount_total:spec.cents,
   client_reference_id:registrationId,metadata:fields.metadata,
   customer_details:{email:"payer-different@example.com"}};
  const subscription={id:subscriptionId,livemode:true,status:"active",
   customer:customerId,latest_invoice:invoiceId,metadata:fields.subscription_data.metadata,
   items:{data:[{price:{id:spec.priceId,currency:"brl",unit_amount:spec.cents,
    recurring:{interval:"month"},product:"prod_virtual"},
    current_period_start:start,current_period_end:start+2592000}]}};
  const invoice={id:invoiceId,livemode:true,paid:true,status:"paid",
   customer:customerId,subscription:subscriptionId,currency:"brl",amount_paid:spec.cents};
  setClient({
   checkout:{sessions:{retrieve:async()=>session}},
   subscriptions:{retrieve:async()=>subscription,list:async()=>({data:[subscription],has_more:false})},
   invoices:{retrieve:async()=>{invoiceCalls++;
    if(failCanonical&&invoiceCalls===3)return {...invoice,status:"open",paid:false};
    return invoice;
   }},
   products:{retrieve:async()=>({metadata:{plan:spec.planKey}})}
  });
  const app=express();app.use(express.json());
  app.use((req,res,next)=>{req.log={error(){}};next()});
  app.use("/api",route);
  await new Promise(resolve=>{server=app.listen(0,"127.0.0.1",resolve)});
  const url="http://127.0.0.1:"+server.address().port+"/api/stripe/guest/claim";
  async function claim(token="virtual-joao",body={sessionId}){
   const result=await fetch(url,{method:"POST",headers:{
    "Content-Type":"application/json",Authorization:"Bearer "+token
   },body:JSON.stringify(body)});
   return {status:result.status,body:await result.json()};
  }
  async function counts(){
   const users=await db.execute(sql.raw("SELECT clerk_id,plan,credits FROM users ORDER BY clerk_id"));
   const journal=await db.execute(sql.raw("SELECT status,clerk_user_id FROM commercial_guest_claims"));
   const credits=await db.execute(sql.raw("SELECT clerk_user_id,amount,balance_type FROM credits_transactions"));
   return {users:users.rows,journal:journal.rows,credits:credits.rows};
  }
  await fn({
   spec,claim,counts,capture:()=>capture(sessionId),
   register:()=>pg.exec("INSERT INTO users(clerk_id,email) VALUES ('user_joao123','joao@example.com'),('user_maria123','maria@example.com')"),
   breakCanonicalOnce:()=>{failCanonical=true;invoiceCalls=0}
  });
 }finally{
  if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pg.close();
 }
}
test("real authenticated guest HTTP route (temporary Stripe and Clerk adapters only)",async t=>{
 for(const plan of ["START","PREMIUM","PRO"]){
  await t.test(plan+" payer separate, correct Clerk account, single credit grant",async()=>{
   await scenario(plan,async x=>{
    assert.equal((await x.claim("invalid")).status,401);
    const firstCapture=await x.capture();
    assert.equal(firstCapture.ok,true,JSON.stringify(firstCapture));
    const secondCapture=await x.capture();
    assert.equal(secondCapture.ok,true,JSON.stringify(secondCapture));
    assert.equal((await x.counts()).journal[0].status,"PAID_UNLINKED");
    await x.register();
    assert.equal((await x.claim("virtual-maria")).status,503);
    assert.equal((await x.counts()).credits.length,0);
    const ok=await x.claim();
    assert.equal(ok.status,200,JSON.stringify(ok));
    assert.equal(ok.body.code,"GUEST_SUBSCRIPTION_RECOGNIZED");
    assert.equal(ok.body.creditsGranted,x.spec.credits);
    const state=await x.counts();
    assert.equal(state.users.find(u=>u.clerk_id==="user_joao123").plan,x.spec.planKey);
    assert.equal(state.users.find(u=>u.clerk_id==="user_joao123").credits,x.spec.credits);
    assert.equal(state.users.find(u=>u.clerk_id==="user_maria123").credits,0);
    assert.equal(state.credits.length,1);
    assert.equal(state.credits[0].balance_type,"general");
    assert.equal(state.journal[0].status,"COMPLETED");
    const again=await x.claim();
    assert.equal(again.status,200,JSON.stringify(again));
    assert.equal(again.body.code,"ALREADY_RECONCILED");
    assert.equal(again.body.creditsGranted,0);
    assert.equal((await x.counts()).credits.length,1);
   });
  });
 }
 await t.test("transient financial failure recovers without duplicate credits",async()=>{
  await scenario("PREMIUM",async x=>{
   await x.register();
   x.breakCanonicalOnce();
   const first=await x.claim();
   assert.equal(first.status,503,JSON.stringify(first));
   assert.equal(first.body.code,"FINANCIAL_RECONCILIATION_RETRY_REQUIRED");
   assert.equal((await x.counts()).credits.length,0);
   const second=await x.claim();
   assert.equal(second.status,200,JSON.stringify(second));
   assert.equal(second.body.creditsGranted,500);
   assert.equal((await x.counts()).credits.length,1);
  });
 });
 await t.test("untrusted session and extra properties rejected at HTTP boundary",async()=>{
  await scenario("START",async x=>{
   await x.register();
   for(const body of [{sessionId:"cs_test_not_allowed"},{sessionId:"cs_live_fake123",extra:true},{plan:"PRO"}])
    assert.equal((await x.claim("virtual-joao",body)).status,400);
   assert.equal((await x.counts()).credits.length,0);
  });
 });
});
test.after(()=>{
 delete process.env.COMMERCIAL_GUEST_CLAIM_ENABLED;
 delete process.env.COMMERCIAL_REGISTRATION_HMAC_KEY;
 rmSync(tmp,{recursive:true,force:true});
});
