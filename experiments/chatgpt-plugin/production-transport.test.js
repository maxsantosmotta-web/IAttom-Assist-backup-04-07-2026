import test from "node:test";
import assert from "node:assert/strict";
import { createIattomClient } from "./iattom-client.js";
const baseUrl = "https://example.invalid";
test("default transport rejects writes and legacy routes", async () => {
 const client = createIattomClient({baseUrl,token:"unit-test",fetchImpl:()=>{throw Error("unexpected network")}});
 await assert.rejects(client("/api/chatgpt/operations/execute",{method:"POST",body:{}}),/Operation not enabled/);
 await assert.rejects(client("/api/ai/content"),/Operation not enabled/);
});
test("explicit transport allows only canonical operations", async () => {
 const client = createIattomClient({baseUrl,token:"unit-test",allowWrites:true,fetchImpl:async (url,options)=>({url:String(url),method:options.method})});
 assert.deepEqual(await client("/api/chatgpt/operations/save",{method:"POST",body:{}}),{url:baseUrl+"/api/chatgpt/operations/save",method:"POST"});
 await assert.rejects(client("/api/help/chat",{method:"POST",body:{}}),/Operation not enabled/);
});
test("rejects insecure origins",()=>assert.throws(()=>createIattomClient({baseUrl:"http://example.invalid",token:"unit-test"}),/Invalid API origin/));
