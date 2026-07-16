'use client';

import { motion } from 'framer-motion';

// Mirrors CallWaiterBell's own BELL_BOTTOM_OFFSET (108px) plus the bell
// button's own height (~48px) and a visible gap (~16px), so this sits
// stacked directly above the bell rather than beside it.
const DEFAULT_BOTTOM_OFFSET = 108 + 48 + 16; // 172px

interface FloatingGameButtonProps {
  onClick: () => void;
  bottomOffset?: number; // px from screen bottom; override if the gap looks off
}

function DiceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="16" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="8" cy="16" r="1.4" fill="currentColor" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function FloatingGameButton({ onClick, bottomOffset = DEFAULT_BOTTOM_OFFSET }: FloatingGameButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      aria-label="Play a game while you wait"
      style={{
        position: 'fixed',
        right: 16, // matches CallWaiterBell's right offset exactly
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
        // Below CallWaiterBell's backdrop (z-48) and sheet (z-49) on purpose:
        // when the waiter sheet opens, its full-screen backdrop will cover
        // this button instead of it floating awkwardly on top.
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: '50%',
        backgroundColor: '#7A2333',
        color: '#FBF6EC',
        border: '2px dashed rgba(251,246,236,0.5)', // echoes the KOT tear-line motif
        boxShadow: '0 8px 20px rgba(122,35,51,0.3)',
      }}
    >
      <DiceIcon />
    </motion.button>
  );
}