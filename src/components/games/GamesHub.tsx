'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TicTacToe from './TicTacToe';
import SnakeLadder from './SnakeLadder';
import Ludo from './Ludo';
import { track } from '@/lib/analytics';

type GameKey = 'ttt' | 'snake' | 'ludo' | null;

const GAMES: { key: Exclude<GameKey, null>; label: string; blurb: string; players: string }[] = [
  { key: 'ttt', label: 'Tic-Tac-Toe', blurb: 'Quick 2-player round', players: '2 players' },
  { key: 'snake', label: 'Snake & Ladder', blurb: 'Race to square 100', players: '2–4 players' },
  { key: 'ludo', label: 'Ludo', blurb: 'Classic table favourite', players: '2–4 players' },
];

// Drop this component anywhere in the customer-facing menu/ordering flow,
// e.g. as a tab in /r/[slug]/page.tsx or a modal triggered from a
// "Play while you wait" button near the order-status banner.
// restaurantId is required for analytics tracking (game_started/game_ended).
export default function GamesHub({ restaurantId }: { restaurantId: string }) {
  const [active, setActive] = useState<GameKey>(null);
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const sessionStartedAt = useRef<number | null>(null);

  function openGame(key: Exclude<GameKey, null>) {
    setActive(key);
    sessionStartedAt.current = Date.now();
    track(restaurantId, 'game_started', {
      metadata: { game: key, player_count: key === 'ttt' ? 2 : playerCount },
    });
  }

  function endGameSession(result?: string) {
    if (!active || sessionStartedAt.current === null) return;
    const duration_seconds = Math.round((Date.now() - sessionStartedAt.current) / 1000);
    track(restaurantId, 'game_ended', {
      metadata: { game: active, duration_seconds, result: result ?? 'exited' },
    });
    sessionStartedAt.current = null;
  }

  function backToMenu() {
    endGameSession('exited');
    setActive(null);
  }

  return (
    <div
      className="mx-auto w-full max-w-sm rounded-2xl p-4"
      style={{ backgroundColor: '#FBF6EC', border: '1px solid #7A2333' }}
    >
      <AnimatePresence mode="wait">
        {!active ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: '#7A2333' }}>
                Play while you wait
              </h3>
              <span className="text-[10px] uppercase tracking-wide opacity-50" style={{ color: '#7A2333' }}>
                on the house
              </span>
            </div>

            {GAMES.map((g) => (
              <button
                key={g.key}
                onClick={() => openGame(g.key)}
                className="relative flex items-center justify-between rounded-xl px-4 py-3 text-left transition-transform active:scale-[0.98]"
                style={{
                  backgroundColor: '#7A2333',
                  color: '#FBF6EC',
                  // KOT ticket tear-line motif on the right edge
                  borderRight: '2px dashed rgba(251,246,236,0.4)',
                }}
              >
                <span>
                  <span className="block text-sm font-semibold">{g.label}</span>
                  <span className="block text-xs opacity-70">{g.blurb}</span>
                </span>
                <span className="text-[10px] opacity-70">{g.players}</span>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={backToMenu}
                className="text-sm font-semibold"
                style={{ color: '#7A2333' }}
              >
                ← Back to games
              </button>
              {active !== 'ttt' && (
                <select
                  value={playerCount}
                  onChange={(e) => setPlayerCount(Number(e.target.value) as 2 | 3 | 4)}
                  className="rounded-md border px-2 py-1 text-xs"
                  style={{ borderColor: '#7A2333', color: '#7A2333' }}
                >
                  <option value={2}>2 players</option>
                  <option value={3}>3 players</option>
                  <option value={4}>4 players</option>
                </select>
              )}
            </div>

            {active === 'ttt' && <TicTacToe onGameEnd={(result) => endGameSession(result)} />}
            {active === 'snake' && (
              <SnakeLadder key={playerCount} playerCount={playerCount} onGameEnd={(result) => endGameSession(result)} />
            )}
            {active === 'ludo' && (
              <Ludo key={playerCount} playerCount={playerCount} onGameEnd={(result) => endGameSession(result)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}