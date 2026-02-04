import express from "express";
import cors from "cors";
import { serverConfig } from "@appwit/config/server";
import routes from "./routes";
import { loggerMiddleware } from "./middleware/logger";

const app = express();

const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:3000", "http://appwit.jagjeevan.me"];

app.use(cors({
    origin: corsOrigins,
    credentials: true,
    exposedHeaders: ['X-Sandbox-URL', 'X-Sandbox-ID']
}));

app.use(express.json());

app.use(loggerMiddleware);

app.use("/", routes);

app.listen(serverConfig.port, () => {
    console.log(`Server is running on port ${serverConfig.port}`);
});
