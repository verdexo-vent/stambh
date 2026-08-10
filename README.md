# Stambh

Stambh is a personal operations intelligence: one calm interface for priorities, schedule, messages, health, finances, relationships, and long-term context.

This repository contains the first product prototype. It is intentionally provider-agnostic and ships with a Cloudflare Workers AI adapter plus a safe preview fallback.

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

## Near-term roadmap

- Persistent encrypted memory
- Gmail and Calendar read-only connectors
- Approval-gated actions
- Voice input and speech output
- Startup service and secure local authentication
- Provider routing between Cloudflare, Codex, and stronger fallback models
