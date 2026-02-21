import { Router } from "express";
import {
  deployProjectController,
  getDeploymentStatusController,
} from "../controllers/deploy.controller";

const router = Router();

router.post("/:projectId", deployProjectController);
router.get("/:projectId/status", getDeploymentStatusController);

export default router;
