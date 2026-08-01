'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Cell = 'X' | 'O' | null;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function getWinner(board: Cell[]): { winner: Cell; line: number[] | null } {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

export default function TicTacToe({ onGameEnd }: { onGameEnd?: (result: string) => void }) {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [scores, setScores] = useState({ X: 0, O: 0 });

  const { winner, line } = getWinner(board);
  const isDraw = !winner && board.every((c) => c !== null);

  function play(i: number) {
    if (board[i] || winner) return;
    const next = [...board];
    next[i] = turn;
    setBoard(next);
     const result = getWinner(next);
    if (result.winner) {
      setScores((s) => ({ ...s, [result.winner as 'X' | 'O']: s[result.winner as 'X' | 'O'] + 1 }));
      onGameEnd?.(`${result.winner}_win`);
    } else if (next.every((c) => c !== null)) {
      onGameEnd?.('draw');
    }
    setTurn(turn === 'X' ? 'O' : 'X');
  }

  function reset() {
    setBoard(Array(9).fill(null));
    setTurn('X');
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex items-center gap-6 text-sm font-medium" style={{ color: '#7A2333' }}>
        <span className={turn === 'X' && !winner && !isDraw ? 'opacity-100' : 'opacity-40'}>
          Player X · {scores.X}
        </span>
        <span className="text-xs opacity-30">vs</span>
        <span className={turn === 'O' && !winner && !isDraw ? 'opacity-100' : 'opacity-40'}>
          Player O · {scores.O}
        </span>
      </div>

      <div
        className="grid grid-cols-3 gap-2 rounded-2xl p-3"
        style={{ backgroundColor: '#7A2333' }}
      >
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => play(i)}
            disabled={!!cell || !!winner}
            className="flex h-20 w-20 items-center justify-center rounded-xl text-4xl font-bold transition-transform active:scale-95"
            style={{
              backgroundColor: line?.includes(i) ? '#F2C1A0' : '#FBF6EC',
              color: cell === 'X' ? '#7A2333' : '#B5651D',
            }}
          >
            <AnimatePresence>
              {cell && (
                <motion.span
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  {cell}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>

      <div className="h-6 text-sm font-medium" style={{ color: '#7A2333' }}>
        {winner && `Player ${winner} wins this round!`}
        {isDraw && 'Draw — one more?'}
      </div>

      <button
        onClick={reset}
        className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#7A2333' }}
      >
        New round
      </button>
    </div>
  );
}