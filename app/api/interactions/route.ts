export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { triageReport } from "@/lib/ai";
import {
  verifyDiscordSignature,
  InteractionType,
  InteractionResponseType,
  sendFollowUp,
  mirrorToWebhook,
  fetchGuildName,
} from "@/lib/discord";

// ─── POST Handler ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  const isValid = await verifyDiscordSignature(rawBody, signature, timestamp);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid request signature" },
      { status: 401 }
    );
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.guild_id) {
    await trackServer(interaction);
  }

  // ── Deduplicate (database-backed) ───────────────────────────────
  const interactionId: string = interaction.id;
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from("command_logs")
    .select("response")
    .eq("interaction_id", interactionId)
    .single();

  if (existing) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: existing.response,
        flags: 64,
      },
    });
  }

  // ── Route by interaction type ───────────────────────────────────
  switch (interaction.type) {
    case InteractionType.APPLICATION_COMMAND:
      return handleSlashCommand(interaction);
    case InteractionType.MESSAGE_COMPONENT:
      return handleButton(interaction);
    case InteractionType.MODAL_SUBMIT:
      return handleModalSubmit(interaction);
    default:
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "Interaction type not supported." },
      });
  }
}

// ─── Track Server ─────────────────────────────────────────────────────
async function trackServer(interaction: any) {
  try {
    const supabase = getSupabaseClient();
    const guildId = interaction.guild_id;

    const { data: existing } = await supabase
      .from("servers")
      .select("guild_name")
      .eq("guild_id", guildId)
      .single();

    let guildName = existing?.guild_name;
    if (!guildName || guildName === "Unknown Server") {
      guildName = await fetchGuildName(guildId);
    }

    await supabase.from("servers").upsert(
      {
        guild_id: guildId,
        guild_name: guildName,
        active: true,
      },
      { onConflict: "guild_id" }
    );
  } catch (error) {
    console.error("Failed to track server:", error);
  }
}

// ─── Get Webhook URL for a Guild ──────────────────────────────────────
async function getWebhookUrl(guildId: string | null): Promise<string | undefined> {
  if (!guildId) return undefined;

  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("servers")
      .select("webhook_url")
      .eq("guild_id", guildId)
      .single();

    return data?.webhook_url ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── Fetch Command Config (per-guild) ─────────────────────────────────
async function getCommandConfig(commandName: string, guildId: string | null) {
  try {
    const supabase = getSupabaseClient();

    if (guildId) {
      const { data } = await supabase
        .from("command_config")
        .select("*")
        .eq("command_name", commandName)
        .eq("guild_id", guildId)
        .single();

      if (data) return data;
    }

    const { data } = await supabase
      .from("command_config")
      .select("*")
      .eq("command_name", commandName)
      .is("guild_id", null)
      .single();

    return data;
  } catch {
    return {
      enabled: true,
      mirror_enabled: true,
      ai_triage_enabled: true,
      response_template: null,
      default_severity: "low",
    };
  }
}

// ─── Slash Commands ───────────────────────────────────────────────────
async function handleSlashCommand(interaction: any) {
  const commandName = interaction.data.name;
  const user = interaction.member?.user?.username ?? "Unknown user";
  const guildId = interaction.guild_id ?? null;
  const config = await getCommandConfig(commandName, guildId);

  if (config && !config.enabled) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `⚠️ The /${commandName} command is currently disabled.`,
        flags: 64,
      },
    });
  }

  switch (commandName) {
    case "report": {
      return NextResponse.json({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: "report_modal",
          title: "Submit a Report",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "report_title",
                  label: "Title",
                  style: 1,
                  placeholder: "Brief summary of the issue",
                  required: true,
                  max_length: 100,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "report_description",
                  label: "Description",
                  style: 2,
                  placeholder: "Describe the issue in detail",
                  required: true,
                  max_length: 1000,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "report_severity",
                  label: "Severity (low, medium, high)",
                  style: 1,
                  placeholder: config?.default_severity ?? "low",
                  required: true,
                  max_length: 10,
                },
              ],
            },
          ],
        },
      });
    }

    case "status": {
      if (config?.mirror_enabled) {
        await safeMirror(`**Status check** by ${user}`, guildId, interaction.id);
      }
      await logCommand(interaction, `Status check by ${user}`);

      const responseText = config?.response_template
        ? config.response_template
            .replace("{user}", user)
            .replace("{time}", new Date().toISOString())
        : `Bot is online and operational.\nRequested by: ${user}\nTime: ${new Date().toISOString()}`;

      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: responseText },
      });
    }

    default:
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `Unknown command: /${commandName}` },
      });
  }
}

// ─── Modal Submit Handler ─────────────────────────────────────────────
async function handleModalSubmit(interaction: any) {
  const customId = interaction.data.custom_id;
  const user = interaction.member?.user?.username ?? "Unknown user";
  const guildId = interaction.guild_id ?? null;

  if (customId === "report_modal") {
    const config = await getCommandConfig("report", guildId);

    const fields = interaction.data.components;
    const title = fields[0]?.components[0]?.value ?? "No title";
    const description = fields[1]?.components[0]?.value ?? "No description";
    const severity = fields[2]?.components[0]?.value?.toLowerCase() ?? "low";

    const validSeverity = ["low", "medium", "high"].includes(severity)
      ? severity
      : config?.default_severity ?? "low";

    let triage = { category: "unknown", severity: validSeverity, summary: title };
    if (config?.ai_triage_enabled) {
      triage = await safeTriageReport(title, description, guildId, interaction.id);
    }

    if (config?.mirror_enabled) {
      const mirrorLines = [
        `**New Report** from ${user}`,
        `**Title:** ${title}`,
        `**Severity:** ${validSeverity}`,
      ];
      if (config?.ai_triage_enabled) {
        mirrorLines.push(
          `**AI Category:** ${triage.category}`,
          `**AI Severity:** ${triage.severity}`,
          `**AI Summary:** ${triage.summary}`
        );
      }
      mirrorLines.push(`> ${description}`);
      await safeMirror(mirrorLines.join("\n"), guildId, interaction.id);
    }

    await logCommand(
      interaction,
      `Report: [${validSeverity}] ${title} - ${description}`,
      "success",
      config?.ai_triage_enabled ? triage : undefined
    );

    const finalSeverity =
      triage.severity !== "low" && validSeverity === "low"
        ? triage.severity
        : validSeverity;

    const severityEmoji =
      finalSeverity === "high" ? "🔴" : finalSeverity === "medium" ? "🟡" : "🟢";

    const categoryEmoji: Record<string, string> = {
      bug: "🐛",
      feature_request: "💡",
      question: "❓",
      incident: "🚨",
      spam: "🚫",
      hate_speech: "⛔",
      inappropriate_content: "🔞",
      harassment: "🛑",
      other: "📋",
      unknown: "📋",
    };

    const contentLines = [
      `**Report Submitted** ${severityEmoji}`,
      `**Title:** ${title}`,
      `**Severity:** ${finalSeverity}`,
      `**Description:** ${description}`,
      `**Submitted by:** ${user}`,
    ];

    if (config?.ai_triage_enabled) {
      contentLines.push(
        ``,
        `${categoryEmoji[triage.category] ?? "📋"} **AI Triage**`,
        `**Category:** ${triage.category}`,
        `**AI Severity:** ${triage.severity}`,
        `**Summary:** ${triage.summary}`
      );
    }

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: contentLines.join("\n"),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: "✅ Mark Resolved",
                custom_id: `resolve_report_${interaction.id}`,
              },
              {
                type: 2,
                style: 4,
                label: "🔺 Escalate",
                custom_id: `escalate_report_${interaction.id}`,
              },
              {
                type: 2,
                style: 2,
                label: "📋 Assign to Me",
                custom_id: `assign_report_${interaction.id}`,
              },
            ],
          },
        ],
      },
    });
  }

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown form submitted." },
  });
}

// ─── Button Click Handler ─────────────────────────────────────────────
async function handleButton(interaction: any) {
  const customId: string = interaction.data.custom_id;
  const user = interaction.member?.user?.username ?? "Unknown user";
  const guildId = interaction.guild_id ?? null;

  const admin = await isAdmin(interaction);
  if (!admin) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "⛔ You are not authorized to perform this action.",
        flags: 64,
      },
    });
  }

  const config = await getCommandConfig("report", guildId);

  if (customId.startsWith("resolve_report_")) {
    if (config?.mirror_enabled) {
      await safeMirror(`**Report Resolved** by ${user}`, guildId, interaction.id);
    }
    await logCommand(interaction, `Resolved report`, "resolved");

    return NextResponse.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content:
          interaction.message.content +
          `\n\n✅ **Resolved** by ${user} at ${new Date().toISOString()}`,
        components: [],
      },
    });
  }

  if (customId.startsWith("escalate_report_")) {
    if (config?.mirror_enabled) {
      await safeMirror(`🔺 **Report Escalated** by ${user}`, guildId, interaction.id);
    }
    await logCommand(interaction, `Escalated report`, "escalated");

    return NextResponse.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content:
          interaction.message.content +
          `\n\n🔺 **Escalated** by ${user} at ${new Date().toISOString()}`,
        components: [],
      },
    });
  }

  if (customId.startsWith("assign_report_")) {
    if (config?.mirror_enabled) {
      await safeMirror(`📋 **Report Assigned** to ${user}`, guildId, interaction.id);
    }
    await logCommand(interaction, `Assigned report to ${user}`, "assigned");

    return NextResponse.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content:
          interaction.message.content +
          `\n\n📋 **Assigned** to ${user} at ${new Date().toISOString()}`,
        components: [],
      },
    });
  }

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown button." },
  });
}

// ─── Safe Wrappers (Observability) ────────────────────────────────────
async function safeMirror(content: string, guildId: string | null, interactionId: string) {
  try {
    const webhookUrl = guildId ? await getWebhookUrl(guildId) : undefined;
    await mirrorToWebhook(content, webhookUrl);
  } catch (error: any) {
    await logError({
      guild_id: guildId,
      interaction_id: interactionId,
      error_type: "webhook_mirror",
      error_message: error?.message ?? "Mirror webhook failed",
      context: { content_preview: content.slice(0, 200) },
    });
  }
}

async function safeTriageReport(
  title: string,
  description: string,
  guildId: string | null,
  interactionId: string
) {
  try {
    return await triageReport(title, description);
  } catch (error: any) {
    await logError({
      guild_id: guildId,
      interaction_id: interactionId,
      error_type: "ai_triage",
      error_message: error?.message ?? "AI triage failed",
      context: { title, description_preview: description.slice(0, 200) },
    });
    return { category: "unknown", severity: "low", summary: title };
  }
}

// ─── Error Logging ────────────────────────────────────────────────────
async function logError(entry: {
  guild_id: string | null;
  interaction_id: string;
  error_type: string;
  error_message: string;
  context: any;
}) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("error_logs").insert(entry);
  } catch (err) {
    console.error("Failed to log error:", err, "Original error:", entry);
  }
}

// ─── Admin Check ──────────────────────────────────────────────────────
async function isAdmin(interaction: any): Promise<boolean> {
  const userId = interaction.member?.user?.id;
  if (!userId) return false;

  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("admins")
      .select("id")
      .eq("discord_user_id", userId)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

// ─── Database Logging ─────────────────────────────────────────────────
async function logCommand(
  interaction: any,
  response: string,
  status: string = "success",
  triage?: { category: string; severity: string; summary: string }
) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("command_logs").insert({
      interaction_id: interaction.id,
      command_name:
        interaction.data?.name ?? interaction.data?.custom_id ?? "unknown",
      user_name: interaction.member?.user?.username ?? "unknown",
      user_id: interaction.member?.user?.id ?? null,
      guild_id: interaction.guild_id ?? null,
      channel_id: interaction.channel_id ?? null,
      options: interaction.data?.options ?? interaction.data?.components ?? {},
      response,
      status,
      ai_category: triage?.category ?? null,
      ai_severity: triage?.severity ?? null,
      ai_summary: triage?.summary ?? null,
    });
  } catch (error: any) {
    await logError({
      guild_id: interaction.guild_id ?? null,
      interaction_id: interaction.id,
      error_type: "database_log",
      error_message: error?.message ?? "Failed to log command",
      context: { command: interaction.data?.name, response },
    });
  }
}