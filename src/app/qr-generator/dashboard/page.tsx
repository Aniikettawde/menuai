"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { qrAuthClient } from "@/lib/qr-auth-client";

interface TrackedQr {
  id: string;
  short_code: string;
  label: string;
  qr_type: string;
  destination: string;
  scan_count: number;
  created_at: string;
}

export default function QrDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<TrackedQr[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await qrAuthClient.auth.getUser();
      if (!user) { setLoading(false); return; }
      setEmail(user.email ?? null);

      const { data, error } = await qrAuthClient
        .from("tracked_qr_codes")
        .select("id, short_code, label, qr_type, destination, scan_count, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) setRows(data as TrackedQr[]);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    await qrAuthClient.auth.signOut();
    router.push("/qr-generator");
  }

  if (loading) {
    return <main className="min-h-[60vh] flex items-center justify-center text-[#6E6557]">Loading…</main>;
  }

  if (!email) {
    return (
      <main className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-[#211C16] font-medium">You're not signed in.</p>
        <a href="/qr-generator" className="text-sm text-[#2B4570] underline">Go generate a QR code to sign in</a>
      </main>
    );
  }

  const totalScans = rows.reduce((sum, r) => sum + (r.scan_count || 0), 0);

  return (
    <main className="min-h-[85vh] bg-[#FAF6EE] px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-1">Signed in as</p>
            <h1 className="text-2xl font-semibold text-[#211C16]">{email}</h1>
          </div>
          <button onClick={handleSignOut} className="text-sm text-[#B3261E] underline">Sign out</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-[#211C16]/10 p-4">
            <p className="text-xs text-[#A8A08D] uppercase tracking-wide">QR Codes Tracked</p>
            <p className="text-2xl font-semibold text-[#211C16]">{rows.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#211C16]/10 p-4">
            <p className="text-xs text-[#A8A08D] uppercase tracking-wide">Total Scans</p>
            <p className="text-2xl font-semibold text-[#211C16]">{totalScans}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-[#6E6557]">
            No tracked QR codes yet — generate one on the{" "}
            <a href="/qr-generator" className="underline">QR generator</a> and choose "Sign in & Track" on download.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-[#211C16]/10 p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#211C16] capitalize truncate">{r.label} · {r.qr_type}</p>
                  <p className="text-xs text-[#A8A08D] truncate">{r.destination}</p>
                  <p className="text-xs text-[#A8A08D] mt-1">dinezy.in/s/{r.short_code}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-lg font-semibold text-[#2B4570]">{r.scan_count}</p>
                  <p className="text-[11px] text-[#A8A08D]">scans</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}