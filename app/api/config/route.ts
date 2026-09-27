export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

// ─── GET: Fetch configs, optionally filtered by guild ─────────────────
export async function GET(request: NextRequest) {
  try {
    const guildId = request.nextUrl.searchParams.get("guild_id");
    const supabase = getSupabaseClient();

    let query = supabase.from("command_config").select("*").order("command_name");

    if (guildId) {
      query = query.eq("guild_id", guildId);
    } else {
      query = query.is("guild_id", null);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If guild-specific config doesn't exist yet, return globals as template
    if (guildId && (!data || data.length === 0)) {
      const { data: globals } = await supabase
        .from("command_config")
        .select("*")
        .is("guild_id", null)
        .order("command_name");

      return NextResponse.json(globals ?? []);
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

// ─── PUT: Update a command config ─────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      command_name,
      guild_id,
      enabled,
      mirror_enabled,
      ai_triage_enabled,
      response_template,
      default_severity,
    } = body;

    if (!command_name) {
      return NextResponse.json({ error: "command_name is required" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Upsert — creates guild-specific config if it doesn't exist
    const { data, error } = await supabase
      .from("command_config")
      .upsert(
        {
          command_name,
          guild_id: guild_id ?? null,
          enabled,
          mirror_enabled,
          ai_triage_enabled,
          response_template,
          default_severity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "command_name,guild_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}