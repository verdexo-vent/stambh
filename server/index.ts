import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

if (existsSync(".env")) process.loadEnvFile(".env");

const app = express();
const port = Number(process.env.PORT ?? 4174);
const projectRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const distDirectory = join(projectRoot, "dist");
const startedAt = new Date().toISOString();

app.use(express.json({ limit: "1mb" }));

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(20_000)
  })).min(1).max(40)
});

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    provider: process.env.STAMBH_PROVIDER ?? "preview"
  });
});

app.get("/api/system", (_request, response) => {
  const provider = process.env.STAMBH_PROVIDER ?? "preview";
  response.json({
    status: "ok",
    startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    provider,
    runtime: existsSync(distDirectory) ? "production" : "development",
    modelConfigured: Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID),
    access: process.env.STAMBH_ACCESS ?? "private",
    connectors: 0
  });
});

app.post("/api/chat", async (request, response) => {
  const parsed = chatSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({ error: "Invalid message payload" });
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token || !accountId) {
    return response.json({
      reply: "I’m running in preview mode. Connect the Cloudflare credentials and I’ll use live intelligence here."
    });
  }

  const model = process.env.CLOUDFLARE_MODEL ?? "@cf/qwen/qwen3-30b-a3b-fp8";
  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  try {
    const modelResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You are Stambh, a calm, exact personal intelligence. Be concise, practical, privacy-conscious, and never claim an action was completed unless a tool confirms it."
          },
          ...parsed.data.messages
        ],
        max_tokens: 700,
        temperature: 0.35
      })
    });

    const payload = await modelResponse.json() as {
      success?: boolean;
      result?: {
        response?: string;
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      errors?: Array<{ message: string }>;
    };

    if (!modelResponse.ok || !payload.success) {
      return response.status(502).json({
        error: payload.errors?.[0]?.message ?? "Cloudflare inference failed"
      });
    }

    const reply =
      payload.result?.response ??
      payload.result?.choices?.[0]?.message?.content;

    return response.json({
      reply: reply ?? "I completed the request but received no text response."
    });
  } catch (error) {
    console.error("Stambh provider error", error);
    return response.status(502).json({
      error: "The model provider is temporarily unavailable"
    });
  }
});

if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory));

  app.use((request, response, next) => {
    if (request.path.startsWith("/api/")) {
      return next();
    }

    return response.sendFile(join(distDirectory, "index.html"));
  });
}

app.listen(port, "127.0.0.1", () => {
  console.log(`Stambh API listening on http://127.0.0.1:${port}`);
});
