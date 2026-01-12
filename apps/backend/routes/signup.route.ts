import { Router } from "express";
import { signupController } from "../controllers/signup.controller";

const router = Router();

router.post("/", signupController);

export default router;
