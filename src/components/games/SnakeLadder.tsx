'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PLAYER_COLORS = ['#7A2333', '#2E6B4F', '#B5651D', '#4A5A9E'];
const PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];

// Snakes (head -> tail) and Ladders (bottom -> top)
const SNAKES: Record<number, number> = { 98: 78, 95: 56, 62: 19, 48: 26, 36: 6, 17: 4 };
const LADDERS: Record<number, number> = { 2: 38, 8: 30, 14: 55, 21: 42, 63: 81, 71: 91 };

// Pip layouts for a die face, 0..1 grid within the die
const DIE_PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]],
};

function buildBoard() {
  // grid[row][col] = cell number, row 0 = top of board (square 91-100)
  const grid: number[][] = [];
  const cellOf: Record<number, { row: number; col: number }> = {};
  for (let row = 0; row < 10; row++) {
    const rowCells: number[] = [];
    for (let col = 0; col < 10; col++) {
      const base = (9 - row) * 10;
      const num = row % 2 === 0 ? base + col + 1 : base + (10 - col);
      rowCells.push(num);
      cellOf[num] = { row, col };
    }
    grid.push(rowCells);
  }
  return { grid, cellOf };
}

// Percentage-based center point for a cell, used both for the grid and
// for drawing the overlaid SVG snake/ladder connectors so they always
// line up regardless of rendered size.
function centerOf(cellOf: Record<number, { row: number; col: number }>, num: number) {
  const { row, col } = cellOf[num];
  return { x: col * 10 + 5, y: row * 10 + 5 };
}

export default function SnakeLadder({ playerCount = 2 }: { playerCount?: 2 | 3 | 4 }) {
  const { grid, cellOf } = useMemo(buildBoard, []);
  const [positions, setPositions] = useState<number[]>(Array(playerCount).fill(0));
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState<number>(1);
  const [rolling, setRolling] = useState(false);
  const [hasRolledOnce, setHasRolledOnce] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'snake' | 'ladder' | 'info' } | null>(null);
  const winner = positions.findIndex((p) => p === 100);

  function rollDice() {
    if (rolling || winner >= 0) return;
    setRolling(true);
    setMessage(null);
    let count = 0;
    const spin = setInterval(() => {
      setDice(1 + Math.floor(Math.random() * 6));
      count++;
      if (count > 10) {
        clearInterval(spin);
        const final = 1 + Math.floor(Math.random() * 6);
        setDice(final);
        setHasRolledOnce(true);
        movePlayer(final);
        setRolling(false);
      }
    }, 55);
  }

  function movePlayer(roll: number) {
    setPositions((prev) => {
      const next = [...prev];
      const start = next[turn];
      let target = start + roll;
      if (target > 100) {
        target = start; // must land exactly on 100
        setMessage({ text: `Need exactly ${100 - start} to finish — stayed put`, kind: 'info' });
      } else if (SNAKES[target]) {
        const tail = SNAKES[target];
        setMessage({ text: `Oh no — snake at ${target}! Down to ${tail}`, kind: 'snake' });
        target = tail;
      } else if (LADDERS[target]) {
        const top = LADDERS[target];
        setMessage({ text: `Ladder at ${target} — climbed to ${top}!`, kind: 'ladder' });
        target = top;
      }
      next[turn] = target;
      return next;
    });
    setTurn((t) => (t + 1) % playerCount);
  }

  function reset() {
    setPositions(Array(playerCount).fill(0));
    setTurn(0);
    setDice(1);
    setHasRolledOnce(false);
    setMessage(null);
  }

  // Precompute connector lines once (board layout is static)
  const connectors = useMemo(() => {
    const snakeLines = Object.entries(SNAKES).map(([head, tail]) => ({
      from: centerOf(cellOf, Number(head)),
      to: centerOf(cellOf, tail),
    }));
    const ladderLines = Object.entries(LADDERS).map(([bottom, top]) => ({
      from: centerOf(cellOf, Number(bottom)),
      to: centerOf(cellOf, top),
    }));
    return { snakeLines, ladderLines };
  }, [cellOf]);

  return (
    <div className="flex w-full max-w-[380px] flex-col items-center gap-4 py-3">
      {/* Turn / score strip */}
      <div className="flex w-full flex-wrap justify-center gap-2">
        {positions.map((pos, i) => {
          const isTurn = turn === i && winner < 0;
          return (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all"
              style={{
                backgroundColor: isTurn ? PLAYER_COLORS[i] : '#FBF6EC',
                color: isTurn ? '#FBF6EC' : PLAYER_COLORS[i],
                border: `1.5px solid ${PLAYER_COLORS[i]}`,
                boxShadow: isTurn ? `0 0 0 3px ${PLAYER_COLORS[i]}33` : 'none',
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isTurn ? '#FBF6EC' : PLAYER_COLORS[i] }} />
              {PLAYER_NAMES[i]} · {pos}
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ aspectRatio: '1 / 1', backgroundColor: '#7A2333', padding: '2%' }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-xl" style={{ backgroundColor: '#FBF6EC' }}>
          {/* Grid cells */}
          <div className="grid h-full w-full grid-cols-10 grid-rows-10">
            {grid.flat().map((num) => {
              const special = SNAKES[num] ? 'snake' : LADDERS[num] ? 'ladder' : null;
              return (
                <div
                  key={num}
                  className="relative flex items-start justify-start border"
                  style={{
                    borderColor: 'rgba(122,35,51,0.08)',
                    backgroundColor:
                      special === 'snake' ? '#F5DADD' : special === 'ladder' ? '#DCEEE1' : 'transparent',
                  }}
                >
                  <span
                    className="pointer-events-none select-none pl-[3px] pt-[1px] text-[7px] font-medium leading-none"
                    style={{ color: 'rgba(122,35,51,0.45)' }}
                  >
                    {num}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Snake & ladder connector overlay */}
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            {connectors.ladderLines.map((l, i) => (
              <line
                key={`ladder-${i}`}
                x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
                stroke="#2E6B4F" strokeWidth={1.4} strokeLinecap="round" strokeDasharray="2.5,2"
                opacity={0.85}
              />
            ))}
            {connectors.snakeLines.map((l, i) => (
              <path
                key={`snake-${i}`}
                d={`M ${l.from.x} ${l.from.y} Q ${(l.from.x + l.to.x) / 2 + 8} ${(l.from.y + l.to.y) / 2} ${l.to.x} ${l.to.y}`}
                fill="none" stroke="#B5424E" strokeWidth={1.4} strokeLinecap="round" opacity={0.85}
              />
            ))}
          </svg>

          {/* Endpoint markers */}
          {Object.entries(SNAKES).map(([head]) => {
            const c = centerOf(cellOf, Number(head));
            return (
              <span key={`sh-${head}`} className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px]"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}>🐍</span>
            );
          })}
          {Object.entries(LADDERS).map(([bottom]) => {
            const c = centerOf(cellOf, Number(bottom));
            return (
              <span key={`lb-${bottom}`} className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px]"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}>🪜</span>
            );
          })}

          {/* Tokens */}
          {positions.map((pos, i) => {
            const cellNum = pos === 0 ? null : pos;
            const c = cellNum ? centerOf(cellOf, cellNum) : null;
            // Players at square 0 line up along the bottom-left off-board area
            const start = { x: 3 + i * 4, y: 96 };
            const target = c ?? start;
            const sameCellOffset = pos > 0
              ? positions.slice(0, i).filter((p) => p === pos).length
              : i;
            return (
              <motion.div
                key={i}
                className="absolute flex items-center justify-center rounded-full text-[7px] font-bold text-white shadow-md"
                style={{ width: '7%', height: '7%', backgroundColor: PLAYER_COLORS[i], zIndex: 10 + i }}
                animate={{
                  left: `calc(${target.x}% - ${3.5 + sameCellOffset * 1.5}%)`,
                  top: `calc(${target.y}% - 3.5%)`,
                }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              >
                {i + 1}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Dice + roll control */}
      <div className="flex items-center gap-4">
        <motion.div
          animate={rolling ? { rotate: [0, 90, 180, 270, 360] } : { rotate: 0 }}
          transition={{ duration: 0.5, repeat: rolling ? Infinity : 0, ease: 'linear' }}
          className="relative h-12 w-12 rounded-lg shadow-inner"
          style={{ backgroundColor: '#FBF6EC', border: '2px solid #7A2333' }}
        >
          {DIE_PIPS[dice].map(([x, y], idx) => (
            <span
              key={idx}
              className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, backgroundColor: '#7A2333' }}
            />
          ))}
        </motion.div>

        <button
          onClick={rollDice}
          disabled={rolling || winner >= 0}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: '#7A2333' }}
        >
          {rolling ? 'Rolling…' : winner >= 0 ? 'Game over' : `Roll — ${PLAYER_NAMES[turn]}'s turn`}
        </button>
      </div>

      {/* Status message */}
      <div className="flex h-6 items-center justify-center" aria-live="polite">
        <AnimatePresence mode="wait">
          {winner >= 0 ? (
            <motion.span
              key="winner"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold" style={{ color: '#7A2333' }}
            >
              🏆 {PLAYER_NAMES[winner]} wins!
            </motion.span>
          ) : message ? (
            <motion.span
              key={message.text}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="text-xs font-medium"
              style={{ color: message.kind === 'snake' ? '#B5424E' : message.kind === 'ladder' ? '#2E6B4F' : '#7A2333' }}
            >
              {message.text}
            </motion.span>
          ) : !hasRolledOnce ? (
            <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs" style={{ color: 'rgba(122,35,51,0.6)' }}>
              Roll the dice to start — first to square 100 wins
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px]" style={{ color: 'rgba(122,35,51,0.6)' }}>
        <span className="flex items-center gap-1">🐍 slide down</span>
        <span className="flex items-center gap-1">🪜 climb up</span>
      </div>

      {winner >= 0 && (
        <button
          onClick={reset}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: '#7A2333' }}
        >
          Play again
        </button>
      )}
    </div>
  );
}