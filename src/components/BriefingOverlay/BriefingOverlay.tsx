'use client';

import { motion } from 'framer-motion';

interface BriefingOverlayProps {
  title: string;
  objective: string;
  lines: string[];
  onDismiss: () => void;
}

export function BriefingOverlay({ title, objective, lines, onDismiss }: BriefingOverlayProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onDismiss();
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 flex items-center justify-center bg-black/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
        <div className="max-w-lg space-y-4 rounded-lg bg-mango-900 p-6">
          <h2 className="text-xl font-bold text-mango-500">{title}</h2>
          <div className="space-y-2 text-mango-300">
            {lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
          <p className="text-sm italic text-mango-500/80">Objective: {objective}</p>
          <button onClick={onDismiss} className="rounded bg-mango-500 px-4 py-2 font-semibold text-mango-950">
            Begin
          </button>
        </div>
      </motion.div>
  );
}
