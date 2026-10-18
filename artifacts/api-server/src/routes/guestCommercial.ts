/** Isolated, authenticated guest claim route. No production deployment. */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { claimCommercialGuestCheckout } from "../lib/guestCommercialClaim.js";

const router: IRouter=Router();
const Body=z.object({sessionId:z.string().regex(/^cs_live_[A-Za-z0-9_]{6,255}$/)}).strict();
router.post("/stripe/guest/claim",requireAuth,async(req:Request,res:Response)=>{
 const input=Body.safeParse(req.body);
 if(!input.success){res.status(400).json({ok:false,code:"CHECKOUT_SESSION_ID_REQUIRED"});return;}
 try{
  const result=await claimCommercialGuestCheckout({
   authenticatedClerkId:(req as AuthenticatedRequest).clerkUserId,
   checkoutSessionId:input.data.sessionId
  });
  if(!result.ok){res.status(503).json(result);return;}
  res.json(result);
 }catch(err){
  req.log.error({err},"Isolated guest checkout claim failed");
  res.status(503).json({ok:false,code:"GUEST_CLAIM_RETRY_REQUIRED"});
 }
});
export default router;
