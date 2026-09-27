# Discord Slash-Command Bot

A full-stack web app and Discord bot that receives slash commands via an HTTP interactions endpoint, processes them with AI triage, responds in Discord, mirrors notifications to a second channel, and exposes an admin dashboard with configurable command behavior.

**Live URL:** https://discord-bot-app-five.vercel.app  
**Dashboard:** https://discord-bot-app-five.vercel.app/dashboard

---

## What the App Does

1. **Users run slash commands** (`/report`, `/status`) in any Discord server the bot is added to.
2. **`/report`** opens a modal form (title, description, severity). On submit, the report is categorized by AI (Groq/Llama 3.1), logged to the database, mirrored to a notifications channel, and posted with action buttons (Resolve, Escalate, Assign).
3. **`/status`** returns the bot's current status with a configurable response template.
4. **Action buttons** are restricted to approved admins (stored in a database table). Clicking one updates the message, removes the buttons, and mirrors the action.
5. **The dashboard** (behind Supabase auth) shows a live command log, a settings panel with per-server configurable rules, and a failures tab for observability.
6. **Multi-server support** — each Discord server is isolated with its own config, webhook URL, and logs. A server picker in the dashboard lets the admin switch between them.

---

## Architecture

```
Discord User → /report or /status
       │
       ▼
Discord Platform (HTTP POST)
       │
       ▼
Vercel (Next.js serverless function)
  /api/interactions
       │
       ├─ Verify Ed25519 signature
       ├─ Deduplicate on interaction ID
       ├─ Fetch per-server config from Supabase
       │
       ├─ Type 2 (slash command) → open modal or reply
       ├─ Type 5 (modal submit) → AI triage → log → mirror → respond with buttons
       ├─ Type 3 (button click) → admin check → update message → mirror
       │
       ├─ Supabase (Postgres) ← command logs, config, servers, admins, errors
       ├─ Groq API ← AI categorization and summary
       └─ Discord Webhook ← mirror to notifications channel (per-server)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Hosting | Vercel (free tier) |
| Database | Supabase (Postgres, free tier) |
| Auth | Supabase Auth |
| Bot Identity | Discord Developer Portal |
| Signature Verification | discord-interactions (Ed25519) |
| AI Triage | Groq API (Llama 3.1 8B Instant, free tier) |
| Mirror | Discord Webhooks (per-server) |

---

## How to Run Locally

### Prerequisites

- Node.js 18+
- npm
- A Discord application (from Developer Portal)
- A Supabase project
- A Groq API key (from console.groq.com)

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/discord-bot-app.git
cd discord-bot-app
npm install
cp .env.example .env.local
# Fill in all values in .env.local
npm run dev
```

Open http://localhost:3000/dashboard to access the admin dashboard.

### Register Slash Commands

```bash
export DISCORD_APP_ID=your_app_id
export DISCORD_BOT_TOKEN=your_bot_token
node scripts/register-commands.js
```

For instant registration during development, edit the script to use guild commands (see comments in the file).

---

## Environment Variables

See `.env.example` for the full list:

```
DISCORD_APP_ID=your_application_id
DISCORD_PUBLIC_KEY=your_public_key
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_WEBHOOK_URL=your_default_webhook_url
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_api_key
```

No real secrets are committed to the repository.

---

## Database Schema

**command_logs** — every command and action recorded  
**command_config** — per-server configurable rules (enable/disable, mirror, AI, templates)  
**servers** — tracked Discord servers with webhook URLs  
**admins** — approved users who can use action buttons  
**error_logs** — every failure (webhook, AI, database) for observability  

---

## How to Test

### Admin Dashboard

1. Go to https://discord-bot-app-five.vercel.app/login
2. Email: `admin@test.com` / Password: `admin123456`
3. Command Log tab shows all interactions
4. Settings tab lets you toggle commands, mirroring, AI, and templates
5. Failures tab shows errors with dismiss capability

### Slash Commands

1. Add the bot to your server using the OAuth2 URL from the Developer Portal
2. Run `/status` — bot replies with status info
3. Run `/report` — a modal form opens. Fill in title, description, severity
4. The bot responds with AI triage analysis and action buttons
5. Click a button (admin-only) — the message updates and the action is mirrored

### Security Tests

```bash
chmod +x scripts/test-security.sh
./scripts/test-security.sh
```

This tests forged requests, missing headers, malformed payloads, and replay attacks. All should return 401.

---

## Deployment

Deployed on Vercel. To redeploy:

```bash
npm run build
vercel --prod
```

The interactions endpoint URL registered with Discord:  
`https://discord-bot-app-five.vercel.app/api/interactions`

---

## Features Implemented

### Core Requirements
- ✅ Interactions endpoint with Ed25519 signature verification
- ✅ Two slash commands (/report, /status)
- ✅ Bot responds in Discord
- ✅ Mirror to second channel via webhook
- ✅ Admin dashboard behind login
- ✅ Live command log
- ✅ Deployed on public URL

### Stretch Goals
- ✅ Modal form for /report (interaction type 5)
- ✅ Action buttons — Resolve, Escalate, Assign (interaction type 3)
- ✅ AI triage via Groq (categorize, severity, summary)
- ✅ Configurable command rules in the dashboard UI
- ✅ Multi-server support with isolated config and logs
- ✅ Observability — error logging, failures tab, graceful degradation
- ✅ Deduplication on interaction ID
- ✅ Admin authorization via database (not just Discord roles)

### Security
- ✅ Ed25519 signature verification on every request
- ✅ Rejects forged, unsigned, and replayed requests
- ✅ Secrets in environment variables only — never in code, client-side, or logs
- ✅ Admin-only action buttons with database-backed authorization
- ✅ Ephemeral error messages (only the unauthorized user sees the rejection)
