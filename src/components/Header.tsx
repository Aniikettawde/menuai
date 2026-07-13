"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { qrAuthClient } from "@/lib/qr-auth-client";
import { haptic } from "@/lib/haptics";

const NAV_LINKS = [
  { label: "Home", href: "/qr-generator" },
  { label: "Features", href: "/qr-generator#features" },
  { label: "How It Works", href: "/qr-generator#how-it-works" },
];

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let active = true;
    qrAuthClient.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? null);
    });
    const { data: sub } = qrAuthClient.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignIn() {
    if (signingIn) return;
    haptic();
    setSigningIn(true);
    const redirectTo = window.location.origin + "/auth/callback?state=/qr-generator/dashboard";
    await qrAuthClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo },
    });
  }

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200 print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          <Link href="/qr-generator" className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-semibold tracking-tight text-gray-900">Dinezy</span>
            <span className="hidden sm:inline text-[11px] font-mono uppercase tracking-[0.18em] text-[#C1443A]">
              QR Tools
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {email ? (
              <Link
                href="/qr-generator/dashboard"
                className="hidden sm:inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 active:scale-[0.97] transition-all"
              >
                My Account
              </Link>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={signingIn}
                className="hidden sm:inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {signingIn ? "Redirecting..." : "Sign In"}
              </button>
            )}
            <button
              onClick={() => { haptic(); setMenuOpen((v) => !v); }}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-gray-700 active:scale-95 transition-transform"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="md:hidden border-t border-gray-200 py-3 space-y-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {l.label}
              </a>
            ))}
            {email ? (
              <Link
                href="/qr-generator/dashboard"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 bg-gray-50"
              >
                My Account
              </Link>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); handleSignIn(); }}
                disabled={signingIn}
                className="block w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-50"
              >
                {signingIn ? "Redirecting..." : "Sign In"}
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}