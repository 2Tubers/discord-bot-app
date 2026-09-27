export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("servers")
      .select("*")
      .eq("active", true)
      .order("added_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch servers" }, { status: 500 });
  }
}

// Update server settings (webhook URL)
export async function PUT(request: NextRequest) {
  try {
    const { guild_id, webhook_url } = await request.json();

    if (!guild_id) {
      return NextResponse.json({ error: "guild_id is required" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("servers")
      .update({ webhook_url })
      .eq("guild_id", guild_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update server" }, { status: 500 });
  }
}