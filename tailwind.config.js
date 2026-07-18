/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Geist first (new landing page), falls back to the existing
        // --font-primary chain used by the rest of the app, then system UI.
        sans: ['var(--font-geist-sans)', 'var(--font-primary)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'var(--font-mono)', 'monospace'],
      },
      colors: {
        // ── Existing app palette (dashboard, dark surfaces) — unchanged ──
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        surface: {
          DEFAULT: '#0a0a0a',
          elevated: '#141414',
          overlay: '#1c1c1c',
          border: 'rgba(255,255,255,0.08)',
        },

        // ── New tokens — marketing/landing page only (white theme) ──────
        ink: '#111111',
        'ink-soft': '#666666',
        'ink-faint': '#9a9a9a',
        accent: {
          DEFAULT: '#7A2333',
          dark: '#5C1A26',
          50: '#FBF0F2',
        },
        line: '#ebebeb',
        canvas: '#fafafa', // light section background for the landing page (kept separate from dark `surface.*`)
      },
      animation: {
        // ── Existing app animations — unchanged ──
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s linear infinite',
        'bounce-dot': 'bounceDot 1.2s ease-in-out infinite',

        // ── New — landing page trusted-by marquee ──
        marquee: 'marquee 28s linear infinite',

        // ── New — "Signal Ping" signature motif: a repeating concentric ring,
        // used behind the hero card, on button hover, and as tab indicators.
        'signal-ping': 'signalPing 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        bounceDot: {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.3' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        signalPing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.35' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      maxWidth: {
        content: '1160px',
      },
      borderRadius: {
        '4xl': '2.25rem',
      },
    },
  },
  plugins: [],
}