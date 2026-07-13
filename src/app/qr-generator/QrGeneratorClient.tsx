"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabasePublic } from "@/lib/qr-public-client";
import { qrAuthClient } from "@/lib/qr-auth-client";
import DownloadTrackModal from "@/components/DownloadTrackModal";

import { useRouter } from "next/navigation";

// ---------- Types ----------
type GenMode = "single" | "bulk";
type BulkSubMode = "list" | "sequential";

type QrContentType =
  | "url"
  | "text"
  | "whatsapp"
  | "email"
  | "phone"
  | "sms"
  | "wifi"
  | "upi";

type DotType = "square" | "dots" | "rounded" | "classy" | "classy-rounded" | "extra-rounded";
type CornerSquareType = "square" | "dot" | "extra-rounded";
type CornerDotType = "square" | "dot";
type ExportFormat = "png" | "jpeg" | "webp" | "svg";

const MAX_BULK_ITEMS = 200;

const SIZE_PRESETS = [
  { label: "Small (300px)", value: 300 },
  { label: "Medium (500px)", value: 500 },
  { label: "Large (800px)", value: 800 },
  { label: "Print (1200px)", value: 1200 },
];

const DOT_STYLES: { label: string; value: DotType }[] = [
  { label: "Square", value: "square" },
  { label: "Dots", value: "dots" },
  { label: "Rounded", value: "rounded" },
  { label: "Classy", value: "classy" },
  { label: "Classy Rounded", value: "classy-rounded" },
  { label: "Extra Rounded", value: "extra-rounded" },
];
const CORNER_SQUARE_STYLES: { label: string; value: CornerSquareType }[] = [
  { label: "Square", value: "square" },
  { label: "Dot", value: "dot" },
  { label: "Extra Rounded", value: "extra-rounded" },
];
const CORNER_DOT_STYLES: { label: string; value: CornerDotType }[] = [
  { label: "Square", value: "square" },
  { label: "Dot", value: "dot" },
];
const PRESET_PALETTES: { name: string; fg: string; bg: string }[] = [
  { name: "Classic", fg: "#000000", bg: "#ffffff" },
  { name: "Dinezy Ivory", fg: "#211C16", bg: "#FAF6EE" },
  { name: "Burgundy", fg: "#8b2635", bg: "#fdf6f2" },
  { name: "Midnight", fg: "#0f172a", bg: "#e2e8f0" },
  { name: "Forest", fg: "#14532d", bg: "#f0fdf4" },
  { name: "Sunset", fg: "#9a3412", bg: "#fff7ed" },
];

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function logGeneration(destinationUrl: string, type: string) {
  supabasePublic
    .from("qr_codes")
    .insert({ destination_url: destinationUrl, qr_type: type })
    .then(({ error }) => {
      if (error) console.error("QR log failed:", error.message);
    });
}

function sanitizeFilename(s: string): string {
  return s.trim().replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-").slice(0, 60) || "qr";
}

// ---------- Single-mode content builder ----------
function buildQrData(type: QrContentType, fields: Record<string, string>): {
  data: string | null;
  error: string | null;
} {
  switch (type) {
    case "url": {
      const normalized = normalizeUrl(fields.url || "");
      if (!normalized) return { data: null, error: "Enter a valid link, e.g. https://example.com" };
      return { data: normalized, error: null };
    }
    case "text": {
      if (!fields.text?.trim()) return { data: null, error: "Enter some text" };
      return { data: fields.text, error: null };
    }
    case "whatsapp": {
      const phone = (fields.phone || "").replace(/[^0-9]/g, "");
      if (!phone) return { data: null, error: "Enter a valid phone number with country code" };
      const msg = encodeURIComponent(fields.message || "");
      return { data: `https://wa.me/${phone}${msg ? `?text=${msg}` : ""}`, error: null };
    }
    case "email": {
      if (!fields.email?.trim()) return { data: null, error: "Enter an email address" };
      const subject = encodeURIComponent(fields.subject || "");
      const body = encodeURIComponent(fields.body || "");
      const params = [subject && `subject=${subject}`, body && `body=${body}`].filter(Boolean).join("&");
      return { data: `mailto:${fields.email}${params ? `?${params}` : ""}`, error: null };
    }
    case "phone": {
      const phone = (fields.phone || "").trim();
      if (!phone) return { data: null, error: "Enter a phone number" };
      return { data: `tel:${phone}`, error: null };
    }
    case "sms": {
      const phone = (fields.phone || "").trim();
      if (!phone) return { data: null, error: "Enter a phone number" };
      const body = encodeURIComponent(fields.message || "");
      return { data: `sms:${phone}${body ? `?body=${body}` : ""}`, error: null };
    }
    case "wifi": {
      const ssid = (fields.ssid || "").trim();
      if (!ssid) return { data: null, error: "Enter a network name (SSID)" };
      const security = fields.security || "WPA";
      const password = fields.password || "";
      const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
      if (security === "nopass") return { data: `WIFI:T:nopass;S:${esc(ssid)};;`, error: null };
      if (!password) return { data: null, error: "Enter the WiFi password" };
      return { data: `WIFI:T:${security};S:${esc(ssid)};P:${esc(password)};;`, error: null };
    }
    case "upi": {
      const upiId = (fields.upiId || "").trim();
      if (!upiId) return { data: null, error: "Enter a UPI ID (e.g. name@okhdfc)" };
      const params = new URLSearchParams();
      params.set("pa", upiId);
      if (fields.payeeName) params.set("pn", fields.payeeName);
      if (fields.amount) params.set("am", fields.amount);
      params.set("cu", "INR");
      if (fields.note) params.set("tn", fields.note);
      return { data: `upi://pay?${params.toString()}`, error: null };
    }
    default:
      return { data: null, error: "Unsupported type" };
  }
}

interface BulkItem {
  label: string;
  data: string;
}

interface BulkResult extends BulkItem {
  blob: Blob;
  blobUrl: string;
}

export default function QrGeneratorClient() {
  const previewRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<any>(null);

  const [mode, setMode] = useState<GenMode>("single");
const router = useRouter();

  // ----- Single mode state -----
  const [contentType, setContentType] = useState<QrContentType>("url");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [showTrackModal, setShowTrackModal] = useState(false);
const [pendingFormat, setPendingFormat] = useState<ExportFormat>("png");

  // ----- Bulk mode state -----
  const [bulkSubMode, setBulkSubMode] = useState<BulkSubMode>("list");
  const [bulkListText, setBulkListText] = useState("");
  const [seqTemplate, setSeqTemplate] = useState("https://dinezy.in/r/your-restaurant?table={n}");
  const [seqLabelTemplate, setSeqLabelTemplate] = useState("Table {n}");
  const [seqStart, setSeqStart] = useState(1);
  const [seqEnd, setSeqEnd] = useState(20);
  const [seqPad, setSeqPad] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [zipping, setZipping] = useState(false);

  // ----- Shared style state -----
  const [size, setSize] = useState(500);
  const [fgColor, setFgColor] = useState("#211C16");
  const [bgColor, setBgColor] = useState("#FAF6EE");
  const [useGradient, setUseGradient] = useState(false);
  const [gradientColor2, setGradientColor2] = useState("#2B4570");
  const [dotStyle, setDotStyle] = useState<DotType>("rounded");
  const [cornerSquareStyle, setCornerSquareStyle] = useState<CornerSquareType>("extra-rounded");
  const [cornerDotStyle, setCornerDotStyle] = useState<CornerDotType>("dot");
  const [margin, setMargin] = useState(16);
  const [transparentBg, setTransparentBg] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(0.35);
  const [posterBg, setPosterBg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"content" | "style" | "logo">("content");

  const currentData = mode === "single" ? buildQrData(contentType, fields) : { data: null, error: null };

  const getLib = useCallback(async () => {
    const mod = await import("qr-code-styling");
    return mod.default;
  }, []);

  // Build the shared style options object (used for both single preview and every bulk item)
  const buildStyleOptions = useCallback(
    (data: string) => {
      const options: any = {
        width: size,
        height: size,
        data,
        margin,
        qrOptions: { errorCorrectionLevel: logoDataUrl ? "H" : "Q" },
        dotsOptions: useGradient
          ? {
              type: dotStyle,
              gradient: {
                type: "linear",
                rotation: Math.PI / 4,
                colorStops: [
                  { offset: 0, color: fgColor },
                  { offset: 1, color: gradientColor2 },
                ],
              },
            }
          : { type: dotStyle, color: fgColor },
        backgroundOptions: { color: transparentBg ? "transparent" : bgColor },
        cornersSquareOptions: { type: cornerSquareStyle, color: fgColor },
        cornersDotOptions: { type: cornerDotStyle, color: fgColor },
        ...(logoDataUrl
          ? {
              image: logoDataUrl,
              imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: logoSize, hideBackgroundDots: true },
            }
          : {}),
      };
      return options;
    },
    [size, margin, fgColor, bgColor, useGradient, gradientColor2, dotStyle, cornerSquareStyle, cornerDotStyle, transparentBg, logoDataUrl, logoSize]
  );

  // ----- Single mode live preview -----
  const renderQr = useCallback(async () => {
    if (mode !== "single" || !currentData.data || !previewRef.current) return;
    const QRCodeStyling = await getLib();
    const options = buildStyleOptions(currentData.data);
    if (!qrInstanceRef.current) {
      qrInstanceRef.current = new QRCodeStyling(options);
      previewRef.current.innerHTML = "";
      qrInstanceRef.current.append(previewRef.current);
    } else {
      qrInstanceRef.current.update(options);
    }
  }, [mode, currentData.data, buildStyleOptions, getLib]);

  useEffect(() => {
    void renderQr();
  }, [renderQr]);

  // ----- Bulk item parsing -----
  const bulkItems: BulkItem[] = useMemo(() => {
    if (bulkSubMode === "list") {
      return bulkListText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, i) => {
          const parts = line.split(/[|,]/);
          if (parts.length >= 2) {
            const label = parts[0].trim();
            const rest = parts.slice(1).join(",").trim();
            return { label: label || `Item ${i + 1}`, data: rest };
          }
          return { label: `Item ${i + 1}`, data: line };
        })
        .filter((item) => item.data.length > 0);
    }
    // sequential
    const items: BulkItem[] = [];
    if (seqEnd >= seqStart) {
      const width = String(seqEnd).length;
      for (let n = seqStart; n <= seqEnd; n++) {
        const nStr = seqPad ? String(n).padStart(width, "0") : String(n);
        items.push({
          label: seqLabelTemplate.replace(/\{n\}/g, nStr),
          data: seqTemplate.replace(/\{n\}/g, nStr),
        });
      }
    }
    return items;
  }, [bulkSubMode, bulkListText, seqTemplate, seqLabelTemplate, seqStart, seqEnd, seqPad]);

  async function handleGenerateBulk() {
    setBulkError("");
    if (bulkItems.length === 0) {
      setBulkError("Add at least one item to generate.");
      return;
    }
    if (bulkItems.length > MAX_BULK_ITEMS) {
      setBulkError(`Please generate ${MAX_BULK_ITEMS} or fewer at a time (you have ${bulkItems.length}).`);
      return;
    }

    setBulkResults(null);
    setBulkGenerating(true);
    setBulkProgress({ done: 0, total: bulkItems.length });

    const QRCodeStyling = await getLib();
    const results: BulkResult[] = [];

    for (let i = 0; i < bulkItems.length; i++) {
      const item = bulkItems[i];
      const options = buildStyleOptions(item.data);
      const instance = new QRCodeStyling(options);
      const blob = (await instance.getRawData("png")) as Blob;
      const blobUrl = URL.createObjectURL(blob);
      results.push({ ...item, blob, blobUrl });
      setBulkProgress({ done: i + 1, total: bulkItems.length });
      // yield to keep the UI responsive between items
      await new Promise((r) => setTimeout(r, 0));
    }

    setBulkResults(results);
    setBulkGenerating(false);
    logGeneration(`bulk:${results.length}-items`, "bulk");
  }

  async function handleDownloadZip() {
    if (!bulkResults || bulkResults.length === 0) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const usedNames = new Set<string>();
      bulkResults.forEach((r) => {
        let name = sanitizeFilename(r.label);
        let finalName = `${name}.png`;
        let counter = 2;
        while (usedNames.has(finalName)) {
          finalName = `${name}-${counter}.png`;
          counter++;
        }
        usedNames.add(finalName);
        zip.file(finalName, r.blob);
      });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dinezy-qr-batch-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  }

  function handlePrintSheet() {
    window.print();
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentData.data) {
      setError(currentData.error || "Please fill in the required fields");
      return;
    }
    setError("");
    logGeneration(currentData.data, contentType);
  }

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }
  function handleLogoUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }
  function handlePosterUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => setPosterBg(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleDownload(format: ExportFormat) {
    if (!qrInstanceRef.current) return;
    if (!posterBg) {
      qrInstanceRef.current.download({ name: `dinezy-qr-${Date.now()}`, extension: format });
      return;
    }
    const rawData = await qrInstanceRef.current.getRawData("png");
    if (!rawData) return;
    const qrBlobUrl = URL.createObjectURL(rawData as Blob);
    const [bgImg, qrImg] = await Promise.all([loadImage(posterBg), loadImage(qrBlobUrl)]);
    const canvas = document.createElement("canvas");
    const W = Math.max(bgImg.width, size + 200);
    const H = Math.max(bgImg.height, size + 200);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const scale = Math.max(W / bgImg.width, H / bgImg.height);
    const bw = bgImg.width * scale;
    const bh = bgImg.height * scale;
    ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.drawImage(qrImg, (W - size) / 2, (H - size) / 2, size, size);
    const finalUrl = canvas.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png");
    const a = document.createElement("a");
    a.href = finalUrl;
    a.download = `dinezy-qr-poster-${Date.now()}.${format === "jpeg" ? "jpg" : "png"}`;
    a.click();
    URL.revokeObjectURL(qrBlobUrl);
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function applyPalette(fg: string, bg: string) {
    setFgColor(fg);
    setBgColor(bg);
  }
  
 function generateShortCode(): string {
  return (
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 5)
  );
}

// Insert a tracked_qr_codes row, retrying on short_code collisions.
async function insertTrackedRow(userId: string, label: string, qrType: string, destination: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = generateShortCode();
    const { error } = await qrAuthClient
      .from("tracked_qr_codes")
      .insert({ short_code: shortCode, user_id: userId, label, qr_type: qrType, destination });
    if (!error) return shortCode;
    if (error.code !== "23505") { console.error("tracked_qr_codes insert failed:", error.message); return null; }
    // 23505 = unique violation on short_code, retry with a new one
  }
  return null;
}

// Builds the tracked QR from scratch and downloads it — works even right after
// a full page reload (post OAuth redirect), where no live QR instance exists yet.
async function buildAndDownloadTracked(
  format: ExportFormat,
  qrType: string,
  label: string,
  destination: string,
  styleOptionsWithoutData: any,
  userId: string
) {
  const shortCode = await insertTrackedRow(userId, label, qrType, destination);
  if (!shortCode) return; // insert failed — nothing to download

  const trackedUrl = `https://dinezy.in/s/${shortCode}`;
  const QRCodeStyling = await getLib();
  const instance = new QRCodeStyling({ ...styleOptionsWithoutData, data: trackedUrl });
  instance.download({ name: `dinezy-qr-${Date.now()}`, extension: format });
  return shortCode;
}

// Called when the person clicks "Sign in with Google & Track" in the modal.
// Persists everything needed to finish the job after the OAuth round trip.
async function handleSignInAndTrack() {
  if (!currentData.data) return;
  const payload = {
    format: pendingFormat,
    qrType: contentType,
    label: contentType,
    destination: currentData.data,
    styleOptions: buildStyleOptions(currentData.data),
  };
  sessionStorage.setItem("qr_pending_track", JSON.stringify(payload));
  setShowTrackModal(false);
  await qrAuthClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback?state=/qr-generator` },
  });
}

// Already-signed-in user clicking Download directly — no redirect needed.
async function handleDownloadClick(format: ExportFormat) {
  const { data: { user } } = await qrAuthClient.auth.getUser();
  if (user && currentData.data) {
    const styleOptions = buildStyleOptions(currentData.data);
    await buildAndDownloadTracked(format, contentType, contentType, currentData.data, styleOptions, user.id);
  } else {
    setPendingFormat(format);
    setShowTrackModal(true);
  }
}

// On mount: resume a tracked download that was interrupted by the Google redirect.
useEffect(() => {
  async function resumePendingTrack() {
    const raw = sessionStorage.getItem("qr_pending_track");
    if (!raw) return;
    const { data: { user } } = await qrAuthClient.auth.getUser();
    if (!user) return; // session cookie not ready yet — leave payload, try again on next mount
    sessionStorage.removeItem("qr_pending_track");
    const payload = JSON.parse(raw);
    await buildAndDownloadTracked(
      payload.format,
      payload.qrType,
      payload.label,
      payload.destination,
      payload.styleOptions,
      user.id
    );
    // give the browser's download a beat to kick off, then take them to their dashboard
    setTimeout(() => router.push("/qr-generator/dashboard"), 800);

  }
  resumePendingTrack();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // clear stale bulk results if style changes after generation (avoid showing outdated batch as current)
  const styleKey = JSON.stringify({ size, fgColor, bgColor, useGradient, gradientColor2, dotStyle, cornerSquareStyle, cornerDotStyle, margin, transparentBg, logoDataUrl, logoSize });
  const lastStyleKeyRef = useRef(styleKey);
  const [styleChangedSinceGenerate, setStyleChangedSinceGenerate] = useState(false);
  useEffect(() => {
    if (lastStyleKeyRef.current !== styleKey && bulkResults) {
      setStyleChangedSinceGenerate(true);
    }
    lastStyleKeyRef.current = styleKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKey]);

  return (
    <main className="min-h-[85vh] bg-[#FAF6EE] px-4 py-12 sm:py-16 print:bg-white print:py-0">
      <div className="max-w-5xl mx-auto print:max-w-none">
        <div className="text-center mb-6 print:hidden">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[#2B4570] uppercase mb-3">
            Dinezy · Free Tools
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#211C16]">
            Advanced QR Code Generator
          </h1>
          <p className="mt-3 text-[#6E6557] text-[15px] max-w-lg mx-auto">
            Fully customizable QR codes — colors, shapes, logos, poster
            backgrounds, and bulk generation. Free, unlimited, no watermark.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex justify-center mb-6 print:hidden">
          <div className="inline-flex rounded-full border border-[#D9D2C0] bg-white p-1">
            <button
              onClick={() => setMode("single")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                mode === "single" ? "bg-[#211C16] text-white" : "text-[#6E6557]"
              }`}
            >
              Single QR
            </button>
            <button
              onClick={() => setMode("bulk")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                mode === "bulk" ? "bg-[#211C16] text-white" : "text-[#6E6557]"
              }`}
            >
              Bulk QR
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_380px] gap-6 print:block">
          {/* LEFT: Controls */}
          <div className="bg-white rounded-2xl border border-[#211C16]/10 overflow-hidden print:hidden">
            <div className="flex border-b border-[#211C16]/10">
              {(["content", "style", "logo"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition ${
                    activeTab === tab ? "text-[#211C16] border-b-2 border-[#2B4570]" : "text-[#A8A08D]"
                  }`}
                >
                  {tab === "content" ? "1. Content" : tab === "style" ? "2. Style" : "3. Logo & Background"}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* ===================== CONTENT TAB ===================== */}
              {activeTab === "content" && mode === "single" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {(
                      [
                        ["url", "🔗 Link"],
                        ["whatsapp", "💬 WhatsApp"],
                        ["wifi", "📶 WiFi"],
                        ["upi", "💳 UPI"],
                        ["email", "✉️ Email"],
                        ["phone", "📞 Phone"],
                        ["sms", "📩 SMS"],
                        ["text", "📝 Text"],
                      ] as [QrContentType, string][]
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => {
                          setContentType(val);
                          setFields({});
                          setError("");
                        }}
                        className={`text-xs font-medium py-2 px-1 rounded-lg border transition ${
                          contentType === val
                            ? "bg-[#211C16] text-white border-[#211C16]"
                            : "border-[#D9D2C0] text-[#6E6557] hover:bg-[#FAF6EE]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleGenerate} className="space-y-3">
                    {contentType === "url" && (
                      <Input label="Website / Link URL" placeholder="https://your-link.com" value={fields.url || ""} onChange={(v) => updateField("url", v)} />
                    )}
                    {contentType === "text" && (
                      <TextArea label="Text content" placeholder="Any text you want to encode" value={fields.text || ""} onChange={(v) => updateField("text", v)} />
                    )}
                    {contentType === "whatsapp" && (
                      <>
                        <Input label="Phone number (with country code, no +)" placeholder="919876543210" value={fields.phone || ""} onChange={(v) => updateField("phone", v)} />
                        <TextArea label="Pre-filled message (optional)" placeholder="Hi! I'd like to know more…" value={fields.message || ""} onChange={(v) => updateField("message", v)} />
                      </>
                    )}
                    {contentType === "email" && (
                      <>
                        <Input label="Email address" placeholder="hello@dinezy.in" value={fields.email || ""} onChange={(v) => updateField("email", v)} />
                        <Input label="Subject (optional)" value={fields.subject || ""} onChange={(v) => updateField("subject", v)} />
                        <TextArea label="Body (optional)" value={fields.body || ""} onChange={(v) => updateField("body", v)} />
                      </>
                    )}
                    {contentType === "phone" && (
                      <Input label="Phone number" placeholder="+919876543210" value={fields.phone || ""} onChange={(v) => updateField("phone", v)} />
                    )}
                    {contentType === "sms" && (
                      <>
                        <Input label="Phone number" placeholder="+919876543210" value={fields.phone || ""} onChange={(v) => updateField("phone", v)} />
                        <TextArea label="Message (optional)" value={fields.message || ""} onChange={(v) => updateField("message", v)} />
                      </>
                    )}
                    {contentType === "wifi" && (
                      <>
                        <Input label="Network name (SSID)" value={fields.ssid || ""} onChange={(v) => updateField("ssid", v)} />
                        <Select
                          label="Security"
                          value={fields.security || "WPA"}
                          onChange={(v) => updateField("security", v)}
                          options={[
                            { label: "WPA/WPA2", value: "WPA" },
                            { label: "WEP", value: "WEP" },
                            { label: "No password (open)", value: "nopass" },
                          ]}
                        />
                        {fields.security !== "nopass" && (
                          <Input label="Password" type="password" value={fields.password || ""} onChange={(v) => updateField("password", v)} />
                        )}
                      </>
                    )}
                    {contentType === "upi" && (
                      <>
                        <Input label="UPI ID" placeholder="yourname@okhdfc" value={fields.upiId || ""} onChange={(v) => updateField("upiId", v)} />
                        <Input label="Payee name (optional)" value={fields.payeeName || ""} onChange={(v) => updateField("payeeName", v)} />
                        <Input label="Amount in ₹ (optional)" placeholder="Leave blank to let payer enter amount" value={fields.amount || ""} onChange={(v) => updateField("amount", v)} />
                        <Input label="Note (optional)" value={fields.note || ""} onChange={(v) => updateField("note", v)} />
                      </>
                    )}

                    {error && <p className="text-sm text-[#B3261E]" role="alert">{error}</p>}

                    <button type="submit" className="w-full rounded-lg bg-[#211C16] text-[#FAF6EE] py-3 font-medium hover:bg-[#352D23] transition">
                      Generate QR Code
                    </button>
                  </form>
                </div>
              )}

              {/* ===================== BULK CONTENT TAB ===================== */}
              {activeTab === "content" && mode === "bulk" && (
                <div className="space-y-4">
                  <div className="inline-flex rounded-lg border border-[#D9D2C0] p-1 w-full">
                    <button
                      onClick={() => setBulkSubMode("list")}
                      className={`flex-1 text-xs font-medium py-2 rounded-md transition ${
                        bulkSubMode === "list" ? "bg-[#211C16] text-white" : "text-[#6E6557]"
                      }`}
                    >
                      Paste a List
                    </button>
                    <button
                      onClick={() => setBulkSubMode("sequential")}
                      className={`flex-1 text-xs font-medium py-2 rounded-md transition ${
                        bulkSubMode === "sequential" ? "bg-[#211C16] text-white" : "text-[#6E6557]"
                      }`}
                    >
                      Sequential Range
                    </button>
                  </div>

                  {bulkSubMode === "list" ? (
                    <div>
                      <label className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-1.5 block">
                        One item per line — <code>Label | content</code> or just the content
                      </label>
                      <textarea
                        value={bulkListText}
                        onChange={(e) => setBulkListText(e.target.value)}
                        placeholder={`Table 1 | https://dinezy.in/r/your-restaurant?table=1\nTable 2 | https://dinezy.in/r/your-restaurant?table=2\nhttps://instagram.com/dinezy.in`}
                        rows={8}
                        className="w-full rounded-lg border border-[#D9D2C0] bg-white px-3.5 py-2.5 text-[13px] font-mono text-[#211C16] placeholder:text-[#A8A08D] outline-none focus:border-[#2B4570] focus:ring-1 focus:ring-[#2B4570] transition"
                      />
                      <p className="text-xs text-[#A8A08D] mt-1.5">
                        Works with links, plain text, or any pre-built QR string (WiFi/UPI etc).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[#A8A08D]">
                        Perfect for table QR codes — use <code>{"{n}"}</code> as a placeholder for
                        the number.
                      </p>
                      <Input
                        label="URL template"
                        value={seqTemplate}
                        onChange={setSeqTemplate}
                        placeholder="https://dinezy.in/r/your-restaurant?table={n}"
                      />
                      <Input label="Label template" value={seqLabelTemplate} onChange={setSeqLabelTemplate} placeholder="Table {n}" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Start" type="number" value={String(seqStart)} onChange={(v) => setSeqStart(Number(v) || 1)} />
                        <Input label="End" type="number" value={String(seqEnd)} onChange={(v) => setSeqEnd(Number(v) || 1)} />
                      </div>
                      <Checkbox label="Zero-pad numbers (01, 02…)" checked={seqPad} onChange={setSeqPad} />
                    </div>
                  )}

                  {/* Live count + validation */}
                  <div className="flex items-center justify-between rounded-lg bg-[#FAF6EE] px-3.5 py-2.5 text-sm">
                    <span className="text-[#211C16] font-medium">
                      {bulkItems.length} item{bulkItems.length === 1 ? "" : "s"} ready
                    </span>
                    {bulkItems.length > MAX_BULK_ITEMS && (
                      <span className="text-[#B3261E] text-xs">Max {MAX_BULK_ITEMS} at a time</span>
                    )}
                  </div>

                  {bulkError && <p className="text-sm text-[#B3261E]" role="alert">{bulkError}</p>}

                  <button
                    onClick={handleGenerateBulk}
                    disabled={bulkGenerating || bulkItems.length === 0}
                    className="w-full rounded-lg bg-[#211C16] text-[#FAF6EE] py-3 font-medium hover:bg-[#352D23] transition disabled:opacity-40"
                  >
                    {bulkGenerating
                      ? `Generating ${bulkProgress.done}/${bulkProgress.total}…`
                      : `Generate All (${bulkItems.length})`}
                  </button>

                  {bulkGenerating && (
                    <div className="w-full h-1.5 rounded-full bg-[#FAF6EE] overflow-hidden">
                      <div
                        className="h-full bg-[#2B4570] transition-all duration-150"
                        style={{
                          width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}

                  <p className="text-xs text-[#A8A08D]">
                    Tip: set your colors, shape, and logo in the <strong>Style</strong> and{" "}
                    <strong>Logo</strong> tabs first — they apply to the whole batch.
                  </p>
                </div>
              )}

              {/* ===================== STYLE TAB ===================== */}
              {activeTab === "style" && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-2">Preset Palettes</p>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_PALETTES.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => applyPalette(p.fg, p.bg)}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[#D9D2C0] hover:border-[#211C16] transition"
                          title={p.name}
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: p.fg }} />
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: p.bg }} />
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <ColorInput label="Foreground" value={fgColor} onChange={setFgColor} />
                    <ColorInput label="Background" value={bgColor} onChange={setBgColor} disabled={transparentBg} />
                  </div>

                  <Checkbox label="Transparent background" checked={transparentBg} onChange={setTransparentBg} />
                  <Checkbox label="Gradient foreground" checked={useGradient} onChange={setUseGradient} />
                  {useGradient && <ColorInput label="Gradient 2nd color" value={gradientColor2} onChange={setGradientColor2} />}

                  <Select label="Dot style" value={dotStyle} onChange={(v) => setDotStyle(v as DotType)} options={DOT_STYLES} />
                  <Select label="Corner square style" value={cornerSquareStyle} onChange={(v) => setCornerSquareStyle(v as CornerSquareType)} options={CORNER_SQUARE_STYLES} />
                  <Select label="Corner dot style" value={cornerDotStyle} onChange={(v) => setCornerDotStyle(v as CornerDotType)} options={CORNER_DOT_STYLES} />
                  <Select
                    label="Size"
                    value={String(size)}
                    onChange={(v) => setSize(Number(v))}
                    options={SIZE_PRESETS.map((s) => ({ label: s.label, value: String(s.value) }))}
                  />

                  <div>
                    <label className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-1.5 block">Margin: {margin}px</label>
                    <input type="range" min={0} max={60} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full" />
                  </div>
                </div>
              )}

              {/* ===================== LOGO TAB ===================== */}
              {activeTab === "logo" && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-[#211C16] mb-1">Center Logo</p>
                    <p className="text-xs text-[#A8A08D] mb-2">
                      Embed your logo in the middle of every QR code. Error correction
                      auto-boosts so it still scans reliably.
                    </p>
                    {logoDataUrl && (
                      <img src={logoDataUrl} alt="logo preview" className="w-16 h-16 object-contain rounded-lg border border-[#D9D2C0] mb-2" />
                    )}
                    <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoUpload(file); }} className="text-sm" />
                    {logoDataUrl && (
                      <>
                        <button onClick={() => setLogoDataUrl(null)} className="ml-3 text-xs text-[#B3261E] underline">Remove</button>
                        <div className="mt-3">
                          <label className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-1.5 block">
                            Logo size: {Math.round(logoSize * 100)}%
                          </label>
                          <input type="range" min={15} max={45} value={logoSize * 100} onChange={(e) => setLogoSize(Number(e.target.value) / 100)} className="w-full" />
                        </div>
                      </>
                    )}
                  </div>

                  {mode === "single" && (
                    <div className="pt-4 border-t border-[#211C16]/10">
                      <p className="text-sm font-medium text-[#211C16] mb-1">Poster Background</p>
                      <p className="text-xs text-[#A8A08D] mb-2">
                        Add a full background image (flyer / table tent) — the QR sits
                        on top, composited on download. Single QR only.
                      </p>
                      {posterBg && <img src={posterBg} alt="poster preview" className="w-full h-24 object-cover rounded-lg border border-[#D9D2C0] mb-2" />}
                      <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePosterUpload(file); }} className="text-sm" />
                      {posterBg && <button onClick={() => setPosterBg(null)} className="ml-3 text-xs text-[#B3261E] underline">Remove</button>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live preview / bulk grid */}
          <div className="bg-white rounded-2xl border border-[#211C16]/10 p-5 flex flex-col print:border-none print:p-0">
            {mode === "single" ? (
              <>
                <p className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-3 self-start">Live Preview</p>
                <div
                  className="w-full rounded-xl flex items-center justify-center overflow-hidden"
                  style={{
                    minHeight: 260,
                    background: posterBg
                      ? `url(${posterBg}) center/cover`
                      : transparentBg
                      ? "repeating-conic-gradient(#e5e5e5 0% 25%, #ffffff 0% 50%) 0 0/20px 20px"
                      : "transparent",
                  }}
                >
                  <div ref={previewRef} style={{ transform: `scale(${Math.min(1, 240 / size)})`, transformOrigin: "center" }} />
                </div>
                {!currentData.data && (
                  <p className="text-xs text-[#A8A08D] mt-3 text-center">Fill in the content fields to see a live preview</p>
                )}
                <div className="w-full mt-5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleDownloadClick("png")} className="rounded-lg bg-[#2B4570] text-white py-2.5 text-sm font-medium hover:bg-[#23395C] transition">Download PNG</button>
<button onClick={() => handleDownloadClick("svg")} disabled={!!posterBg} className="rounded-lg border border-[#D9D2C0] text-[#211C16] py-2.5 text-sm font-medium hover:bg-[#FAF6EE] transition disabled:opacity-40">Download SVG</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => handleDownloadClick("jpeg")} className="rounded-lg border border-[#D9D2C0] text-[#211C16] py-2 text-xs font-medium hover:bg-[#FAF6EE] transition">JPEG</button>
                    <button onClick={() => handleDownloadClick("webp")} disabled={!!posterBg} className="rounded-lg border border-[#D9D2C0] text-[#211C16] py-2 text-xs font-medium hover:bg-[#FAF6EE] transition disabled:opacity-40">WEBP</button>
                  </div>
                </div>
                <p className="mt-4 text-center text-[12px] text-[#A8A08D]">No sign-up. No watermark. No limit.</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 print:hidden">
                  <p className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide">
                    Batch Preview {bulkResults ? `(${bulkResults.length})` : ""}
                  </p>
                  {bulkResults && styleChangedSinceGenerate && (
                    <span className="text-[11px] text-[#B3261E]">Style changed — regenerate</span>
                  )}
                </div>

                {!bulkResults && !bulkGenerating && (
                  <div className="flex-1 min-h-[260px] flex items-center justify-center text-center px-4">
                    <p className="text-sm text-[#A8A08D]">
                      Add your list or sequential range in the <strong>Content</strong> tab,
                      then click <strong>Generate All</strong>.
                    </p>
                  </div>
                )}

                {bulkGenerating && (
                  <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-2 border-[#211C16]/20 border-t-[#211C16] rounded-full animate-spin" />
                    <p className="text-sm text-[#6E6557]">
                      Generating {bulkProgress.done} of {bulkProgress.total}…
                    </p>
                  </div>
                )}

                {bulkResults && !bulkGenerating && (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1 print:max-h-none print:overflow-visible print:grid-cols-4">
                      {bulkResults.map((r, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 print:break-inside-avoid">
                          <img src={r.blobUrl} alt={r.label} className="w-full aspect-square object-contain rounded-lg border border-[#211C16]/10" />
                          <span className="text-[11px] text-[#211C16] text-center truncate w-full" title={r.label}>{r.label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2 print:hidden">
                      <button
                        onClick={handleDownloadZip}
                        disabled={zipping}
                        className="w-full rounded-lg bg-[#2B4570] text-white py-2.5 text-sm font-medium hover:bg-[#23395C] transition disabled:opacity-50"
                      >
                        {zipping ? "Zipping…" : `Download All (ZIP)`}
                      </button>
                      <button
                        onClick={handlePrintSheet}
                        className="w-full rounded-lg border border-[#D9D2C0] text-[#211C16] py-2.5 text-sm font-medium hover:bg-[#FAF6EE] transition"
                      >
                        Print Sheet
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          nav, header, footer { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
	  
	 <DownloadTrackModal
  open={showTrackModal}
  onClose={() => setShowTrackModal(false)}
  onSkip={() => { setShowTrackModal(false); handleDownload(pendingFormat); }}
  onTrack={handleSignInAndTrack}
/>

    </main>
  );
}

// ---------- Small form primitives ----------
function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-[#D9D2C0] bg-white px-3.5 py-2.5 text-[14px] text-[#211C16] placeholder:text-[#A8A08D] outline-none focus:border-[#2B4570] focus:ring-1 focus:ring-[#2B4570] transition" />
    </div>
  );
}
function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-1.5 block">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2}
        className="w-full rounded-lg border border-[#D9D2C0] bg-white px-3.5 py-2.5 text-[14px] text-[#211C16] placeholder:text-[#A8A08D] outline-none focus:border-[#2B4570] focus:ring-1 focus:ring-[#2B4570] transition resize-none" />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-1.5 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#D9D2C0] bg-white px-3.5 py-2.5 text-[14px] text-[#211C16] outline-none focus:border-[#2B4570] focus:ring-1 focus:ring-[#2B4570] transition">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function ColorInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#6E6557] uppercase tracking-wide mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-[#D9D2C0] px-2.5 py-1.5">
        <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded cursor-pointer disabled:opacity-40" />
        <input type="text" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="flex-1 text-[13px] text-[#211C16] outline-none disabled:opacity-40" />
      </div>
    </div>
  );
}
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#211C16] cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[#211C16]" />
      {label}
    </label>
  );
}
