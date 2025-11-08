import { Sandbox } from "e2b"
import express from "express";
import { streamText } from 'ai';
import { SYSTEM_PROMPT } from "./agent/systemPrompt";
import { createFile, updateFile, deleteFile, readFile } from "./tools";
import { openrouter } from "./agent/agent";

const app = express();

app.use(express.json());

app.post("/prompt", async(req, res) => {
    const { prompt } = req.body;

    const response = streamText({
        model: openrouter("gpt-5-codex"),
        tools: {
            createFile: createFile,
            updateFile: updateFile,
            deleteFile: deleteFile,
            readFile: readFile
        },
        messages: [
            {
                role: "system",
                content: SYSTEM_PROMPT
            },
            {
                role: "user",
                content: prompt
            }
        ]
    });
    const sandbox = await Sandbox.create()

    response.pipeTextStreamToResponse(res);
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});