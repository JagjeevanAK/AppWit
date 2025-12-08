import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();
const port = process.env.PORT;

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    exposedHeaders: ['X-Sandbox-URL', 'X-Sandbox-ID']
}));

app.use(express.json());

app.use("/", routes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
