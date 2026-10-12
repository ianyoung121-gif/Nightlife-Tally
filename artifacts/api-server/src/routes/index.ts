import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import barsRouter from "./bars";
import drinksRouter from "./drinks";
import specialsRouter from "./specials";
import followsRouter from "./follows";
import statsRouter from "./stats";
import couponsRouter from "./coupons";
import authRouter from "./auth";
import venuesRouter from "./venues";
import billingRouter from "./billing";
import publicSpecialsRouter from "./publicSpecials";
import placeFavoritesRouter from "./placeFavorites";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(barsRouter);
router.use(venuesRouter);
router.use(billingRouter);
router.use(publicSpecialsRouter);
router.use(placeFavoritesRouter);
router.use(notificationsRouter);
router.use(drinksRouter);
router.use(specialsRouter);
router.use(followsRouter);
router.use(statsRouter);
router.use(couponsRouter);

export default router;
