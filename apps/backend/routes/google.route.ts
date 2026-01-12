import { Router } from "express";
import {
  googleAuthController,
  googleCallbackController,
} from "../controllers/google.controller";

const router = Router();

router.get("/", googleAuthController);
router.get("/callback", googleCallbackController);

export default router;
