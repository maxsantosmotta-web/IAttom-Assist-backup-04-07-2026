import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {prepareSignedGuestCheckoutMetadata} from '../guest-checkout-metadata.mjs';
const key='0123456789abcdef'.repeat(4),registrationId='123e4567-e89b-42d3-a456-426614174000',issuedAt=1792280000;
const values={START:['price_1TunJ2AYtu5nLhAZPd1Ai0hD','pro'],
 PREMIUM:['price_1TunQhAYtu5nLhAZu5QXWW31','business'],
 PRO:['price_1TunTDAYtu5nLhAZDfzTn8Cm','agency']};
test('three official Price IDs and original server preregistration UUID',()=>{
 for(const plan of ['START','PREMIUM','PRO']){
  const v=prepareSignedGuestCheckoutMetadata({
    registrationId,registrationEmail:'Joao@Example.com',plan,issuedAt,sharedSigningKey:key});
  assert.equal(v.priceId,values[plan][0]);
  assert.equal(v.metadata.planKey,values[plan][1]);
  assert.equal(v.client_reference_id,registrationId);
  assert.equal(v.subscription_data.metadata.pre_registration_proof,v.metadata.pre_registration_proof);
 }
});
test('metadata signature agrees with independent HMAC input contract',()=>{
 const v=prepareSignedGuestCheckoutMetadata({registrationId,registrationEmail:'joao@example.com',
  plan:'PREMIUM',issuedAt,sharedSigningKey:key});
 const message=['iattom-commercial-v1',registrationId,'PREMIUM',v.priceId,'joao@example.com',String(issuedAt)].join('\n');
 const signed=createHmac('sha256',Buffer.from(key,'hex')).update(message).digest('hex');
 assert.equal(v.metadata.pre_registration_proof,signed);
});
test('payer email not restricted by signed registration',()=>{
 const v=prepareSignedGuestCheckoutMetadata({registrationId,registrationEmail:'joao@example.com',
  plan:'START',issuedAt,sharedSigningKey:key});
 assert(!JSON.stringify(v).includes('joao@example.com'));
 assert.equal(v.metadata.commercial_source,'landing');
});
test('reject tampered plan and missing, invalid or weak credentials',()=>{
 const args={registrationId,registrationEmail:'joao@example.com',plan:'PREMIUM',issuedAt,sharedSigningKey:key};
 for(const change of [{plan:'FREE'},{registrationId:'evil'},{issuedAt:-1},
  {sharedSigningKey:'short'},{registrationEmail:'not-an-email'}]){
  assert.throws(()=>prepareSignedGuestCheckoutMetadata({...args,...change}));
 }
});
