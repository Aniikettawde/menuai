'use client';

import { AnimatePresence, motion } from 'framer-motion';
import GamesHub from './GamesHub';

interface GamesModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
}

// Full-screen overlay wrapper around GamesHub, matching the app's
// existing modal treatment (see RatingModal / rating-modal-dark).
export function GamesModal({ open, onClose, restaurantId }: GamesModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(33,30,27,0.45)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm"
          >
            <div className="relative">
              <button
                onClick={onClose}
                aria-label="Close games"
                className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-md"
                style={{ backgroundColor: '#7A2333', color: '#FBF6EC' }}
              >
                ✕
              </button>
             <GamesHub restaurantId={restaurantId} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}