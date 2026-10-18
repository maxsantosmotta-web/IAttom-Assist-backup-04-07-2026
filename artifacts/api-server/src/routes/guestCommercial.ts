/** Isolated, authenticated guest claim route. No production deployment. */
import { Router, type IRouter, type Request, type Response } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { claimCommercialGuestCheckout } from "../lib/guestCommercialClaim.js";

const router: IRouter=Router();
// Validate only one permitted field: no extra dependency on the legacy zod resolver.
function getCheckoutSessionId(value:unknown):string|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const fields=value as Record<string,unknown>;
 if(Object.keys(fields).length!==1||typeof fields.sessionId!=="string")return null;
 return /^cs_live_[A-Za-z0-9_]{6,255}$/.test(fields.sessionId)
   ?fields.sessionId:null;
}
router.post("/stripe/guest/claim",requireAuth,async(req:Request,res:Response)=>{
 const sessionId=getCheckoutSessionId(req.body);
 if(!sessionId){res.status(400).json({ok:false,code:"CHECKOUT_SESSION_ID_REQUIRED"});return;}
 try{
  const result=await claimCommercialGuestCheckout({
   authenticatedClerkId:(req as AuthenticatedRequest).clerkUserId,
   checkoutSessionId:sessionId
  });
  if(!result.ok){res.status(503).json(result);return;}
  res.json(result);
 }catch(err){
  req.log.error({err},"Isolated guest checkout claim failed");
  res.status(503).json({ok:false,code:"GUEST_CLAIM_RETRY_REQUIRED"});
 }
});
export default router;
