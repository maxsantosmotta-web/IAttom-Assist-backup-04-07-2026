/**
 * Isolated landing preparation of authenticated guest checkout metadata.
 * NOT wired to Stripe; does not create sessions, payments or subscriptions.
 * Only a trusted landing server may call with a server-side registration
 * and shared key. Card payer email is deliberately independent.
 */
import {createHmac} from 'node:crypto';
const PLAN=Object.freeze({
 START:{priceId:'price_1TunJ2AYtu5nLhAZPd1Ai0hD',planKey:'pro'},
 PREMIUM:{priceId:'price_1TunQhAYtu5nLhAZu5QXWW31',planKey:'business'},
 PRO:{priceId:'price_1TunTDAYtu5nLhAZDfzTn8Cm',planKey:'agency'}
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function prepareSignedGuestCheckoutMetadata({
 registrationId,registrationEmail,plan,issuedAt,sharedSigningKey
}={}){
 const spec=PLAN[plan],
  email=typeof registrationEmail==='string'?registrationEmail.trim().toLowerCase():'';
 if(!spec||typeof sharedSigningKey!=='string'||
   !/^[0-9a-f]{64,128}$/i.test(sharedSigningKey)||
   sharedSigningKey.length%2||!uuid.test(registrationId)||
   !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>254||
   !Number.isSafeInteger(issuedAt)||issuedAt<=0)
  throw Error('Invalid trusted pre-registration signing input');
 const id=registrationId.toLowerCase();
 const message=['iattom-commercial-v1',id,plan,spec.priceId,email,String(issuedAt)].join('\n');
 const proof=createHmac('sha256',Buffer.from(sharedSigningKey,'hex')).update(message).digest('hex');
 const metadata={commercial_source:'landing',plan,planKey:spec.planKey,
  pre_registration_id:id,pre_registration_issued_at:String(issuedAt),
  pre_registration_proof:proof};
 return {priceId:spec.priceId,client_reference_id:id,metadata,
  subscription_data:{metadata:{...metadata}}};
}
