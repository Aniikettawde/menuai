'use client'
import { Wine, UtensilsCrossed, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/app-store'

export function MenuTypeSelector() {
  const { showMenuTypeSelector, setActiveMenuType, restaurant } = useAppStore()
  if (!showMenuTypeSelector || !restaurant) return null

  return (
    <div className="mts-root">
      <style jsx>{`
        .mts-root {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2.5rem;
          padding: 1.5rem;
          text-align: center;
          background: #0B0B0B;
          overflow: hidden;
        }

        /* Two soft ambient glows — warm orange (food side) and amber (bar side) —
           hint at what's on offer before the cards even load. */
        .mts-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 22% 30%, rgba(255,92,53,0.14), transparent 45%),
            radial-gradient(circle at 78% 70%, rgba(217,162,75,0.14), transparent 45%);
          animation: mts-glow-shift 9s ease-in-out infinite alternate;
        }
        @keyframes mts-glow-shift {
          from { opacity: 0.7; }
          to   { opacity: 1; }
        }

        .mts-head {
          position: relative;
          z-index: 1;
          animation: mts-fadeUp 500ms ease both;
        }
        .mts-logo {
          margin: 0 auto 1rem;
          height: 4.25rem;
          width: 4.25rem;
          border-radius: 1.25rem;
          object-fit: cover;
          box-shadow: 0 8px 28px rgba(0,0,0,0.5);
        }
        .mts-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.6rem;
          font-weight: 600;
          color: #FAFAF7;
          letter-spacing: -0.01em;
        }
        .mts-tagline {
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: rgba(250,250,247,0.5);
        }

        .mts-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          width: 100%;
          max-width: 26rem;
        }

        .mts-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          border-radius: 1.75rem;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          padding: 1.75rem 1rem;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          animation: mts-fadeUp 550ms ease both;
        }
        .mts-card:nth-child(2) { animation-delay: 80ms; }
        .mts-card:active { transform: scale(0.95); }

        .mts-card--food:hover {
          border-color: rgba(255,92,53,0.45);
          background: rgba(255,92,53,0.08);
        }
        .mts-card--bar:hover {
          border-color: rgba(217,162,75,0.45);
          background: rgba(217,162,75,0.08);
        }

        .mts-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 3.5rem;
          width: 3.5rem;
          border-radius: 1.1rem;
        }
        .mts-card--food .mts-card-icon { background: rgba(255,92,53,0.15); color: #FF7A54; }
        .mts-card--bar .mts-card-icon  { background: rgba(217,162,75,0.18); color: #E0AF5E; }

        .mts-card-title {
          font-size: 1rem;
          font-weight: 700;
          color: #FAFAF7;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .mts-card-sub {
          font-size: 0.72rem;
          color: rgba(250,250,247,0.42);
          line-height: 1.4;
        }

        .mts-card-shine {
          position: absolute;
          top: -60%;
          left: -20%;
          width: 60%;
          height: 220%;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,0.06), transparent);
          transform: rotate(12deg);
          pointer-events: none;
        }

        .mts-footnote {
          position: relative;
          z-index: 1;
          max-width: 18rem;
          font-size: 0.72rem;
          color: rgba(250,250,247,0.28);
          display: flex;
          align-items: center;
          gap: 5px;
          justify-content: center;
          animation: mts-fadeUp 600ms ease both;
          animation-delay: 160ms;
        }

        @keyframes mts-fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .mts-glow { animation: none; }
          .mts-card, .mts-head, .mts-footnote { animation: none; }
        }
      `}</style>

      <div className="mts-glow" />

      <div className="mts-head">
        {restaurant.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.logo_url} alt={restaurant.name} className="mts-logo" />
        )}
        <h1 className="mts-name">{restaurant.name}</h1>
        <p className="mts-tagline">What would you like to browse?</p>
      </div>

      <div className="mts-grid">
        <button
          type="button"
          className="mts-card mts-card--food"
          onClick={() => setActiveMenuType('food')}
        >
          <span className="mts-card-shine" />
          <div className="mts-card-icon"><UtensilsCrossed size={26} /></div>
          <span className="mts-card-title">Food Menu</span>
          <span className="mts-card-sub">Dishes, starters &amp; mains</span>
        </button>

        <button
          type="button"
          className="mts-card mts-card--bar"
          onClick={() => setActiveMenuType('bar')}
        >
          <span className="mts-card-shine" />
          <div className="mts-card-icon"><Wine size={26} /></div>
          <span className="mts-card-title">Bar Menu</span>
          <span className="mts-card-sub">Cocktails, spirits &amp; beer</span>
        </button>
      </div>

      <p className="mts-footnote">
        <Sparkles size={11} />
        You can switch between menus anytime from the top of the page.
      </p>
    </div>
  )
}