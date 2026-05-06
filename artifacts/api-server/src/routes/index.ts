import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import projectsRouter from "./projects.js";
import historyRouter from "./history.js";
import dashboardRouter from "./dashboard.js";
import authRouter from "./authRoutes.js";
import adminRouter from "./admin.js";
import creditsRouter from "./credits.js";
import aiRouter from "./ai.js";
import stripeRouter from "./stripe.js";
import waitlistRouter from "./waitlist.js";
import feedbackRouter from "./feedback.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(historyRouter);
router.use(dashboardRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(creditsRouter);
router.use(aiRouter);
router.use(stripeRouter);
router.use(waitlistRouter);
router.use(feedbackRouter);

export default router;
