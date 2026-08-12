# Stambh

Stambh is a personal operations intelligence: one calm interface for priorities, schedule, messages, health, finances, relationships, and long-term context.

Version 0.2 is a working private beta. It is provider-agnostic and ships with a Cloudflare Workers AI adapter plus a safe preview fallback.

## Working capabilities

- Seven-day read-only view across selected Google calendars
- Local priority board with persistent completion state
- Local personal memory and an activity audit trail
- Private briefing generated from locally stored priorities
- Persistent browser chat history
- Browser speech recognition and text-to-speech
- Explicit approval boundary for future external actions

## Stack

- React 19 + TypeScript + Vite
- Motion for restrained interaction
- Express API boundary
- Zod request validation
- Cloudflare Workers AI provider adapter

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:4173`.

Without credentials, Stambh runs in preview mode. To enable Workers AI, set:

```text
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

Never commit `.env` or expose provider credentials to the browser.

## Architecture principles

1. The UI never receives provider credentials.
2. Model providers sit behind the server API and can be swapped later.
3. External actions require explicit confirmation and tool verification.
4. Personal data integrations should begin read-only.
5. The assistant never claims an action succeeded without a confirmed tool result.
6. Tasks and memories live in `data/stambh-personal.json`, which is ignored by Git.
7. Local memories are not automatically sent to the configured model provider.

## Private data

The Windows deployment stores OAuth credentials under `secrets/` and generated tokens and personal context under `data/`. Both directories are ignored by Git and should be restricted with Windows ACLs. The local JSON data is access-controlled but not encrypted at rest yet.

## Near-term roadmap

- Encrypted-at-rest memory
- Gmail read-only connector and draft generation
- Approval-gated calendar and email actions
- Optional always-available voice service
- Startup service and secure local authentication
- Provider routing between Cloudflare, Codex, and stronger fallback models
