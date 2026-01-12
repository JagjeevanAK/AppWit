import { Router } from "express";
import {
  handleNotifyLeavingPublic,
  handleVisibilityChange,
} from "../controllers/sandbox.controller";

const router = Router();

router.post("/notify-leaving/:sandboxId", handleNotifyLeavingPublic);
router.post("/visibility/:sandboxId", handleVisibilityChange);

export default router;
