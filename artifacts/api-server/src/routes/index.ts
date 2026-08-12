import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import barsRouter from "./bars";
import drinksRouter from "./drinks";
import specialsRouter from "./specials";
import followsRouter from "./follows";
import statsRouter from "./stats";
import couponsRouter from "./coupons";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(barsRouter);
router.use(drinksRouter);
router.use(specialsRouter);
router.use(followsRouter);
router.use(statsRouter);
router.use(couponsRouter);

export default router;
