import type { Request, Response } from "express";
import { config } from "../config";
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  AuthServiceError,
} from "../services/auth.service";

export const googleAuthController = (req: Request, res: Response) => {
  res.redirect(getGoogleAuthUrl());
};

export const googleCallbackController = async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${config.urls.frontend}/login?error=no_code`);
  }

  try {
    const result = await handleGoogleCallback(code as string);
    res.redirect(
      `${config.urls.frontend}/auth/callback?token=${result.token}&user=${encodeURIComponent(JSON.stringify(result.user))}`
    );
  } catch (error) {
    console.error("Google auth error:", error);
    if (error instanceof AuthServiceError) {
      return res.redirect(
        `${config.urls.frontend}/login?error=${error.message}`
      );
    }
    res.redirect(`${config.urls.frontend}/login?error=auth_failed`);
  }
};
