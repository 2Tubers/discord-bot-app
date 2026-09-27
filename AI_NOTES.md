# AI_NOTES.md

## Tools & Models Used

- **Claude (Anthropic, Opus 4.6)** — architecture planning, code scaffolding, debugging, documentation
- **Groq (Llama 3.1 8B Instant)** — AI triage for report categorization (inside the app, not for development)

## How I Split Work with AI

I drove all architectural decisions and service setup — creating accounts, configuring Discord, Supabase, and Vercel, and choosing between alternatives when trade-offs arose. Claude generated initial code scaffolds which I reviewed, tested, and modified before committing. Every deployment, environment configuration, and integration test was done by me manually. When things broke, I diagnosed the symptoms (checking logs, comparing local vs deployed behavior) and brought findings to Claude to narrow down root causes together.

## Key Decisions I Made

1. **Supabase over Neon + Passport.js** — I proposed using Passport.js for auth, but after weighing the trade-offs, chose Supabase because it bundles Postgres, auth, and realtime in one service. This cut three integration points down to one. Passport.js would have been the right call if I needed multi-provider OAuth or was on a different database.

2. **Option B (database admin list) over Discord role checks** — For button authorization (Resolve/Escalate/Assign), I chose to build a custom `admins` table rather than relying on Discord's permission bitfields. This gives me explicit control over who can take admin actions, independent of Discord server roles, and ties into the dashboard for admin management.

3. **Per-server webhook URLs stored in the database** — When testing multi-server support, I noticed Server 2's notifications weren't mirroring because the webhook URL was hardcoded in `.env`. I decided each server should store its own webhook URL in the `servers` table, with the `.env` value as a fallback. This makes the system genuinely multi-tenant.

## The Hardest Bug

The Ed25519 signature verification worked locally but failed on every Vercel deployment. Discord kept rejecting the endpoint URL with "could not be verified." Debugging this took the longest of any single issue and had three stacked root causes:

**What happened:** I added `console.log` debug lines to the deployed function but saw no output in Vercel logs — just a bare `401`. I checked the env vars through the Vercel CLI and they showed `[SENSITIVE]`, so I couldn't tell if they were correct. I created a separate `/api/test` endpoint that printed the first 8 characters of each env var — this confirmed the public key was reaching the runtime.

**What I found:** The debug logs finally appeared after a clean redeploy and showed `Public key: MISSING` with `length: 0`. I inspected `.env.local` and discovered `DISCORD_PUBLIC KEY` had a space instead of an underscore, plus spaces around `=` on several lines. After fixing the file format, the key loaded locally but was still empty on Vercel — because the module-level constant (`export const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!`) captured the value at import time, before Vercel injected the env vars. Moving the read inside the function body fixed it. The final layer: `verifyKey` returns a Promise, and I wasn't awaiting it — so the check evaluated the Promise object (truthy) instead of the actual boolean result.

**How I noticed each layer:** Vercel logs, the `/api/test` diagnostic endpoint, and reading the debug output carefully — specifically the line `Signature valid: Promise { <pending> }` which revealed the async bug.

## What I'd Improve With More Time

- Replace 5-second polling with Supabase Realtime for instant dashboard updates
- Add retry queue with exponential backoff for failed webhooks and AI calls
- Unit tests for signature verification and command handling
- Rate limiting on the dashboard API
- Structured logging with correlation IDs per interaction
