import { Router } from "express";
import promptRouter from "./prompt.route";
import filesRouter from "./files.route";
import signinRouter from "./signin.route";
import signupRouter from "./signup.route";
import googleRouter from "./google.route";
import projectRouter from "./project.route";
import sandboxRouter from "./sandbox.route";
import deployRouter from "./deploy.route";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth/signin", signinRouter);
router.use("/auth/signup", signupRouter);
router.use("/auth/google", googleRouter);

router.use("/prompt", sandboxRouter);

router.use("/project", authMiddleware, projectRouter);
router.use("/prompt", authMiddleware, promptRouter);
router.use("/deploy", authMiddleware, deployRouter);
router.use("/", filesRouter);

export default router;
