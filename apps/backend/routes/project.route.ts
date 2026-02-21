import { Router } from "express";
import {
  createProjectController,
  listProjectsController,
  getProjectController,
  updateProjectController,
  deleteProjectController,
  getThumbnailController,
} from "../controllers/project.controller";

const router = Router();

router.post("/", createProjectController);
router.get("/", listProjectsController);
router.get("/:projectId/thumbnail", getThumbnailController);
router.get("/:projectId", getProjectController);
router.patch("/:projectId", updateProjectController);
router.delete("/:projectId", deleteProjectController);

export default router;
