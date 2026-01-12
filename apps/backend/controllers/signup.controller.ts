import type { Request, Response } from "express";
import { signup, AuthServiceError } from "../services/auth.service";

export const signupController = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const result = await signup(email, password, name);
    res.json(result);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
