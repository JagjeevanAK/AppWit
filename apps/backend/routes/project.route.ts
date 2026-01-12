import { Router } from "express";
import {
  createProjectController,
  listProjectsController,
  getProjectController,
  deleteProjectController,
} from "../controllers/project.controller";

const router = Router();

router.post("/", createProjectController);
router.get("/", listProjectsController);
router.get("/:projectId", getProjectController);
router.delete("/:projectId", deleteProjectController);

export default router;
