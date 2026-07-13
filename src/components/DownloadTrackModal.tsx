"use client";
import { haptic } from "@/lib/haptics";

interface Props {
  open: boolean;
  onClose: () => void;
  onSkip: () => void;
  onTrack: () => void;
}

export default function DownloadTrackModal({ open, onClose, onSkip, onTrack }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/40 backdrop-blur-[2px] px-0 sm:px-4"
      style={{ animation: "dtm-backdrop 180ms ease-out" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl px-6 pt-3 pb-8 sm:pb-6 text-center border border-gray-200 shadow-xl"
        style={{ animation: "dtm-sheet 260ms cubic-bezier(.22,1,.36,1)" }}
      >
        {/* drag handle — mobile only */}
        <div className="sm:hidden w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-4" />
        <div className="w-12 h-12 rounded-2xl bg-[#C1443A]/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-xl">📊</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1.5">Track scans on this QR?</h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Sign in to see how many times this code gets scanned. Totally optional.
        </p>
        <button
          onClick={() => { haptic(12); onTrack(); }}
          className="w-full rounded-xl bg-[#C1443A] text-white py-3.5 text-[15px] font-semibold mb-2.5 min-h-[48px] active:scale-[0.97] transition-transform"
        >
          Sign in with Google & Track
        </button>
        <button
          onClick={() => { haptic(6); onSkip(); }}
          className="w-full rounded-xl border border-gray-200 text-gray-900 py-3.5 text-[15px] font-medium min-h-[48px] active:scale-[0.97] transition-transform hover:bg-gray-50"
        >
          Skip, just download
        </button>
        <button
          onClick={() => { haptic(4); onClose(); }}
          className="mt-4 text-xs text-gray-400 underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
      <style jsx global>{`
        @keyframes dtm-backdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dtm-sheet {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 640px) {
          @keyframes dtm-sheet {
            from { transform: translateY(12px) scale(0.97); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}