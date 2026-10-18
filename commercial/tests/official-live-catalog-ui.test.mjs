import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
test('frontend shows plans and general credits returned by verified production API only',()=>{
 const html=readFileSync(join(import.meta.dirname,'../index.html'),'utf8');
 assert.match(html,/result\.officialCatalogVerified!==true/);
 assert.match(html,/result\.generalCredits\.toLocaleString\('pt-BR'\)/);
 assert.match(html,/confirmado no IAttom Assist oficial/);
 assert.match(html,/result\.selection\.status!=='AWAITING_CHECKOUT'/);
 assert.match(html,/sessionStorage\.setItem\('iattom_checkout_selection'/);
 assert.match(html,/Nenhuma cobrança foi realizada/);
 assert.match(html,/\/api\/stripe\/official-checkout/);
});
