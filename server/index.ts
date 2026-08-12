import express from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

if (existsSync(".env")) process.loadEnvFile(".env");

const app = express();
const port = Number(process.env.PORT ?? 4174);
const projectRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const distDirectory = join(projectRoot, "dist");
const startedAt = new Date().toISOString();
const googleCredentialsFile = process.env.GOOGLE_OAUTH_CREDENTIALS_FILE ?? join(projectRoot, "secrets", "google-oauth.json");
const googleTokenFile = process.env.GOOGLE_CALENDAR_TOKEN_FILE ?? join(projectRoot, "data", "google-calendar-token.json");
const personalDataFile = process.env.STAMBH_DATA_FILE ?? join(projectRoot, "data", "stambh-personal.json");
const oauthStates = new Map<string, number>();

type GoogleCredentials = { web: { client_id: string; client_secret: string; redirect_uris?: string[] } };
type GoogleToken = { access_token: string; refresh_token?: string; expires_in?: number; expires_at?: number; token_type?: string; scope?: string };
type Task = { id: string; title: string; detail?: string; completed: boolean; createdAt: string; completedAt?: string };
type Memory = { id: string; text: string; createdAt: string };
type AuditItem = { id: string; kind: "task" | "memory" | "calendar"; action: string; createdAt: string };
type PersonalData = { tasks: Task[]; memories: Memory[]; audit: AuditItem[] };

function personalData(): PersonalData {
  try {
    const parsed = JSON.parse(readFileSync(personalDataFile, "utf8")) as Partial<PersonalData>;
    return { tasks: parsed.tasks ?? [], memories: parsed.memories ?? [], audit: parsed.audit ?? [] };
  } catch { return { tasks: [], memories: [], audit: [] }; }
}

function savePersonalData(data: PersonalData) {
  mkdirSync(join(personalDataFile, ".."), { recursive: true });
  writeFileSync(personalDataFile, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function audit(data: PersonalData, kind: AuditItem["kind"], action: string) {
  data.audit.unshift({ id: randomBytes(9).toString("hex"), kind, action, createdAt: new Date().toISOString() });
  data.audit = data.audit.slice(0, 80);
}

function readGoogleCredentials(): GoogleCredentials | null {
  try {
    const parsed = JSON.parse(readFileSync(googleCredentialsFile, "utf8")) as GoogleCredentials;
    return parsed.web?.client_id && parsed.web?.client_secret ? parsed : null;
  } catch { return null; }
}

function redirectUri(credentials: GoogleCredentials) {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? credentials.web.redirect_uris?.[0] ?? "";
}

function saveToken(token: GoogleToken) {
  mkdirSync(join(googleTokenFile, ".."), { recursive: true });
  writeFileSync(googleTokenFile, JSON.stringify(token, null, 2), { mode: 0o600 });
}

async function validAccessToken() {
  const credentials = readGoogleCredentials();
  if (!credentials || !existsSync(googleTokenFile)) return null;
  try {
    const token = JSON.parse(readFileSync(googleTokenFile, "utf8")) as GoogleToken;
    if (token.access_token && (token.expires_at ?? 0) > Date.now() + 60_000) return token.access_token;
    if (!token.refresh_token) return null;
    const body = new URLSearchParams({ client_id: credentials.web.client_id, client_secret: credentials.web.client_secret, refresh_token: token.refresh_token, grant_type: "refresh_token" });
    const result = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!result.ok) return null;
    const refreshed = await result.json() as GoogleToken;
    const merged = { ...token, ...refreshed, refresh_token: token.refresh_token, expires_at: Date.now() + (refreshed.expires_in ?? 3600) * 1000 };
    saveToken(merged);
    return merged.access_token;
  } catch { return null; }
}

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
    connectors: existsSync(googleTokenFile) ? 1 : 0,
    memoryReady: existsSync(personalDataFile)
  });
});

const taskSchema = z.object({ title: z.string().trim().min(1).max(160), detail: z.string().trim().max(280).optional() });
const memorySchema = z.object({ text: z.string().trim().min(1).max(800) });

app.get("/api/tasks", (_request, response) => response.json({ tasks: personalData().tasks }));
app.post("/api/tasks", (request, response) => {
  const parsed = taskSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Task needs a title" });
  const data = personalData();
  const task: Task = { id: randomBytes(9).toString("hex"), ...parsed.data, completed: false, createdAt: new Date().toISOString() };
  data.tasks.unshift(task); audit(data, "task", `Added task: ${task.title}`); savePersonalData(data);
  response.status(201).json({ task });
});
app.patch("/api/tasks/:id", (request, response) => {
  const data = personalData(); const task = data.tasks.find((item) => item.id === request.params.id);
  if (!task) return response.status(404).json({ error: "Task not found" });
  if (typeof request.body?.completed === "boolean") {
    task.completed = request.body.completed; task.completedAt = task.completed ? new Date().toISOString() : undefined;
    audit(data, "task", `${task.completed ? "Completed" : "Reopened"} task: ${task.title}`); savePersonalData(data);
  }
  response.json({ task });
});
app.get("/api/memory", (_request, response) => response.json({ memories: personalData().memories.slice(0, 24) }));
app.post("/api/memory", (request, response) => {
  const parsed = memorySchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Memory needs text" });
  const data = personalData(); const memory: Memory = { id: randomBytes(9).toString("hex"), text: parsed.data.text, createdAt: new Date().toISOString() };
  data.memories.unshift(memory); data.memories = data.memories.slice(0, 200); audit(data, "memory", "Saved personal memory"); savePersonalData(data);
  response.status(201).json({ memory });
});
app.get("/api/activity", (_request, response) => response.json({ activity: personalData().audit.slice(0, 12) }));
app.get("/api/briefing", (_request, response) => {
  const data = personalData();
  const openTasks = data.tasks.filter((task) => !task.completed);
  const firstTask = openTasks[0];
  response.json({
    headline: openTasks.length ? `${openTasks.length} open ${openTasks.length === 1 ? "priority" : "priorities"}.` : "No open priorities.",
    summary: firstTask ? `Your next committed action is “${firstTask.title}.” Your calendar remains read-only.` : "Your task board is clear. Your calendar remains read-only.",
    generatedAt: new Date().toISOString()
  });
});

app.get("/api/calendar/status", (_request, response) => {
  response.json({ configured: Boolean(readGoogleCredentials()), connected: existsSync(googleTokenFile), access: "read-only" });
});

app.get("/api/calendar/connect", (_request, response) => {
  const credentials = readGoogleCredentials();
  if (!credentials || !redirectUri(credentials)) return response.status(503).send("Google Calendar is not configured on this server.");
  const state = randomBytes(24).toString("hex");
  oauthStates.set(state, Date.now() + 10 * 60_000);
  const query = new URLSearchParams({ client_id: credentials.web.client_id, redirect_uri: redirectUri(credentials), response_type: "code", scope: "https://www.googleapis.com/auth/calendar.readonly", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
});

app.get("/api/calendar/callback", async (request, response) => {
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state = typeof request.query.state === "string" ? request.query.state : "";
  const expiry = oauthStates.get(state);
  oauthStates.delete(state);
  const credentials = readGoogleCredentials();
  if (!credentials || !code || !expiry || expiry < Date.now()) return response.status(400).send("Calendar authorization could not be verified. Please start again from Stambh.");
  try {
    const body = new URLSearchParams({ code, client_id: credentials.web.client_id, client_secret: credentials.web.client_secret, redirect_uri: redirectUri(credentials), grant_type: "authorization_code" });
    const result = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!result.ok) return response.status(502).send("Google did not complete authorization. Please try again.");
    const token = await result.json() as GoogleToken;
    saveToken({ ...token, expires_at: Date.now() + (token.expires_in ?? 3600) * 1000 });
    response.redirect("/?calendar=connected");
  } catch { response.status(502).send("Calendar authorization is temporarily unavailable."); }
});

app.get("/api/calendar/events", async (request, response) => {
  const accessToken = await validAccessToken();
  if (!accessToken) return response.status(401).json({ error: "Calendar is not connected" });
  const requestedDays = Number(request.query.days ?? 7);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.floor(requestedDays), 1), 14) : 7;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + days);
  const query = new URLSearchParams({ timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "12" });
  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const calendarsResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader", { headers });
    if (!calendarsResponse.ok) return response.status(502).json({ error: "Calendar list could not be read" });
    const calendars = await calendarsResponse.json() as { items?: Array<{ id: string; summary?: string; selected?: boolean; primary?: boolean }> };
    const selectedCalendars = (calendars.items ?? []).filter((calendar) => calendar.primary || calendar.selected).slice(0, 12);
    const eventLists = await Promise.all(selectedCalendars.map(async (calendar) => {
      const result = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${query}`, { headers });
      if (!result.ok) return [];
      const payload = await result.json() as { items?: Array<{ id: string; summary?: string; location?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }> };
      return (payload.items ?? []).map((event) => ({ id: `${calendar.id}:${event.id}`, title: event.summary ?? "Busy", start: event.start?.dateTime ?? event.start?.date, end: event.end?.dateTime ?? event.end?.date, allDay: Boolean(event.start?.date), location: event.location, calendar: calendar.summary ?? "Google Calendar" }));
    }));
    const events = eventLists.flat().sort((left, right) => (left.start ?? "").localeCompare(right.start ?? "")).slice(0, 24);
    response.json({ events, days, calendars: selectedCalendars.map((calendar) => calendar.summary ?? "Google Calendar") });
  } catch { response.status(502).json({ error: "Calendar is temporarily unavailable" }); }
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
