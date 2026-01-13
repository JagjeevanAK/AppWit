import express from "express";
import cors from "cors";
import { serverConfig } from "@appwit/config/server";
import routes from "./routes";

const app = express();

app.use(cors({
    origin: serverConfig.cors.origins,
    credentials: true,
    exposedHeaders: ['X-Sandbox-URL', 'X-Sandbox-ID']
}));

app.use(express.json());

app.use("/", routes);

app.listen(serverConfig.port, () => {
    console.log(`Server is running on port ${serverConfig.port}`);
});
