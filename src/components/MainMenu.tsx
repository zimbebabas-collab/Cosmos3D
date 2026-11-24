import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react';
import { ArrowRight, Compass, Globe, Orbit, Sparkles } from 'lucide-react';

interface MainMenuProps {
  onStart: (destinationId?: string) => void;
}

type MenuTab = 'overview' | 'objects' | 'controls';

export const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  const [activeTab, setActiveTab] = useState<MenuTab>('overview');

  // Interactive 3D perspective tilt driven by cursor over the dark glass card
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5.5, -5.5]), {
    stiffness: 180,
    damping: 22,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6.5, 6.5]), {
    stiffness: 180,
    damping: 22,
  });

  const handleCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(nx);
    mouseY.set(ny);
  };

  const handleCardLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none"
      style={{
        background:
          'linear-gradient(95deg, rgba(4,6,12,0.86) 0%, rgba(4,6,12,0.48) 38%, rgba(4,6,12,0.06) 72%, rgba(4,6,12,0.18) 100%)',
      }}
    >
      {/* Main asymmetric landscape layout: left dark-glass IT card, right 65% open to live 3D Earth */}
      <div className="flex-1 flex items-center">
        <div style={{ perspective: '1200px' }} className="w-full max-w-[440px] pointer-events-auto">
          <motion.section
            aria-label="Главное меню ASTRUM"
            onMouseMove={handleCardMove}
            onMouseLeave={handleCardLeave}
            style={{
              rotateX,
              rotateY,
              transformStyle: 'preserve-3d',
            }}
            initial={{ opacity: 0, x: -32, rotateY: 8 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            exit={{ opacity: 0, x: -40, rotateY: -10, scale: 0.96 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel rounded-2xl p-6 md:p-7 flex flex-col gap-5"
          >
            {/* Custom inline SVG orbital emblem + Display Title */}
            <div className="flex items-center gap-4">
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <rect
                  x="1"
                  y="1"
                  width="42"
                  height="42"
                  rx="11"
                  fill="rgba(14, 23, 38, 0.9)"
                  stroke="rgba(56, 189, 248, 0.32)"
                  strokeWidth="1.2"
                />
                <ellipse
                  cx="22"
                  cy="22"
                  rx="15"
                  ry="6.5"
                  transform="rotate(-28 22 22)"
                  stroke="#38bdf8"
                  strokeWidth="1.4"
                  strokeOpacity="0.85"
                />
                <circle cx="22" cy="22" r="5.5" fill="#e0f2fe" />
                <circle cx="33.5" cy="15.5" r="2.1" fill="#fbbf24" />
              </svg>
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-white leading-none">
                  ASTRUM
                </h1>
                <p className="mt-1.5 text-xs text-slate-400 tracking-wide">
                  Космический симулятор · Масштаб 1:1
                </p>
              </div>
            </div>

            {/* Interactive Tab Switcher */}
            <div
              role="tablist"
              aria-label="Разделы описания"
              className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950/75 border border-slate-800/80"
            >
              {(
                [
                  { id: 'overview', label: 'Обзор' },
                  { id: 'objects', label: 'Объекты' },
                  { id: 'controls', label: 'Управление' },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="menuTabIndicator"
                        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                        className="absolute inset-0 rounded-lg bg-slate-800/90 border border-slate-700/70 -z-10"
                      />
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* 3D Animated Tab Content */}
            <div className="min-h-[156px] relative overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10, rotateX: -8 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    exit={{ opacity: 0, y: -10, rotateX: 8 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-3 text-sm text-slate-300 leading-relaxed"
                  >
                    <p>
                      Исследуйте Солнечную систему в подлинных астрономических пропорциях: от
                      низкого пролёта в километрах над горами и ночными мегаполисами Земли до
                      спиральных рукавов Млечного Пути.
                    </p>
                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-3">
                      <div>
                        <div className="font-mono-tabular text-base font-semibold text-white">
                          1:1
                        </div>
                        <div className="text-[11px] text-slate-400">Реальные масштабы</div>
                      </div>
                      <div>
                        <div className="font-mono-tabular text-base font-semibold text-white">
                          13
                        </div>
                        <div className="text-[11px] text-slate-400">Миров и аномалий</div>
                      </div>
                      <div>
                        <div className="font-mono-tabular text-base font-semibold text-white">
                          10⁵ св.л.
                        </div>
                        <div className="text-[11px] text-slate-400">Зум до Галактики</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'objects' && (
                  <motion.div
                    key="objects"
                    initial={{ opacity: 0, y: 10, rotateX: -8 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    exit={{ opacity: 0, y: -10, rotateX: 8 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-2.5 text-xs text-slate-300"
                  >
                    <div className="flex items-start gap-2.5">
                      <Globe className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-100 font-medium">Земля, Марс, Луна и планеты:</span>{' '}
                        процедурный рельеф, каньоны, кратеры, кольца Сатурна с тенью, МКС на орбите и ночные огни городов.
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Orbit className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-100 font-medium">Гаргантюа (Sgr A*):</span>{' '}
                        гравитационное линзирование аккреционного диска, фотонное кольцо и релятивистское замедление времени.
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-100 font-medium">Квазар 3C 273 и Пульсар:</span>{' '}
                        двойные релятивистские джеты, вращающиеся радиолучи и полный 3D Млечный Путь.
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'controls' && (
                  <motion.div
                    key="controls"
                    initial={{ opacity: 0, y: 10, rotateX: -8 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    exit={{ opacity: 0, y: -10, rotateX: 8 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/70">
                      <span className="text-slate-400">Вращение камеры</span>
                      <span className="font-mono-tabular text-slate-100">ЛКМ</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/70">
                      <span className="text-slate-400">Плавный зум</span>
                      <span className="font-mono-tabular text-slate-100">Колесо</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/70">
                      <span className="text-slate-400">Полёт / Орбита</span>
                      <span className="font-mono-tabular text-slate-100">WASD + Shift</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/70">
                      <span className="text-slate-400">Сканер объекта</span>
                      <span className="font-mono-tabular text-slate-100">E</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/70">
                      <span className="text-slate-400">Скрыть HUD</span>
                      <span className="font-mono-tabular text-slate-100">H</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/70">
                      <span className="text-slate-400">Пауза / Журнал</span>
                      <span className="font-mono-tabular text-slate-100">Esc</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Primary CTA Button (data-start="true" per game shell contract) */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={() => onStart('earth')}
                className="w-full py-3.5 px-5 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_8px_30px_rgba(56,189,248,0.28)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 whitespace-nowrap"
              >
                <span>Выйти в космос</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Quick Jump Destinations */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onStart('gargantua')}
                  className="py-2 px-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-amber-200/95 transition-colors cursor-pointer whitespace-nowrap truncate"
                >
                  Гаргантюа
                </button>
                <button
                  type="button"
                  onClick={() => onStart('quasar')}
                  className="py-2 px-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-sky-200/95 transition-colors cursor-pointer whitespace-nowrap truncate"
                >
                  Квазар 3C 273
                </button>
                <button
                  type="button"
                  onClick={() => onStart('galaxy')}
                  className="py-2 px-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap truncate"
                >
                  Млечный Путь
                </button>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Clean single-line borderless control hint at bottom safe margin */}
      <div className="flex items-center justify-between text-xs text-slate-400/90 hud-text-shadow">
        <span className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-sky-400/80" />
          Enter / Пробел — старт · ЛКМ вращение · Колесо зум до поверхности и галактики
        </span>
        <span className="hidden md:inline font-mono-tabular text-slate-400/75">
          Земля · 149,6 млн км от Солнца
        </span>
      </div>
    </motion.div>
  );
};
