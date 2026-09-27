import { verifyKey } from "discord-interactions";

// ─── Interaction Types ───────────────────────────────────────────────
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const;

// ─── Response Types ──────────────────────────────────────────────────
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
} as const;

// ─── Signature Verification ─────────────────────────────────────────
export async function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): Promise<boolean> {
  if (!signature || !timestamp) {
    return false;
  }
  const publicKey = process.env.DISCORD_PUBLIC_KEY!;
  return await verifyKey(rawBody, signature, timestamp, publicKey);
}

// ─── Fetch Guild Name from Discord API ──────────────────────────────
export async function fetchGuildName(guildId: string): Promise<string> {
  try {
    const botToken = process.env.DISCORD_BOT_TOKEN!;
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch guild:", response.status);
      return "Unknown Server";
    }

    const data = await response.json();
    return data.name ?? "Unknown Server";
  } catch (error) {
    console.error("Error fetching guild name:", error);
    return "Unknown Server";
  }
}

// ─── Send a follow-up message ───────────────────────────────────────
export async function sendFollowUp(
  interactionToken: string,
  content: string
) {
  const appId = process.env.DISCORD_APP_ID!;
  const url = `https://discord.com/api/v10/webhooks/${appId}/${interactionToken}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    console.error("Follow-up failed:", response.status, await response.text());
  }
}

// ─── Mirror to a webhook URL ────────────────────────────────────────
// Now accepts a URL parameter — uses env var as fallback
export async function mirrorToWebhook(
  content: string,
  webhookUrl?: string
) {
  const url = webhookUrl ?? process.env.DISCORD_WEBHOOK_URL!;
  if (!url) {
    console.error("No webhook URL available for mirroring");
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      username: "Bot Mirror",
    }),
  });

  if (!response.ok) {
    console.error("Mirror failed:", response.status, await response.text());
  }
}