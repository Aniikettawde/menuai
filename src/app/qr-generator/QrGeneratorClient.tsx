"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { supabasePublic } from "@/lib/qr-public-client";

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function logGeneration(destinationUrl: string) {
  // Fire-and-forget — never block the user's QR on a database write.
  supabasePublic
    .from("qr_codes")
    .insert({ destination_url: destinationUrl })
    .then(({ error }) => {
      if (error) console.error("QR log failed:", error.message);
    });
}

export default function QrGeneratorClient() {
  const [url, setUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [ticketNo, setTicketNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();

    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError("Enter a valid link, e.g. https://example.com");
      setQrDataUrl(null);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const dataUrl = await QRCode.toDataURL(normalized, {
        width: 720,
        margin: 1,
        color: { dark: "#211C16", light: "#FAF6EE" },
      });
      setQrDataUrl(dataUrl);
      setDestination(normalized);
      setTicketNo(String(Math.floor(100000 + Math.random() * 900000)));
      logGeneration(normalized);
    } catch (err) {
      console.error(err);
      setError("Couldn't generate that QR code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `dinezy-qr-${ticketNo || "code"}.png`;
    a.click();
  }

  function handleReset() {
    setUrl("");
    setQrDataUrl(null);
    setDestination("");
    setError("");
  }

  return (
    <main className="min-h-[85vh] flex items-center justify-center bg-[#FAF6EE] px-4 py-16">
      <div className="w-full max-w-md">
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#2B4570] uppercase mb-3 text-center">
          Dinezy · Free Tools
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#211C16] text-center">
          Turn any link into a QR code
        </h1>
        <p className="mt-3 text-[#6E6557] text-center text-[15px]">
          Paste a link, get your QR instantly. Free, unlimited, no account
          needed.
        </p>

        <form onSubmit={handleGenerate} className="mt-8 space-y-3">
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-link.com"
            className="w-full rounded-lg border border-[#D9D2C0] bg-white px-4 py-3 text-[15px] text-[#211C16] placeholder:text-[#A8A08D] outline-none focus:border-[#2B4570] focus:ring-1 focus:ring-[#2B4570] transition"
          />
          {error && (
            <p className="text-sm text-[#B3261E]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full rounded-lg bg-[#211C16] text-[#FAF6EE] py-3 font-medium disabled:opacity-40 hover:bg-[#352D23] transition"
          >
            {loading ? "Generating…" : "Generate QR code"}
          </button>
        </form>

        {qrDataUrl && (
          <div className="mt-10 ticket-in">
            <div className="relative rounded-2xl bg-white border border-[#211C16]/10 overflow-hidden">
              <div
                aria-hidden
                className="absolute top-9 right-5 font-mono text-[10px] tracking-[0.15em] text-[#2B4570]/40 uppercase rotate-[-8deg] select-none"
              >
                Generated
              </div>

              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <span className="font-mono text-[11px] tracking-widest text-[#6E6557] uppercase">
                  Dinezy QR
                </span>
                <span className="font-mono text-[11px] text-[#6E6557]">
                  No. {ticketNo}
                </span>
              </div>

              <div className="perforation" aria-hidden />

              <div className="flex flex-col items-center px-6 py-6">
                <img
                  src={qrDataUrl}
                  alt={`QR code linking to ${destination}`}
                  className="w-48 h-48 sm:w-56 sm:h-56"
                />
                <p className="mt-4 max-w-[260px] truncate font-mono text-[12px] text-[#6E6557]">
                  {destination}
                </p>
              </div>

              <div className="perforation" aria-hidden />

              <div className="flex gap-3 px-5 py-4">
                <button
                  onClick={handleDownload}
                  className="flex-1 rounded-lg bg-[#2B4570] text-white py-2.5 text-sm font-medium hover:bg-[#23395C] transition"
                >
                  Download PNG
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-lg border border-[#D9D2C0] text-[#211C16] py-2.5 text-sm font-medium hover:bg-[#FAF6EE] transition"
                >
                  Create another
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-[13px] text-[#A8A08D]">
          No sign-up. No watermark. No limit on how many you create.
        </p>
      </div>

      <style jsx>{`
        .perforation {
          height: 14px;
          background-image: radial-gradient(
            circle,
            #ffffff 3px,
            transparent 3.5px
          );
          background-size: 14px 14px;
          background-position: center;
          background-color: #d9d2c0;
        }
        .ticket-in {
          animation: ticket-in 0.35s ease-out;
        }
        @keyframes ticket-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticket-in {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}