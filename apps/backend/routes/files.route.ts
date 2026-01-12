import { Router } from "express";
import {
  readFileController,
  listFilesController,
} from "../controllers/files.controller";

const router = Router();

router.get("/read-file", readFileController);
router.get("/list-files", listFilesController);

export default router;
