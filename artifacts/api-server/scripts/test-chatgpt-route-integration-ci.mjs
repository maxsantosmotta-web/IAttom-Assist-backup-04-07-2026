import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";
import express from "express";
import pg from "pg";

const { Pool } = pg;
const target = process.env.CHATGPT_CI_POSTGRES_URL;
if (process.env.CI !== "true" || !target) throw Error("CI-only localhost PostgreSQL required");
const u = new URL(target);
if (!["127.0.0.1", "localhost"].includes(u.hostname) ||
    u.port !== "5432" || u.pathname !== "/chatgpt_ci_test") throw Error("Production database forbidden");

const here = dirname(fileURLToPath(import.meta.url));
const api = resolve(here, "..");
const pool = new Pool({ connectionString: target, max: 8 });
const outputFiles = [];
let server;
let baseUrl;

const mockDatabase = String.raw\`
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
const pool = new pg.Pool({ connectionString: process.env.CHATGPT_CI_POSTGRES_URL, max: 8 });
export const db = drizzle(pool);
export const users = pgTable("users", {
  clerkId: text("clerk_id").primaryKey(), plan: text("plan").notNull(),
  role: text("role").notNull(), credits: integer("credits").notNull(),
  extraCredits: integer("extra_credits").notNull(), creativeCredits: integer("creative_credits").notNull(),
  extraCreativeCredits: integer("extra_creative_credits").notNull(),
  helpMessagesUsed: integer("help_messages_used").notNull(), updatedAt: timestamp("updated_at"),
});
export const savedItemsTable = pgTable("saved_items_v2", {
  id: text("id").primaryKey(), clerkUserId: text("clerk_user_id").notNull(),
  title: text("title").notNull(), type: text("type").notNull(), content: text("content").notNull(),
  data: text("data"), imagesData: text("images_data"), hasImages: boolean("has_images").notNull(),
  deletedAt: timestamp("deleted_at"),
});
export const creditsTransactions = pgTable("credits_transactions", {
  id: integer("id"), clerkUserId: text("clerk_user_id").notNull(),
  amount: integer("amount").notNull(), type: text("type").notNull(),
  feature: text("feature"), balanceType: text("balance_type").notNull(),
  description: text("description").notNull(), balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
});
\`;
const mockAuth = \`
export const requireExternalAccess = (req,res,next) => {
  const value = req.get("authorization");
  if (!value || !/^Bearer (test-user|free-user|other-user)$/.test(value)) {
    res.status(401).json({error:"oauth_required"}); return;
  }
  req.clerkUserId = value.slice(7);
  req.log = {error(){},warn(){},info(){}};
  next();
};
\`;
const mockIsolated = \`
export const isolatedExternalWritesEnabled = () =>
  process.env.CI === "true" &&
  new URL(process.env.CHATGPT_CI_POSTGRES_URL).hostname === "127.0.0.1";
\`;
const mockSchemas = \`
const parse = field => ({safeParse(input) {
  if (!input || typeof input[field] !== "string" || !input[field].trim()) {
    return {success:false,error:{message:"invalid_input"}};
  }
  return {success:true,data:input};
}});
export const AiFindProductsBody = parse("query");
export const AiValidateProductBody = parse("productName");
export const AiCreateCampaignBody = parse("product");
export const AiCreateContentBody = parse("topic");
export const AiVideoScriptBody = parse("product");
export const AiCreativeIdeasBody = {safeParse(input) {
  if (!input || typeof input.prompt !== "string" ||
      !Array.isArray(input.selectedFormats) || typeof input.platform !== "string") {
    return {success:false,error:{message:"invalid_image_input"}};
  }
  return {success:true,data:input};
}};
\`;
const mockGenerators = \`
export async function run(input,res) {
  res.setHeader("Content-Type","text/event-stream");
  res.write('data: {"type":"start"}\\\\n\\\\n');
  if (input.fail) {res.write('data: {"type":"error","message":"mock failure"}\\\\n\\\\n');res.end();return;}
  const concepts = (input.selectedFormats ?? []).map((format,i) => ({
    format,label: "mock-"+i,imageBase64: input.partial && i===0 ? undefined : "aGVsbG8gdGhpcyBpcyBhIHRlc3Q="
  }));
  const result = input.selectedFormats ? {concepts} : {headline:"simulated",product:input.product ?? input.query ?? ""};
  res.write("data: "+JSON.stringify({type:"result",data:result})+"\\\\n\\\\n");
  res.write('data: {"type":"done"}\\\\n\\\\n');
  res.end();
}
export const streamFindProducts=run,streamValidateProduct=run,streamCreateCampaign=run,
streamCreateContent=run,streamVideoScript=run,streamCreativeIdeas=run;
\`;
const mockCosts = \`
export const FEATURE_COSTS = {
 product_discovery:5,product_validation:5,campaign:10,content:10,
 video_script:10,prompt_creation:5,creativeImage1:10,creativeImage2:20,
 creativeImage3:30,iattom_help:1
};
export const CREATIVE_FEATURES = new Set(["creativeImage1","creativeImage2","creativeImage3"]);
\`;
const mockPrompts = \`export async function invokeExistingPromptGenerator(userId,input) {
  return { title:input.subject,prompt:"simulated prompt",module:"content" };
}\`;
const mockHelp = \`export async function invokeExistingHelpForChatGPT(userId,message) {
  if (message === "ERROR") throw new Error("simulated help error");
  return "Simulated IAttom Help response";
}\`;

function pluginForCI() {
  const mapping = [
    [/^@workspace\/db$/, mockDatabase],
    [/^@workspace\/api-zod$/, mockSchemas],
    [/requireExternalAccess\.js$/, mockAuth],
    [/lib\/chatgpt\/isolation\.js$/, mockIsolated],
    [/requirePlan\.js$/, "export const requirePlan = () => (_req,_res,next) => next();"],
    [/lib\/credits\.js$/, mockCosts],
    [/lib\/ai\/(findProducts|validateProduct|createCampaign|createContent|videoScript|creativeIdeas)\.js$/, mockGenerators],
    [/^\.\/prompts\.js$/, mockPrompts],
    [/^\.\/help\.js$/, mockHelp],
  ];
  return {name:"ci-no-provider-and-disposable-db",setup(buildAPI) {
    for (const [pattern, source] of mapping) {
      buildAPI.onResolve({filter:pattern}, args => ({path:args.path,namespace:"ci-mock"}));
    }
    buildAPI.onLoad({filter:/.*/,namespace:"ci-mock"}, args => {
      const entry = mapping.find(([pattern])=>pattern.test(args.path));
      if (!entry) throw Error("Mock module missing: "+args.path);
      return {contents:entry[1],loader:"js",resolveDir:api};
    });
  }};
}

async function bundleRoute(name) {
  const outfile=join(here, "__chatgpt-ci-"+name+".mjs");
  outputFiles.push(outfile);
  await build({
    entryPoints:[join(api,"src/routes",name+".ts")],bundle:true,format:"esm",platform:"node",
    target:"node22",packages:"external",outfile,plugins:[pluginForCI()],logLevel:"silent",
  });
  return (await import("file://"+outfile+"?ci")).default;
}

before(async () => {
  await pool.query(\`
    CREATE TABLE users (
      clerk_id text PRIMARY KEY, plan text NOT NULL, role text NOT NULL DEFAULT 'user',
      credits integer NOT NULL DEFAULT 0 CHECK(credits >= 0),
      extra_credits integer NOT NULL DEFAULT 0 CHECK(extra_credits >= 0),
      creative_credits integer NOT NULL DEFAULT 0 CHECK(creative_credits >= 0),
      extra_creative_credits integer NOT NULL DEFAULT 0 CHECK(extra_creative_credits >= 0),
      help_messages_used integer NOT NULL DEFAULT 0, updated_at timestamp
    );
    CREATE TABLE saved_items_v2 (
      id text PRIMARY KEY, clerk_user_id text NOT NULL, title text NOT NULL,
      type text NOT NULL, content text NOT NULL DEFAULT '', data text,
      images_data text, has_images boolean NOT NULL DEFAULT false, deleted_at timestamp
    );
    CREATE TABLE credits_transactions (
      id serial PRIMARY KEY, clerk_user_id text NOT NULL,
      amount integer NOT NULL, type text NOT NULL, feature text,
      balance_type text NOT NULL, description text NOT NULL,
      balance_before integer NOT NULL, balance_after integer NOT NULL
    );
    INSERT INTO users (clerk_id,plan,role,credits,extra_credits,creative_credits)
      VALUES ('test-user','agency','user',75,10,50),
             ('free-user','free','user',0,0,0),
             ('other-user','agency','user',80,0,50);
  \`);
  const app=express();
  app.use(express.json({limit:"5mb"}));
  app.use(await bundleRoute("externalOperations"));
  app.use(await bundleRoute("externalHelpOperations"));
  server=app.listen(0,"127.0.0.1");
  await new Promise((resolve,reject)=>{server.once("listening",resolve);server.once("error",reject);});
  baseUrl="http://127.0.0.1:"+server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve=>server.close(resolve));
  for (const file of outputFiles) {try {unlinkSync(file)} catch {}}
  await pool.end();
});
async function call(path,body,token="test-user",method="POST") {
  const response=await fetch(baseUrl+path,{
    method,headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{})},
    ...(method==="POST"?{body:JSON.stringify(body)}:{})
  });
  return {status:response.status,data:await response.json()};
}
async function account(id="test-user"){
  const result=await pool.query("SELECT * FROM users WHERE clerk_id=$1",[id]);
  return result.rows[0];
}
async function ledgers(id="test-user"){
  const result=await pool.query("SELECT * FROM credits_transactions WHERE clerk_user_id=$1 ORDER BY id",[id]);
  return result.rows;
}

test("OAuth guard denies untrusted call before DB operation",async()=>{
  const r=await call("/chatgpt/operations/execute",
    {feature:"campaign",input:{product:"A"},requestId:"unauth-request-12345"},null);
  assert.equal(r.status,401);
});

test("real campaign route persists result, debits once, and restores same key",async()=>{
  const body={feature:"campaign",input:{product:"mock product"},requestId:"campaign-request-12345"};
  const first=await call("/chatgpt/operations/execute",body);
  assert.equal(first.status,200,JSON.stringify(first));
  assert.equal(first.data.charged,10);
  assert.equal(first.data.result.headline,"simulated");
  assert.equal((await account()).credits,65);
  const repeat=await call("/chatgpt/operations/execute",body);
  assert.equal(repeat.status,200,JSON.stringify(repeat));
  assert.equal(repeat.data.chargedAgain,false);
  assert.equal((await account()).credits,65);
  const status=await call("/chatgpt/operations/status/campaign-request-12345",null,"test-user","GET");
  assert.equal(status.data.status,"complete");
  assert.equal((await ledgers()).filter(t=>t.feature==="campaign").length,1);
  const changed=await call("/chatgpt/operations/execute",
    {...body,input:{product:"changed product"}});
  assert.equal(changed.status,409);
});

test("two concurrent requests with same id generate/charge just once",async()=>{
  const body={feature:"campaign",input:{product:"simultaneous"},requestId:"campaign-concurrent-12345"};
  const results=await Promise.all([call("/chatgpt/operations/execute",body),call("/chatgpt/operations/execute",body)]);
  assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results));
  assert.equal(results.filter(r=>r.status===409).length,1,JSON.stringify(results));
  assert.equal((await ledgers()).filter(t=>t.feature==="campaign").length,2);
});

test("provider SSE error marks failed without credit debit",async()=>{
  const body={feature:"campaign",input:{product:"fail",fail:true},requestId:"campaign-failure-12345"};
  const beforeLedger=(await ledgers()).length;
  const balance=(await account()).credits;
  const response=await call("/chatgpt/operations/execute",body);
  assert.equal(response.status,502,JSON.stringify(response));
  assert.equal((await ledgers()).length,beforeLedger);
  assert.equal((await account()).credits,balance);
  const status=await call("/chatgpt/operations/status/campaign-failure-12345",null,"test-user","GET");
  assert.equal(status.data.status,"failed");
});

test("partial creative result cannot charge; complete image stores isolated image asset",async()=>{
  const balance=(await account()).creative_credits;
  const partial={feature:"creativeImage2",input:{
    platform:"facebook",selectedFormats:["feed","stories"],prompt:"mock image",partial:true
  },requestId:"creative-partial-12345"};
  const bad=await call("/chatgpt/operations/execute",partial);
  assert.equal(bad.status,502,JSON.stringify(bad));
  assert.equal((await account()).creative_credits,balance);
  const good={feature:"creativeImage1",input:{
    platform:"facebook",selectedFormats:["feed"],prompt:"mock image"
  },requestId:"creative-success-12345"};
  const result=await call("/chatgpt/operations/execute",good);
  assert.equal(result.status,200,JSON.stringify(result));
  assert.equal(result.data.charged,10);
  assert.equal((await account()).creative_credits,balance-10);
  assert.equal(JSON.stringify(result.data.result).includes("imageBase64"),false);
  const row=await pool.query("SELECT images_data FROM saved_items_v2 WHERE id=$1",[result.data.projectId]);
  assert.equal(JSON.parse(row.rows[0].images_data).length,1);
});

test("free plan cannot execute and paid plan cannot use disallowed module",async()=>{
  const free=await call("/chatgpt/operations/execute",{
    feature:"campaign",input:{product:"x"},requestId:"free-request-12345678"
  },"free-user");
  assert.equal(free.status,403);
  await pool.query("UPDATE users SET plan='pro' WHERE clerk_id='test-user'");
  const denied=await call("/chatgpt/operations/execute",{
    feature:"product_discovery",input:{query:"x"},requestId:"blocked-module-12345"
  });
  assert.equal(denied.status,403);
  await pool.query("UPDATE users SET plan='agency' WHERE clerk_id='test-user'");
});

test("IAttom Help uses general credits once and restores saved answer",async()=>{
  const body={message:"Como criar campanha?",requestId:"help-request-123456789"};
  const balance=(await account()).credits;
  const success=await call("/chatgpt/help/execute",body);
  assert.equal(success.status,200,JSON.stringify(success));
  assert.equal(success.data.charged,1);
  assert.equal((await account()).credits,balance-1);
  const again=await call("/chatgpt/help/execute",body);
  assert.equal(again.data.chargedAgain,false);
  assert.equal((await account()).credits,balance-1);
  const status=await call("/chatgpt/help/status/help-request-123456789",null,"test-user","GET");
  assert.equal(status.data.status,"complete");
  const beforeLedger=(await ledgers()).length;
  const failure=await call("/chatgpt/help/execute",{message:"ERROR",requestId:"help-fail-123456789"});
  assert.equal(failure.status,502);
  assert.equal((await ledgers()).length,beforeLedger);
});

test("owner isolation: no status or data visibility across user tokens",async()=>{
  const other=await call("/chatgpt/operations/status/campaign-request-12345",null,"other-user","GET");
  assert.equal(other.status,404);
  assert.equal((await ledgers("other-user")).length,0);
});
