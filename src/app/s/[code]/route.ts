import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { data } = await supabase
    .from("tracked_qr_codes")
    .select("id, destination")
    .eq("short_code", code)
    .single();

  if (!data) return NextResponse.redirect("https://dinezy.in");

  await supabase.rpc("increment_scan", { qr_id: data.id }).then(() => {});
  await supabase.from("qr_scans").insert({ tracked_qr_id: data.id });

  return NextResponse.redirect(data.destination);
}