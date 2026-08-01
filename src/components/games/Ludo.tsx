'use client';

import { useState, useRef, useEffect } from 'react';

// ---------- Board geometry (real 15x15 Ludo cross) ----------
// 0-indexed rows/cols 0-14. Colors: 0 Red, 1 Green, 2 Yellow, 3 Blue.

type Cell = [number, number];
type Token = { steps: number };
type Phase = 'roll' | 'move' | 'over';

const RING: Cell[] = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],
  [6,0],
];

const START_INDEX = [0, 13, 26, 39];
const SAFE_INDICES = new Set([0, 13, 26, 39, 8, 21, 34, 47]);

const HOME_STRETCH: Cell[][] = [
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],       // Red -> center from left
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],       // Green -> center from top
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],   // Yellow -> center from right
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],   // Blue -> center from bottom
];

const BASE_SLOTS: Cell[][] = [
  [[1,1],[1,4],[4,1],[4,4]],
  [[1,10],[1,13],[4,10],[4,13]],
  [[10,10],[10,13],[13,10],[13,13]],
  [[10,1],[10,4],[13,1],[13,4]],
];

const BASE_RECT: Cell[] = [
  [0, 0], [0, 9], [9, 9], [9, 0], // top-left corner of each 6x6 base square
];

const PLAYERS = [
  { name: 'Red', color: '#C0392B', light: '#F6D8D4' },
  { name: 'Green', color: '#1E8449', light: '#D3ECDD' },
  { name: 'Yellow', color: '#B7860B', light: '#F3E4B8' },
  { name: 'Blue', color: '#2E5FA3', light: '#D6E2F3' },
];

const TOKENS_PER_PLAYER = 4;
const RING_LEN = 52;
const HOME_LEN = 6;
const FINISH_STEP = RING_LEN - 1 + HOME_LEN; // 57 -> reaching this finishes

const CELL_PCT = 100 / 15; // each of the 15x15 board cells as a % of board width/height

function px([r, c]: Cell) {
  return { x: c * CELL_PCT + CELL_PCT / 2, y: r * CELL_PCT + CELL_PCT / 2 };
}

function initTokens(): Token[][] {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: TOKENS_PER_PLAYER }, () => ({ steps: -1 })) // -1 = in base
  );
}

// steps: -1 base, 0..50 on ring (relative to own start), 51..56 home stretch, 57 finished
function coordsFor(player: number, steps: number): { cell: Cell; ringIdx?: number } | null {
  if (steps < 0) return null;
  if (steps <= RING_LEN - 2) {
    const ringIdx = (START_INDEX[player] + steps) % RING_LEN;
    return { cell: RING[ringIdx], ringIdx };
  }
  if (steps < FINISH_STEP) {
    return { cell: HOME_STRETCH[player][steps - (RING_LEN - 1)] };
  }
  return { cell: [7, 7] };
}

export default function Ludo({
  playerCount = 4,
  onGameEnd,
}: {
  playerCount?: number;
  onGameEnd?: (result: string) => void;
}) {
  const [tokens, setTokens] = useState<Token[][]>(initTokens);
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [phase, setPhase] = useState<Phase>('roll');
  const [message, setMessage] = useState(`${PLAYERS[0].name}'s turn — roll the dice`);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = Array.from({ length: playerCount }, (_, i) => i);
  const winner = tokens.findIndex((pt, i) => active.includes(i) && pt.every((t) => t.steps === FINISH_STEP));

  useEffect(() => {
    if (winner >= 0) onGameEnd?.(`${PLAYERS[winner].name.toLowerCase()}_win`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);
  function legalMoves(playerTokens: Token[], dieValue: number): boolean[] {
    return playerTokens.map((t) => {
      if (t.steps === -1) return dieValue === 6;
      if (t.steps === FINISH_STEP) return false;
      return t.steps + dieValue <= FINISH_STEP;
    });
  }

  function nextPlayer(from: number): number {
    let p = from;
    do {
      p = (p + 1) % playerCount;
    } while (!active.includes(p));
    return p;
  }

  function rollDice() {
    if (rolling || phase !== 'roll' || winner >= 0) return;
    setRolling(true);
    setLastCapture(null);
    let count = 0;
    rollTimer.current = setInterval(() => {
      setDice(1 + Math.floor(Math.random() * 6));
      count++;
      if (count > 9) {
        if (rollTimer.current) clearInterval(rollTimer.current);
        const final = 1 + Math.floor(Math.random() * 6);
        setDice(final);
        setRolling(false);
        const moves = legalMoves(tokens[turn], final);
        if (moves.some(Boolean)) {
          setPhase('move');
          setMessage(
            final === 6
              ? `Rolled a 6 — move a token, or bring one out of base`
              : `Rolled a ${final} — choose a token to move`
          );
        } else {
          setMessage(`Rolled a ${final} — no legal moves, turn passes`);
          setTimeout(() => {
            setDice(null);
            setPhase('roll');
            const np = nextPlayer(turn);
            setTurn(np);
            setMessage(`${PLAYERS[np].name}'s turn — roll the dice`);
          }, 1100);
        }
      }
    }, 60);
  }

  function moveToken(tokenIdx: number) {
    if (phase !== 'move' || dice === null) return;
    const myTokens = tokens[turn];
    const token = myTokens[tokenIdx];
    const moves = legalMoves(myTokens, dice);
    if (!moves[tokenIdx]) return;

    const newSteps = token.steps === -1 ? 0 : token.steps + dice;
    let captured: string | null = null;

    setTokens((prev) => {
      const next = prev.map((pt) => pt.map((t) => ({ ...t })));
      next[turn][tokenIdx].steps = newSteps;

      if (newSteps <= RING_LEN - 2) {
        const ringIdx = (START_INDEX[turn] + newSteps) % RING_LEN;
        if (!SAFE_INDICES.has(ringIdx)) {
          for (let p = 0; p < playerCount; p++) {
            if (p === turn) continue;
            next[p].forEach((t) => {
              if (t.steps >= 0 && t.steps <= RING_LEN - 2) {
                const otherRingIdx = (START_INDEX[p] + t.steps) % RING_LEN;
                if (otherRingIdx === ringIdx) {
                  t.steps = -1;
                  captured = PLAYERS[p].name;
                }
              }
            });
          }
        }
      }
      return next;
    });

    const justFinished = newSteps === FINISH_STEP;
    const rolledSix = dice === 6;
    setDice(null);

    if (captured) setLastCapture(captured);

    const willWin = tokens[turn].every((t, i) =>
      i === tokenIdx ? newSteps === FINISH_STEP : t.steps === FINISH_STEP
    );

    if (willWin) {
      setPhase('over');
      setMessage(`${PLAYERS[turn].name} wins! 🎉`);
      return;
    }

    if (captured) {
      setMessage(`${PLAYERS[turn].name} captured ${captured}'s token! ${rolledSix ? 'Roll again' : ''}`.trim());
    } else if (justFinished) {
      setMessage(`${PLAYERS[turn].name} got a token home! ${rolledSix ? 'Roll again' : ''}`.trim());
    }

    if (rolledSix) {
      setPhase('roll');
      if (!captured && !justFinished) setMessage(`${PLAYERS[turn].name} rolled a 6 — roll again`);
    } else {
      const np = nextPlayer(turn);
      setTurn(np);
      setPhase('roll');
      if (!captured && !justFinished) setMessage(`${PLAYERS[np].name}'s turn — roll the dice`);
    }
  }

  function reset() {
    if (rollTimer.current) clearInterval(rollTimer.current);
    setTokens(initTokens());
    setTurn(0);
    setDice(null);
    setRolling(false);
    setPhase('roll');
    setLastCapture(null);
    setMessage(`${PLAYERS[0].name}'s turn — roll the dice`);
  }

  const moves = phase === 'move' && dice !== null ? legalMoves(tokens[turn], dice) : [];
  const anyMovable = moves.some(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 16, width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box', fontFamily: 'ui-sans-serif, system-ui, sans-serif', background: '#FBF8F2', borderRadius: 20 }}>
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 3px rgba(0,0,0,0.15), 0 0 12px 4px rgba(255,214,0,0.55); }
          50% { box-shadow: 0 0 0 5px rgba(0,0,0,0.05), 0 0 20px 8px rgba(255,214,0,0.85); }
        }
        .ludo-token-movable { animation: pulseGlow 1.1s ease-in-out infinite; cursor: pointer; }
        .ludo-token-movable:hover { transform: scale(1.15); }
      `}</style>

      {/* Turn strip */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {active.map((i) => {
          const isTurn = turn === i && winner < 0;
          const inBase = tokens[i].filter((t) => t.steps === -1).length;
          const home = tokens[i].filter((t) => t.steps === FINISH_STEP).length;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '6px 12px',
                borderRadius: 12,
                background: isTurn ? PLAYERS[i].color : '#fff',
                color: isTurn ? '#fff' : PLAYERS[i].color,
                border: `2px solid ${PLAYERS[i].color}`,
                minWidth: 78,
                boxShadow: isTurn ? '0 2px 10px rgba(0,0,0,0.18)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13 }}>{PLAYERS[i].name}</span>
              <span style={{ fontSize: 10, opacity: 0.85 }}>{home}/4 home · {inBase} in base</span>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#EFE8D8', borderRadius: 12, boxShadow: 'inset 0 0 0 2px #D8CDB0' }}>
        {/* Base squares */}
        {BASE_RECT.map(([r, c], i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${c * CELL_PCT}%`,
              top: `${r * CELL_PCT}%`,
              width: `${6 * CELL_PCT}%`,
              height: `${6 * CELL_PCT}%`,
              background: PLAYERS[i].color,
              borderRadius: 14,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ position: 'absolute', inset: '11%', background: '#fff', borderRadius: 10 }} />
          </div>
        ))}

        {/* Center home rosette */}
        <div
          style={{
            position: 'absolute',
            left: `${6 * CELL_PCT}%`,
            top: `${6 * CELL_PCT}%`,
            width: `${3 * CELL_PCT}%`,
            height: `${3 * CELL_PCT}%`,
            overflow: 'hidden',
            borderRadius: 4,
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 3 3" preserveAspectRatio="none">
            <polygon points="0,0 1.5,1.5 3,0" fill={PLAYERS[1].color} />
            <polygon points="3,0 1.5,1.5 3,3" fill={PLAYERS[2].color} />
            <polygon points="3,3 1.5,1.5 0,3" fill={PLAYERS[3].color} />
            <polygon points="0,3 1.5,1.5 0,0" fill={PLAYERS[0].color} />
          </svg>
        </div>

        {/* Ring cells */}
        {RING.map((cell, idx) => {
          const { x, y } = px(cell);
          const isSafe = SAFE_INDICES.has(idx);
          const startColor = START_INDEX.includes(idx) ? PLAYERS[START_INDEX.indexOf(idx)].color : null;
          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: `${x - CELL_PCT / 2}%`,
                top: `${y - CELL_PCT / 2}%`,
                width: `${CELL_PCT}%`,
                height: `${CELL_PCT}%`,
                boxSizing: 'border-box',
                background: startColor ? startColor + '33' : isSafe ? '#FCE9B0' : '#FBF8F2',
                border: '1px solid #D8CDB0',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.2vmin',
                color: '#B08900',
              }}
            >
              {isSafe ? '★' : ''}
            </div>
          );
        })}

        {/* Home stretch cells */}
        {HOME_STRETCH.map((stretch, p) =>
          stretch.map((cell, i) => {
            const { x, y } = px(cell);
            return (
              <div
                key={`${p}-${i}`}
                style={{
                  position: 'absolute',
                  left: `${x - CELL_PCT / 2}%`,
                  top: `${y - CELL_PCT / 2}%`,
                  width: `${CELL_PCT}%`,
                  height: `${CELL_PCT}%`,
                  boxSizing: 'border-box',
                  background: PLAYERS[p].light,
                  border: `1px solid ${PLAYERS[p].color}55`,
                  borderRadius: 4,
                }}
              />
            );
          })
        )}

        {/* Base slots (empty placeholders) */}
        {BASE_SLOTS.map((slots, p) =>
          slots.map((cell, i) => {
            const { x, y } = px(cell);
            const d = CELL_PCT * 0.78;
            return (
              <div
                key={`slot-${p}-${i}`}
                style={{
                  position: 'absolute',
                  left: `${x - d / 2}%`,
                  top: `${y - d / 2}%`,
                  width: `${d}%`,
                  height: `${d}%`,
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  border: `2px dashed ${PLAYERS[p].color}66`,
                }}
              />
            );
          })
        )}

        {/* Tokens */}
        {tokens.map((playerTokens, p) =>
          playerTokens.map((t, ti) => {
            let coord: Cell;
            if (t.steps === -1) coord = BASE_SLOTS[p][ti];
            else coord = coordsFor(p, t.steps)!.cell;
            const { x, y } = px(coord);
            const movable = phase === 'move' && p === turn && moves[ti] && winner < 0;
            const d = CELL_PCT * 0.68;
            return (
              <div
                key={`${p}-${ti}`}
                onClick={() => movable && moveToken(ti)}
                className={movable ? 'ludo-token-movable' : ''}
                style={{
                  position: 'absolute',
                  left: `${x - d / 2}%`,
                  top: `${y - d / 2}%`,
                  width: `${d}%`,
                  height: `${d}%`,
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  background: PLAYERS[p].color,
                  border: '2px solid #fff',
                  boxShadow: movable ? undefined : '0 1px 3px rgba(0,0,0,0.35)',
                  opacity: phase === 'move' && p === turn && !moves[ti] ? 0.35 : 1,
                  transition: 'left 0.35s ease, top 0.35s ease, opacity 0.2s',
                  zIndex: movable ? 5 : 2,
                }}
              />
            );
          })
        )}
      </div>

      {/* Dice + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: '#2B2B2B',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {dice ?? '–'}
        </div>
        {phase !== 'over' && (
          <button
            onClick={rollDice}
            disabled={rolling || phase === 'move'}
            style={{
              padding: '10px 22px',
              borderRadius: 999,
              border: 'none',
              background: PLAYERS[turn].color,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: rolling || phase === 'move' ? 'default' : 'pointer',
              opacity: rolling || phase === 'move' ? 0.5 : 1,
            }}
          >
            {rolling ? 'Rolling…' : `Roll for ${PLAYERS[turn].name}`}
          </button>
        )}
        {phase === 'over' && (
          <button
            onClick={reset}
            style={{ padding: '10px 22px', borderRadius: 999, border: 'none', background: '#2B2B2B', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Play again
          </button>
        )}
      </div>

      {/* Message / instructions */}
      <div style={{ minHeight: 20, textAlign: 'center', fontSize: 14, fontWeight: 600, color: PLAYERS[turn].color, maxWidth: 360 }}>
        {message}
      </div>
      <div style={{ fontSize: 11.5, color: '#8A8071', textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
        Roll a 6 to bring a token out of base. Glowing tokens can be moved — tap one. Landing on an
        opponent (off the gold ★ safe cells) sends it back to base. Get all 4 tokens to the center to win.
      </div>
    </div>
  );
}