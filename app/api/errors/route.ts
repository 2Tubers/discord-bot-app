export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const guildId = request.nextUrl.searchParams.get("guild_id");
    const supabase = getSupabaseClient();

    let query = supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (guildId) {
      query = query.eq("guild_id", guildId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch errors" }, { status: 500 });
  }
}

// Mark an error as resolved
export async function PUT(request: NextRequest) {
  try {
    const { id } = await request.json();
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("error_logs")
      .update({ resolved: true })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update error" }, { status: 500 });
  }
}