import { Router } from "express";
import promptRouter from "./prompt";
import filesRouter from "./files";
import signinRouter from "./signin";
import signupRouter from "./signup";
import googleRouter from "./google";

const router = Router();

router.use("/auth/signin", signinRouter);
router.use("/auth/signup", signupRouter);
router.use("/auth/google", googleRouter);
router.use("/prompt", promptRouter);
router.use("/", filesRouter);

export default router;
