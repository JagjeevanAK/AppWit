import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { config } from "../config";

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string | null };
}

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

const createSession = async (userId: string): Promise<string> => {
  const token = jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const expiresAt = new Date(
    Date.now() + config.session.expiryDays * 24 * 60 * 60 * 1000
  );

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  return token;
};

export const signin = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthServiceError("Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthServiceError("Invalid credentials", 401);
  }

  const token = await createSession(user.id);

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
};

export const signup = async (
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthServiceError("Email already registered", 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  const token = await createSession(user.id);

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
};

export const getGoogleAuthUrl = (): string => {
  const redirectUri = `${config.urls.backend}/auth/google/callback`;
  const scope = encodeURIComponent("email profile");
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.google.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline`;
};

export const handleGoogleCallback = async (
  code: string
): Promise<AuthResult> => {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId!,
      client_secret: config.google.clientSecret!,
      redirect_uri: `${config.urls.backend}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokens = (await tokenRes.json()) as { access_token?: string };

  if (!tokens.access_token) {
    throw new AuthServiceError("Failed to get access token", 401);
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  const googleUser = (await userRes.json()) as { email: string; name: string };

  let user = await prisma.user.findUnique({
    where: { email: googleUser.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name,
        passwordHash: "",
      },
    });
  }

  const token = await createSession(user.id);

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
};
