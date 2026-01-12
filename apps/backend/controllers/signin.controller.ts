import type { Request, Response } from "express";
import { signin, AuthServiceError } from "../services/auth.service";

export const signinController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const result = await signin(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Signin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
