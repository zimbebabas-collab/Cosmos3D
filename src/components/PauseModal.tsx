import React from 'react';
import { motion } from 'motion/react';
import { Check, Compass, Home, Play, RotateCcw } from 'lucide-react';
import { SCANNABLE_BODIES } from '../data/celestialCatalog';

interface PauseModalProps {
  scannedIds: Set<string>;
  onResume: () => void;
  onReturnEarth: () => void;
  onExitToTitle: () => void;
  onWarpTo: (id: string) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  scannedIds,
  onResume,
  onReturnEarth,
  onExitToTitle,
  onWarpTo,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75"
      role="dialog"
      aria-modal="true"
      aria-label="Пауза и журнал экспедиции"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel rounded-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              Пауза · Журнал экспедиции
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono-tabular">
              Просканировано объектов: {scannedIds.size} из {SCANNABLE_BODIES.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResume}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Продолжить</span>
            </button>
          </div>
        </div>

        {/* Expedition Catalog List */}
        <div className="p-5 overflow-y-auto thin-scroll grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SCANNABLE_BODIES.map((body) => {
            const done = scannedIds.has(body.id);
            return (
              <button
                key={body.id}
                type="button"
                onClick={() => onWarpTo(body.id)}
                className="text-left p-3 rounded-xl bg-slate-900/75 hover:bg-slate-800/90 border border-slate-800/90 transition-colors cursor-pointer flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {body.nameRu}
                    </span>
                    {done && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {body.surfaceHighlightRu}
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-500 mt-1">
                    {body.stats.diameterLabel}
                  </div>
                </div>
                <Compass className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800/80 flex items-center justify-between gap-3 bg-slate-950/50">
          <button
            type="button"
            onClick={onReturnEarth}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Вернуться к Земле</span>
          </button>

          <button
            type="button"
            onClick={onExitToTitle}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Главное меню</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
