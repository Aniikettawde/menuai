"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabasePublic } from "@/lib/qr-public-client";
import { qrAuthClient } from "@/lib/qr-auth-client";
import DownloadTrackModal from "@/components/DownloadTrackModal";
import { haptic } from "@/lib/haptics";
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
  { name: "Dinezy Ink", fg: "#1C1712", bg: "#ffffff" },
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
  // Tracks which DOM node the live qrInstanceRef is actually appended to, so we
  // can tell a "stale instance, fresh container" situation apart from a normal update.
  const qrContainerElRef = useRef<HTMLElement | null>(null);

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
  const [fgColor, setFgColor] = useState("#1C1712");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [useGradient, setUseGradient] = useState(false);
  const [gradientColor2, setGradientColor2] = useState("#C1443A");
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
  // Fixed: previously, once qrInstanceRef.current existed, the code always called
  // `.update()` on it — even if the preview <div> had been unmounted/remounted
  // (e.g. after switching to Bulk mode and back, or because of a changing `key`
  // prop). That left the QR instance updating a detached, invisible DOM node
  // while the visible container stayed empty. We now track which container the
  // instance is actually attached to and re-append whenever that changes.
  const renderQr = useCallback(async () => {
    if (mode !== "single" || !previewRef.current) return;

    if (!currentData.data) {
      // Nothing to render — clear any stale QR left over from a previous value.
      previewRef.current.innerHTML = "";
      qrInstanceRef.current = null;
      qrContainerElRef.current = null;
      return;
    }

    const QRCodeStyling = await getLib();
    const options = buildStyleOptions(currentData.data);

    const needsFreshInstance =
      !qrInstanceRef.current || qrContainerElRef.current !== previewRef.current;

    if (needsFreshInstance) {
      qrInstanceRef.current = new QRCodeStyling(options);
      previewRef.current.innerHTML = "";
      qrInstanceRef.current.append(previewRef.current);
      qrContainerElRef.current = previewRef.current;
    } else {
      qrInstanceRef.current.update(options);
    }
  }, [mode, currentData.data, buildStyleOptions, getLib]);

  useEffect(() => {
    void renderQr();
  }, [renderQr]);

  // If we navigate away from single mode, the preview node unmounts — drop our
  // refs so the next time we're back in single mode we build a fresh instance
  // against the new node instead of trying to reuse the detached one.
  useEffect(() => {
    if (mode !== "single") {
      qrInstanceRef.current = null;
      qrContainerElRef.current = null;
    }
  }, [mode]);

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
    <section id="generator" className="bg-white px-3 sm:px-4 py-10 sm:py-16 print:py-0 pb-28 md:pb-16 scroll-mt-16">
      <div className="max-w-5xl mx-auto print:max-w-none">
        <div className="text-center mb-5 sm:mb-6 print:hidden">
          <p className="font-mono text-[10px] sm:text-[11px] tracking-[0.2em] text-[#C1443A] uppercase mb-2 sm:mb-3">
            Free Tool
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Build your QR code
          </h2>
          <p className="hidden sm:block mt-3 text-gray-500 text-[15px] max-w-lg mx-auto">
            Fully customizable QR codes — colors, shapes, logos, poster
            backgrounds, and bulk generation. Free, unlimited, no watermark.
          </p>
        </div>

        {/* Mode toggle — full width on mobile */}
        <div className="flex justify-center mb-5 sm:mb-6 print:hidden">
          <div className="grid grid-cols-2 w-full sm:inline-flex sm:w-auto rounded-2xl sm:rounded-full border border-gray-200 bg-white p-1">
            <button
              onClick={() => { haptic(); setMode("single"); }}
              className={`px-5 py-2.5 rounded-xl sm:rounded-full text-sm font-medium transition-all active:scale-95 ${
                mode === "single" ? "bg-gray-900 text-white" : "text-gray-500"
              }`}
            >
              Single QR
            </button>
            <button
              onClick={() => { haptic(); setMode("bulk"); }}
              className={`px-5 py-2.5 rounded-xl sm:rounded-full text-sm font-medium transition-all active:scale-95 ${
                mode === "bulk" ? "bg-gray-900 text-white" : "text-gray-500"
              }`}
            >
              Bulk QR
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_380px] gap-5 sm:gap-6 print:block">
          {/* RIGHT panel shown FIRST on mobile — see instant feedback before configuring */}
          <div className="order-1 md:order-2 bg-white rounded-2xl sm:rounded-2xl border border-gray-200 p-4 sm:p-5 flex flex-col print:border-none print:p-0">
            {mode === "single" ? (
              <>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 self-start">Live Preview</p>
                <div
  className="w-full rounded-xl flex items-center justify-center overflow-hidden relative border border-dashed border-gray-200 bg-gray-50"
  style={{
    height: 220,     // fixed, not minHeight — stops it growing to match `size`
    ...(posterBg
      ? { background: `url(${posterBg}) center/cover`, border: "none" }
      : transparentBg
      ? { background: "repeating-conic-gradient(#e5e5e5 0% 25%, #ffffff 0% 50%) 0 0/20px 20px", border: "none" }
      : {}),
  }}
>
  <div
    ref={previewRef}
    className={currentData.data ? "qr-pop" : ""}
    style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: `translate(-50%, -50%) scale(${Math.min(1, 220 / size)})`,
      transformOrigin: "center",
    }}
  />
</div>
                {!currentData.data && (
                  <p className="text-xs text-gray-500 mt-3 text-center">Fill in the content fields to see a live preview</p>
                )}

                {/* Signature: ticket perforation tear-line */}
                {currentData.data && (
                  <div className="relative my-4 h-3 select-none" aria-hidden="true">
                    <div
                      className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px"
                      style={{
                        backgroundImage: "repeating-linear-gradient(90deg, #E4E4E7 0 6px, transparent 6px 12px)",
                      }}
                    />
                    <div className="absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-gray-100" />
                    <div className="absolute -right-4 sm:-right-5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-gray-100" />
                  </div>
                )}

                {/* Desktop inline download buttons */}
                <div className="hidden md:block w-full mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { haptic(10); handleDownloadClick("png"); }} className="rounded-xl bg-[#C1443A] text-white py-2.5 text-sm font-medium hover:bg-[#A83A31] active:scale-[0.97] transition-all">Download PNG</button>
                    <button onClick={() => { haptic(10); handleDownloadClick("svg"); }} disabled={!!posterBg} className="rounded-xl border border-gray-200 text-gray-900 py-2.5 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all disabled:opacity-40">Download SVG</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { haptic(10); handleDownloadClick("jpeg"); }} className="rounded-xl border border-gray-200 text-gray-900 py-2 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-all">JPEG</button>
                    <button onClick={() => { haptic(10); handleDownloadClick("webp"); }} disabled={!!posterBg} className="rounded-xl border border-gray-200 text-gray-900 py-2 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-all disabled:opacity-40">WEBP</button>
                  </div>
                </div>
                <p className="hidden md:block mt-4 text-center text-[12px] text-gray-500">No sign-up. No watermark. No limit.</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 print:hidden">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Batch Preview {bulkResults ? `(${bulkResults.length})` : ""}
                  </p>
                  {bulkResults && styleChangedSinceGenerate && (
                    <span className="text-[11px] text-[#C1443A]">Style changed — regenerate</span>
                  )}
                </div>

                {!bulkResults && !bulkGenerating && (
                  <div className="flex-1 min-h-[220px] flex items-center justify-center text-center px-4">
                    <p className="text-sm text-gray-500">
                      Add your list or sequential range in the <strong>Content</strong> tab,
                      then tap <strong>Generate All</strong>.
                    </p>
                  </div>
                )}

                {bulkGenerating && (
                  <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-2 border-gray-200 border-t-[#C1443A] rounded-full animate-spin" />
                    <p className="text-sm text-gray-500">
                      Generating {bulkProgress.done} of {bulkProgress.total}…
                    </p>
                  </div>
                )}

                {bulkResults && !bulkGenerating && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1 print:max-h-none print:overflow-visible print:grid-cols-4">
                      {bulkResults.map((r, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 print:break-inside-avoid" style={{ animation: `qr-pop-in 220ms ease-out ${Math.min(i * 15, 300)}ms both` }}>
                          <img src={r.blobUrl} alt={r.label} className="w-full aspect-square object-contain rounded-lg border border-gray-200" />
                          <span className="text-[11px] text-gray-900 text-center truncate w-full" title={r.label}>{r.label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2 print:hidden">
                      <button
                        onClick={() => { haptic(10); handleDownloadZip(); }}
                        disabled={zipping}
                        className="w-full rounded-xl bg-[#C1443A] text-white py-3 text-sm font-medium hover:bg-[#A83A31] active:scale-[0.97] transition-all disabled:opacity-50 min-h-[48px]"
                      >
                        {zipping ? "Zipping…" : `Download All (ZIP)`}
                      </button>
                      <button
                        onClick={() => { haptic(6); handlePrintSheet(); }}
                        className="w-full rounded-xl border border-gray-200 text-gray-900 py-3 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all min-h-[48px]"
                      >
                        Print Sheet
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* LEFT: Controls — shown SECOND on mobile */}
          <div className="order-2 md:order-1 bg-white rounded-2xl border border-gray-200 overflow-hidden print:hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide snap-x">
              {(["content", "style", "logo"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { haptic(); setActiveTab(tab); }}
                  className={`flex-1 min-w-[110px] snap-start py-3.5 text-sm font-medium capitalize transition-all ${
                    activeTab === tab ? "text-gray-900 border-b-2 border-[#C1443A]" : "text-gray-600"
                  }`}
                >
                  {tab === "content" ? "1. Content" : tab === "style" ? "2. Style" : "3. Logo & BG"}
                </button>
              ))}
            </div>

            <div key={activeTab} className="p-4 sm:p-5 tab-fade">
              {/* ===================== CONTENT TAB ===================== */}
              {activeTab === "content" && mode === "single" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
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
                          haptic();
                          setContentType(val);
                          setFields({});
                          setError("");
                        }}
                        className={`text-xs font-medium py-2.5 px-1 rounded-xl border transition-all active:scale-95 min-h-[44px] ${
                          contentType === val
                            ? "bg-gray-900 text-white border-gray-900"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={(e) => { haptic(8); handleGenerate(e); }} className="space-y-3">
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

                    {error && <p className="text-sm text-[#C1443A]" role="alert">{error}</p>}

                    <button type="submit" className="w-full rounded-xl bg-gray-900 text-white py-3.5 font-medium hover:bg-gray-800 active:scale-[0.97] transition-all min-h-[48px]">
                      Generate QR Code
                    </button>
                  </form>
                </div>
              )}

              {/* ===================== BULK CONTENT TAB ===================== */}
              {activeTab === "content" && mode === "bulk" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 rounded-xl border border-gray-200 p-1 w-full">
                    <button
                      onClick={() => { haptic(); setBulkSubMode("list"); }}
                      className={`text-xs font-medium py-2.5 rounded-lg transition-all active:scale-95 ${
                        bulkSubMode === "list" ? "bg-gray-900 text-white" : "text-gray-500"
                      }`}
                    >
                      Paste a List
                    </button>
                    <button
                      onClick={() => { haptic(); setBulkSubMode("sequential"); }}
                      className={`text-xs font-medium py-2.5 rounded-lg transition-all active:scale-95 ${
                        bulkSubMode === "sequential" ? "bg-gray-900 text-white" : "text-gray-500"
                      }`}
                    >
                      Sequential Range
                    </button>
                  </div>

                  {bulkSubMode === "list" ? (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                        One item per line — <code>Label | content</code> or just the content
                      </label>
                      <textarea
                        value={bulkListText}
                        onChange={(e) => setBulkListText(e.target.value)}
                        placeholder={`Table 1 | https://dinezy.in/r/your-restaurant?table=1\nTable 2 | https://dinezy.in/r/your-restaurant?table=2\nhttps://instagram.com/dinezy.in`}
                        rows={8}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] font-mono text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#C1443A] focus:ring-1 focus:ring-[#C1443A] transition"
                      />
                      <p className="text-xs text-gray-500 mt-1.5">
                        Works with links, plain text, or any pre-built QR string (WiFi/UPI etc).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">
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

                  <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm">
                    <span className="text-gray-900 font-medium">
                      {bulkItems.length} item{bulkItems.length === 1 ? "" : "s"} ready
                    </span>
                    {bulkItems.length > MAX_BULK_ITEMS && (
                      <span className="text-[#C1443A] text-xs">Max {MAX_BULK_ITEMS} at a time</span>
                    )}
                  </div>

                  {bulkError && <p className="text-sm text-[#C1443A]" role="alert">{bulkError}</p>}

                  <button
                    onClick={() => { haptic(10); handleGenerateBulk(); }}
                    disabled={bulkGenerating || bulkItems.length === 0}
                    className="w-full rounded-xl bg-gray-900 text-white py-3.5 font-medium hover:bg-gray-800 active:scale-[0.97] transition-all disabled:opacity-40 min-h-[48px]"
                  >
                    {bulkGenerating
                      ? `Generating ${bulkProgress.done}/${bulkProgress.total}…`
                      : `Generate All (${bulkItems.length})`}
                  </button>

                  {bulkGenerating && (
                    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden relative">
                      <div
                        className="h-full bg-[#C1443A] transition-all duration-150 relative overflow-hidden"
                        style={{ width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }}
                      >
                        <div className="absolute inset-0 shimmer" />
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Tip: set your colors, shape, and logo in the <strong>Style</strong> and{" "}
                    <strong>Logo</strong> tabs first — they apply to the whole batch.
                  </p>
                </div>
              )}

              {/* ===================== STYLE TAB ===================== */}
              {activeTab === "style" && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Preset Palettes</p>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_PALETTES.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => { haptic(); applyPalette(p.fg, p.bg); }}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-xl border border-gray-200 hover:border-gray-900 active:scale-95 transition-all"
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
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Margin: {margin}px</label>
                    <input type="range" min={0} max={60} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full accent-[#C1443A]" />
                  </div>
                </div>
              )}

              {/* ===================== LOGO TAB ===================== */}
              {activeTab === "logo" && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Center Logo</p>
                    <p className="text-xs text-gray-500 mb-2">
                      Embed your logo in the middle of every QR code. Error correction
                      auto-boosts so it still scans reliably.
                    </p>
                    {logoDataUrl && (
                      <img src={logoDataUrl} alt="logo preview" className="w-16 h-16 object-contain rounded-xl border border-gray-200 mb-2" />
                    )}
                    <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { haptic(); handleLogoUpload(file); } }} className="text-sm" />
                    {logoDataUrl && (
                      <>
                        <button onClick={() => { haptic(); setLogoDataUrl(null); }} className="ml-3 text-xs text-[#C1443A] underline">Remove</button>
                        <div className="mt-3">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                            Logo size: {Math.round(logoSize * 100)}%
                          </label>
                          <input type="range" min={15} max={45} value={logoSize * 100} onChange={(e) => setLogoSize(Number(e.target.value) / 100)} className="w-full accent-[#C1443A]" />
                        </div>
                      </>
                    )}
                  </div>

                  {mode === "single" && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-900 mb-1">Poster Background</p>
                      <p className="text-xs text-gray-500 mb-2">
                        Add a full background image (flyer / table tent) — the QR sits
                        on top, composited on download. Single QR only.
                      </p>
                      {posterBg && <img src={posterBg} alt="poster preview" className="w-full h-24 object-cover rounded-xl border border-gray-200 mb-2" />}
                      <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { haptic(); handlePosterUpload(file); } }} className="text-sm" />
                      {posterBg && <button onClick={() => { haptic(); setPosterBg(null); }} className="ml-3 text-xs text-[#C1443A] underline">Remove</button>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile download bar — single mode only */}
      {mode === "single" && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] print:hidden">
          <div className="flex gap-2">
            <button
              onClick={() => { haptic(10); handleDownloadClick(pendingFormat); }}
              disabled={!currentData.data}
              className="flex-1 rounded-xl bg-[#C1443A] text-white py-3.5 text-sm font-semibold active:scale-[0.97] transition-all disabled:opacity-40 min-h-[48px]"
            >
              Download {pendingFormat.toUpperCase()}
            </button>
            <select
              value={pendingFormat}
              onChange={(e) => setPendingFormat(e.target.value as ExportFormat)}
              className="rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-900 bg-white min-h-[48px]"
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              {!posterBg && <option value="svg">SVG</option>}
              {!posterBg && <option value="webp">WEBP</option>}
            </select>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          nav, header, footer { display: none !important; }
          body { background: white !important; }
        }
        .qr-pop {
          animation: qr-pop-in 260ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes qr-pop-in {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        .tab-fade {
          animation: tab-fade-in 200ms ease-out;
        }
        @keyframes tab-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .shimmer {
          animation: shimmer 1.1s linear infinite;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <DownloadTrackModal
        open={showTrackModal}
        onClose={() => setShowTrackModal(false)}
        onSkip={() => { setShowTrackModal(false); handleDownload(pendingFormat); }}
        onTrack={handleSignInAndTrack}
      />
    </section>
  );
}

// ---------- Small form primitives ----------
function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#C1443A] focus:ring-1 focus:ring-[#C1443A] transition" />
    </div>
  );
}
function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2}
        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#C1443A] focus:ring-1 focus:ring-[#C1443A] transition resize-none" />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[14px] text-gray-900 outline-none focus:border-[#C1443A] focus:ring-1 focus:ring-[#C1443A] transition">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function ColorInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5">
        <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded cursor-pointer disabled:opacity-40" />
        <input type="text" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="flex-1 text-[13px] text-gray-900 outline-none disabled:opacity-40" />
      </div>
    </div>
  );
}
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-gray-900" />
      {label}
    </label>
  );
}