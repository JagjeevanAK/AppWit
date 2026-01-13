import { serverConfig } from "@appwit/config/server";

export const config = {
  jwt: serverConfig.jwt,
  google: serverConfig.google,
  urls: serverConfig.urls,
  session: serverConfig.session,
} as const;
