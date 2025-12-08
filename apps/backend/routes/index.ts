import { Router } from "express";
import promptRouter, { activeSandboxes } from "./prompt";
import filesRouter from "./files";
import signinRouter from "./signin";
import signupRouter from "./signup";
import googleRouter from "./google";
import projectRouter from "./project";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use("/auth/signin", signinRouter);
router.use("/auth/signup", signupRouter);
router.use("/auth/google", googleRouter);

router.post("/prompt/notify-leaving/:sandboxId", async (req, res) => {
    const sandboxId = req.params.sandboxId;
    console.log(`[NOTIFY-LEAVING] Received (public route) for sandbox ${sandboxId}`);

    // Forward to the main prompt router handler
    // Import the handler directly would be cleaner but for now delegate
    const session = activeSandboxes.get(sandboxId);
    if (!session) {
        console.log(`[NOTIFY-LEAVING] Session not found for ${sandboxId}`);
        return res.status(404).json({ error: 'Sandbox session not found' });
    }

    const projectId = session.projectId;
    const userId = session.userId;

    console.log(`[NOTIFY-LEAVING] Project: ${projectId}, User: ${userId}`);

    if (!projectId || !userId) {
        return res.status(400).json({ error: 'Session missing projectId or userId' });
    }

    // Import scheduleShutdown dynamically to avoid circular deps
    const { scheduleShutdown } = await import("./prompt");
    scheduleShutdown(sandboxId, projectId, userId);

    res.json({
        success: true,
        message: `Sandbox shutdown scheduled`,
    });
});

// Protected routes
router.use("/project", authMiddleware, projectRouter);
router.use("/prompt", authMiddleware, promptRouter);
router.use("/", filesRouter);

export default router;
