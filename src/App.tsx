import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { BODY_BY_ID, type CelestialBodyData } from './data/celestialCatalog';
import { SpaceEngine, type EngineTelemetry, type GameMode } from './engine/SpaceEngine';
import { SpaceAudio } from './engine/audio';
import { MainMenu } from './components/MainMenu';
import { SpaceHud } from './components/SpaceHud';
import { PauseModal } from './components/PauseModal';

const INITIAL_TELEMETRY: EngineTelemetry = {
  focusedId: 'earth',
  focusedNameRu: 'Земля',
  focusedSubtitleRu: 'Обитаемый океанический мир',
  scaleTier: 'orbit',
  altitudeLabel: '13 379 км',
  distanceLabel: '19 750 км',
  detailPercent: 18,
  timeRateLabel: '1× (реал.)',
  timeDilationLabel: null,
  canScan: true,
  isGalacticMode: false,
  warpActive: false,
  markers: [],
  issVisible: true,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SpaceEngine | null>(null);
  const audioRef = useRef<SpaceAudio | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);

  const [mode, setMode] = useState<GameMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'playing' : 'title';
  });
  const modeRef = useRef<GameMode>(mode);

  const [telemetry, setTelemetry] = useState<EngineTelemetry>(INITIAL_TELEMETRY);
  const telemetryRef = useRef<EngineTelemetry>(INITIAL_TELEMETRY);

  const [scannedIds, setScannedIds] = useState<Set<string>>(() => new Set());
  const [activeScanCard, setActiveScanCard] = useState<CelestialBodyData | null>(null);
  const [hudHidden, setHudHidden] = useState(false);
  const [muted, setMuted] = useState(false);
  const [timeRate, setTimeRate] = useState(1);

  // Sync game state to document.body.dataset.state immediately
  useEffect(() => {
    modeRef.current = mode;
    document.body.dataset.state = mode;
    engineRef.current?.setMode(mode);
  }, [mode]);

  // Mount WebGL SpaceEngine ONCE in isolated sibling container (never torn down by HUD updates)
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const audio = new SpaceAudio();
    audioRef.current = audio;

    const engine = new SpaceEngine(
      mount,
      (snap) => {
        telemetryRef.current = snap;
        setTelemetry(snap);
      },
      audio,
    );
    engineRef.current = engine;
    engine.setMode(modeRef.current);

    return () => {
      if (scanTimeoutRef.current !== null) {
        window.clearTimeout(scanTimeoutRef.current);
      }
      engine.dispose();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, []);

  const handleStart = useCallback((destinationId = 'earth') => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    setMode('playing');
    audioRef.current?.unlock();

    if (destinationId && destinationId !== 'earth') {
      engineRef.current?.focusBody(destinationId, 'orbit', true);
    } else {
      engineRef.current?.focusBody('earth', 'orbit', false);
      audioRef.current?.playUiTick();
    }
  }, []);

  const handleScan = useCallback(() => {
    const snap = telemetryRef.current;
    const body = BODY_BY_ID[snap.focusedId];
    if (!body || !body.scannable || !snap.canScan) return;

    setScannedIds((prev) => {
      const next = new Set(prev);
      next.add(body.id);
      return next;
    });
    setActiveScanCard(body);
    audioRef.current?.playScanSuccess();

    if (scanTimeoutRef.current !== null) {
      window.clearTimeout(scanTimeoutRef.current);
    }
    scanTimeoutRef.current = window.setTimeout(() => {
      setActiveScanCard(null);
    }, 7500);
  }, []);

  const handleSelectBody = useCallback((id: string) => {
    setActiveScanCard(null);
    engineRef.current?.focusBody(id, 'orbit', true);
  }, []);

  const handleZoomPreset = useCallback((preset: 'surface' | 'orbit' | 'system' | 'galactic') => {
    engineRef.current?.setZoomPreset(preset);
  }, []);

  const handleTimeRateChange = useCallback((rate: number) => {
    setTimeRate(rate);
    engineRef.current?.setTimeRate(rate);
    audioRef.current?.playUiTick();
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      audioRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleHud = useCallback(() => {
    setHudHidden((prev) => !prev);
  }, []);

  // Global keyboard shortcuts (Title Enter/Space start, Playing E/H/M/Esc/P)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (modeRef.current === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStart('earth');
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setMode((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (modeRef.current !== 'playing') return;

      if (e.code === 'KeyE') {
        e.preventDefault();
        handleScan();
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        handleToggleHud();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleScan, handleStart, handleToggleHud, handleToggleMute]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#02040a]">
      {/* Isolated WebGL Canvas Mount Container (never re-rendered on HUD changes) */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Title Menu Overlay */}
      <AnimatePresence>
        {mode === 'title' && <MainMenu onStart={handleStart} />}
      </AnimatePresence>

      {/* Active Minimalist Space HUD */}
      {mode === 'playing' && (
        <SpaceHud
          telemetry={telemetry}
          scannedIds={scannedIds}
          activeScanCard={activeScanCard}
          hudHidden={hudHidden}
          muted={muted}
          timeRate={timeRate}
          onSelectBody={handleSelectBody}
          onZoomPreset={handleZoomPreset}
          onTimeRateChange={handleTimeRateChange}
          onScan={handleScan}
          onDismissScanCard={() => setActiveScanCard(null)}
          onToggleHud={handleToggleHud}
          onToggleMute={handleToggleMute}
          onOpenPause={() => setMode('paused')}
        />
      )}

      {/* Pause & Expedition Journal Modal */}
      <AnimatePresence>
        {mode === 'paused' && (
          <PauseModal
            scannedIds={scannedIds}
            onResume={() => setMode('playing')}
            onReturnEarth={() => {
              setMode('playing');
              engineRef.current?.focusBody('earth', 'orbit', true);
            }}
            onExitToTitle={() => {
              setActiveScanCard(null);
              setHudHidden(false);
              setMode('title');
              engineRef.current?.focusBody('earth', 'orbit', false);
            }}
            onWarpTo={(id) => {
              setMode('playing');
              engineRef.current?.focusBody(id, 'orbit', true);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
