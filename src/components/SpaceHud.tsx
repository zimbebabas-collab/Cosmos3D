import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Menu,
  Radar,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  BODY_BY_ID,
  CELESTIAL_CATALOG,
  SCANNABLE_BODIES,
  type CelestialBodyData,
} from '../data/celestialCatalog';
import type { EngineTelemetry } from '../engine/SpaceEngine';

interface SpaceHudProps {
  telemetry: EngineTelemetry;
  scannedIds: Set<string>;
  activeScanCard: CelestialBodyData | null;
  hudHidden: boolean;
  muted: boolean;
  timeRate: number;
  onSelectBody: (id: string) => void;
  onZoomPreset: (preset: 'surface' | 'orbit' | 'system' | 'galactic') => void;
  onTimeRateChange: (rate: number) => void;
  onScan: () => void;
  onDismissScanCard: () => void;
  onToggleHud: () => void;
  onToggleMute: () => void;
  onOpenPause: () => void;
}

const SCALE_LABEL_RU: Record<EngineTelemetry['scaleTier'], string> = {
  surface: 'Поверхность',
  orbit: 'Орбита',
  system: 'Система 1:1',
  galactic: 'Галактика',
};

export const SpaceHud: React.FC<SpaceHudProps> = ({
  telemetry,
  scannedIds,
  activeScanCard,
  hudHidden,
  muted,
  timeRate,
  onSelectBody,
  onZoomPreset,
  onTimeRateChange,
  onScan,
  onDismissScanCard,
  onToggleHud,
  onToggleMute,
  onOpenPause,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const isScanned = scannedIds.has(telemetry.focusedId);
  const focusedBody = BODY_BY_ID[telemetry.focusedId];

  // Cinema / Zen mode: completely clear viewport with one discreet corner toggle
  if (hudHidden) {
    return (
      <div className="fixed inset-0 z-10 pointer-events-none">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Показать интерфейс (H)"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleHud();
          }}
          className="pointer-events-auto fixed top-4 right-4 w-9 h-9 rounded-lg glass-surface-subtle flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const solarItems = CELESTIAL_CATALOG.filter(
    (b) => b.category === 'star' || b.category === 'planet' || b.category === 'moon',
  );
  const deepItems = CELESTIAL_CATALOG.filter(
    (b) => b.category === 'deep_space' || b.category === 'galaxy',
  );

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Projected World-Space Target Markers (distant system / galaxy navigation) */}
      <div className="fixed inset-0 pointer-events-none">
        {telemetry.markers.map((m) => (
          <button
            key={m.id}
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onSelectBody(m.id);
            }}
            style={{
              transform: `translate3d(${m.x}px, ${m.y}px, 0) translate(-50%, -50%)`,
            }}
            className="pointer-events-auto fixed top-0 left-0 group flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-opacity hover:opacity-100 opacity-80 cursor-pointer"
            aria-label={`Перелететь к ${m.nameRu}`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full border shrink-0 transition-transform group-hover:scale-125"
              style={{
                borderColor: m.accentHex,
                backgroundColor: m.isFocused ? m.accentHex : 'rgba(4,6,12,0.75)',
              }}
            />
            <span className="text-[11px] font-medium text-slate-200 group-hover:text-white hud-text-shadow whitespace-nowrap">
              {m.nameRu}
            </span>
            <span className="text-[10px] font-mono-tabular text-slate-400 hud-text-shadow whitespace-nowrap hidden sm:inline">
              {m.distanceLabel}
            </span>
          </button>
        ))}
      </div>

      {/* TOP-LEFT: Compact dark-scrim telemetry readout (crisp even over bright snow/clouds) */}
      <div className="fixed top-4 left-5 flex flex-col gap-1 max-w-[360px] px-3.5 py-2.5 rounded-xl glass-surface-subtle">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-lg font-semibold text-white tracking-tight whitespace-nowrap">
            {telemetry.focusedNameRu}
          </h2>
          <span className="text-xs text-slate-400 whitespace-nowrap truncate">
            {telemetry.focusedSubtitleRu}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-tabular text-slate-200 whitespace-nowrap">
          <span>
            {telemetry.isGalacticMode ? 'Дистанция' : 'Высота'}:{' '}
            <strong className="text-white font-medium">{telemetry.altitudeLabel}</strong>
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-sky-300">{SCALE_LABEL_RU[telemetry.scaleTier]}</span>
          {telemetry.issVisible && (
            <>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-amber-300">МКС 408 км</span>
            </>
          )}
        </div>

        {/* Relativistic Schwarzschild / Kerr Time Dilation readout near Gargantua */}
        {telemetry.timeDilationLabel && (
          <div className="mt-0.5 text-xs font-mono-tabular text-amber-300">
            Время: {telemetry.timeDilationLabel}
          </div>
        )}

        <div className="text-[11px] font-mono-tabular text-slate-400 flex items-center gap-2">
          <span>
            Изучено: {scannedIds.size} / {SCANNABLE_BODIES.length}
          </span>
          {telemetry.scaleTier === 'surface' && focusedBody?.hasRockyTerrain && (
            <>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-emerald-300">
                Рельеф {telemetry.detailPercent}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* TOP-RIGHT: Compact square dark-glass utility buttons */}
      <div className="fixed top-4 right-5 flex items-center gap-2 pointer-events-auto">
        {focusedBody?.scannable && (
          <button
            type="button"
            tabIndex={-1}
            disabled={!telemetry.canScan}
            onClick={(e) => {
              e.currentTarget.blur();
              onScan();
            }}
            aria-label={isScanned ? 'Показать данные сканера (E)' : 'Сканировать объект (E)'}
            className={`h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              !telemetry.canScan
                ? 'glass-surface-subtle text-slate-500 opacity-60 cursor-not-allowed'
                : isScanned
                  ? 'glass-surface-subtle text-emerald-300 hover:text-emerald-200'
                  : 'bg-sky-500/90 hover:bg-sky-400 text-slate-950 font-semibold shadow-[0_4px_20px_rgba(56,189,248,0.28)]'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>{isScanned ? 'Данные [E]' : 'Сканировать [E]'}</span>
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          aria-label={muted ? 'Включить звук (M)' : 'Выключить звук (M)'}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="w-9 h-9 rounded-lg glass-surface-subtle flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Скрыть интерфейс (H)"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleHud();
          }}
          className="w-9 h-9 rounded-lg glass-surface-subtle flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <EyeOff className="w-4 h-4" />
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Открыть паузу и журнал (Esc)"
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenPause();
          }}
          className="w-9 h-9 rounded-lg glass-surface-subtle flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Transient Scan Card (compact bottom-left astrophysical readout, never covers center) */}
      <AnimatePresence>
        {activeScanCard && (
          <motion.aside
            aria-label={`Данные сканирования: ${activeScanCard.nameRu}`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto fixed left-5 bottom-24 w-[320px] max-w-[90vw] glass-panel rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono-tabular text-sky-400">
                  Спектральный анализ завершён
                </div>
                <h3 className="font-display text-base font-semibold text-white mt-0.5">
                  {activeScanCard.nameRu}
                </h3>
              </div>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Закрыть карточку сканера"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onDismissScanCard();
                }}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {activeScanCard.descriptionRu}
            </p>

            <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div>
                <span className="text-slate-500 block">Диаметр</span>
                <span className="font-mono-tabular text-slate-200">
                  {activeScanCard.stats.diameterLabel}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Гравитация</span>
                <span className="font-mono-tabular text-slate-200">
                  {activeScanCard.stats.gravityLabel}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Температура</span>
                <span className="font-mono-tabular text-slate-200">
                  {activeScanCard.stats.temperatureLabel}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Сутки</span>
                <span className="font-mono-tabular text-slate-200">
                  {activeScanCard.stats.dayLengthLabel}
                </span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* BOTTOM-CENTER: Unified Collapsible Minimal Navigation Dock (zero side-panel clutter!) */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center max-w-[96vw] pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            setDockCollapsed((prev) => !prev);
          }}
          aria-expanded={!dockCollapsed}
          aria-label={dockCollapsed ? 'Развернуть панель навигации' : 'Свернуть панель навигации'}
          className="px-3 py-1 rounded-t-lg glass-surface-subtle border-b-0 text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Навигация</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Свернуть</span>
            </>
          )}
        </button>

        <AnimatePresence initial={false}>
          {!dockCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel rounded-xl px-2.5 py-2 flex flex-col gap-1.5 max-w-[96vw]"
            >
              {/* Row 1: Destinations (Solar System + Deep Space Wonders) */}
              <div className="flex items-center gap-1 overflow-x-auto thin-scroll pb-0.5">
                {solarItems.map((b) => {
                  const active = telemetry.focusedId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onSelectBody(b.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      {b.nameRu}
                    </button>
                  );
                })}

                <span
                  className="w-px h-4 bg-slate-700/80 mx-1 shrink-0"
                  aria-hidden="true"
                />

                {deepItems.map((b) => {
                  const active = telemetry.focusedId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onSelectBody(b.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-amber-200/90 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      {b.id === 'gargantua'
                        ? 'Гаргантюа'
                        : b.id === 'quasar'
                          ? 'Квазар'
                          : b.id === 'pulsar'
                            ? 'Пульсар'
                            : 'Галактика'}
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Scale Quick-Presets + Time Simulation Controls */}
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/75 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 mr-1 hidden sm:inline">Масштаб:</span>
                  {(
                    [
                      { id: 'surface', label: 'Поверхность' },
                      { id: 'orbit', label: 'Орбита' },
                      { id: 'system', label: 'Система 1:1' },
                      { id: 'galactic', label: 'Галактика' },
                    ] as const
                  ).map((preset) => {
                    const active = telemetry.scaleTier === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onZoomPreset(preset.id);
                        }}
                        className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-700/90 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-slate-500 mr-1 hidden md:inline">Время:</span>
                  {(
                    [
                      { rate: 0, label: 'Пауза' },
                      { rate: 1, label: '1×' },
                      { rate: 3600, label: '1 ч/с' },
                      { rate: 86400, label: '1 д/с' },
                    ] as const
                  ).map((t) => {
                    const active = timeRate === t.rate;
                    return (
                      <button
                        key={t.rate}
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onTimeRateChange(t.rate);
                        }}
                        className={`px-2 py-1 rounded-md font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-700/90 text-sky-300 font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
