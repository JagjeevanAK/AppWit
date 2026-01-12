import { Router } from "express";
import {
  handleInitialPrompt,
  handleContinuePrompt,
  handleGetHistory,
  handleLoadProject,
  handleRefresh,
  handleNotifyLeaving,
  handleGetStatus,
  handleDelete,
  handleDownload,
  handleGetMessages,
} from "../controllers/prompt";

export { activeSandboxes } from "@appwit/sandbox";

const router = Router();

router.post("/", handleInitialPrompt);
router.post("/continue", handleContinuePrompt);

router.get("/history/:sandboxId", handleGetHistory);

router.post("/load/:projectId", handleLoadProject);
router.get("/status/:projectId", handleGetStatus);
router.get("/messages/:projectId", handleGetMessages);

router.post("/refresh/:sandboxId", handleRefresh);
router.post("/notify-leaving/:sandboxId", handleNotifyLeaving);
router.delete("/:sandboxId", handleDelete);

router.get("/download/:sandboxId", handleDownload);

export default router;
