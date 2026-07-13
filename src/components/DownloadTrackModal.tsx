"use client";
import { useState } from "react";
import { qrAuthClient } from "@/lib/qr-auth-client";

interface Props {
  open: boolean;
  onClose: () => void;
  onSkip: () => void; // downloads immediately, no tracking
  onTrack: () => void; // called after successful sign-in, before download
}

export default function DownloadTrackModal({ open, onClose, onSkip, onTrack }: Props) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleGoogleSignIn() {
    setLoading(true);
    sessionStorage.setItem("qr_pending_track", "1");
    await qrAuthClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?state=/qr-generator` },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
        <h3 className="text-lg font-semibold text-[#211C16] mb-2">Track scans on this QR?</h3>
        <p className="text-sm text-[#6E6557] mb-5">
          Sign in to see how many times this code gets scanned. Totally optional.
        </p>
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full rounded-lg bg-[#211C16] text-white py-2.5 text-sm font-medium mb-2 disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Sign in with Google & Track"}
        </button>
        <button
          onClick={onSkip}
          className="w-full rounded-lg border border-[#D9D2C0] text-[#211C16] py-2.5 text-sm font-medium"
        >
          Skip, just download
        </button>
        <button onClick={onClose} className="mt-3 text-xs text-[#A8A08D] underline">
          Cancel
        </button>
      </div>
    </div>
  );
}