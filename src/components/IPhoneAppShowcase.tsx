import React from 'react';
import { Smartphone, Sparkles, Wifi, Battery, Signal, Layers } from 'lucide-react';

export interface AppShowcaseItem {
  id: string;
  title: string;
  authorOrCreator?: string;
  categoryOrType?: string;
  imageUrl?: string;
  link?: string;
  description?: string;
}

interface IPhoneAppShowcaseProps {
  currentAppId: string;
  apps: AppShowcaseItem[];
  onSelectApp: (app: AppShowcaseItem) => void;
  resolvedImages?: Record<string, string>;
  className?: string;
}

export const IPhoneAppShowcase: React.FC<IPhoneAppShowcaseProps> = ({
  currentAppId,
  apps,
  onSelectApp,
  resolvedImages = {},
  className = '',
}) => {
  // If there are no other apps in the list, include at least the current one
  const displayApps = apps.length > 0 ? apps : [];

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Helper label above phone */}
      <div className="mb-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[9px] uppercase tracking-widest font-black">
        <Sparkles size={11} />
        <span>Trykk på en app for å utforske</span>
      </div>

      {/* iPhone Outer Chassis */}
      <div className="relative w-[240px] sm:w-[260px] md:w-[275px] h-[480px] sm:h-[510px] md:h-[530px] rounded-[48px] p-2.5 bg-gradient-to-b from-[#2e2e34] via-[#1a1a1d] to-[#101012] border-2 border-neutral-700/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.2)]">
        {/* Hardware Buttons on outer rim */}
        {/* Volume Up */}
        <div className="absolute -left-[3px] top-24 w-[3px] h-9 bg-neutral-700 rounded-l-xs" />
        {/* Volume Down */}
        <div className="absolute -left-[3px] top-36 w-[3px] h-9 bg-neutral-700 rounded-l-xs" />
        {/* Power Button */}
        <div className="absolute -right-[3px] top-28 w-[3px] h-14 bg-neutral-700 rounded-r-xs" />

        {/* OLED Screen Area */}
        <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-gradient-to-b from-[#0a0f1d] via-[#111827] to-[#030712] text-white flex flex-col justify-between p-3.5 border border-black/80">
          {/* Wallpaper Ambient Glow */}
          <div className="absolute top-10 -left-10 w-44 h-44 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-12 -right-10 w-44 h-44 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status Bar with Dynamic Island */}
          <div className="relative z-20 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-sans font-bold px-1 text-white/90">
              <span>9:41</span>
              {/* Dynamic Island Pill */}
              <div className="w-20 sm:w-22 h-5 bg-black rounded-full flex items-center justify-between px-2 text-[8px] text-white/40 border border-white/10 shadow-inner">
                <div className="w-2 h-2 rounded-full bg-blue-950 border border-blue-400/40" />
                <span className="text-[7px] text-white/40 font-mono">Apps</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex items-center gap-1.5 text-white/80">
                <Signal size={10} />
                <Wifi size={10} />
                <Battery size={11} className="text-white" />
              </div>
            </div>

            {/* iOS Date / Lockup */}
            <div className="text-center pt-1.5 pb-1">
              <p className="text-[8px] uppercase tracking-widest text-white/40 font-black">
                Anbefalte Apper
              </p>
              <h4 className="text-[12px] font-serif font-bold text-white/90">
                K.F. Solheim Collection
              </h4>
            </div>
          </div>

          {/* Home Screen App Grid */}
          <div className="relative z-10 flex-1 overflow-y-auto no-scrollbar py-2 px-1">
            <div className="grid grid-cols-3 gap-x-2 gap-y-3.5 justify-items-center">
              {displayApps.map((app) => {
                const isSelected = app.id === currentAppId;
                const imgSrc = resolvedImages[app.id] || app.imageUrl;

                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onSelectApp(app)}
                    className="group flex flex-col items-center text-center cursor-pointer focus:outline-none transition-transform active:scale-95"
                    title={app.title}
                  >
                    {/* App Icon */}
                    <div
                      className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-[22%] overflow-hidden bg-neutral-900 border transition-all duration-300 shadow-md ${
                        isSelected
                          ? 'ring-[2.5px] ring-accent ring-offset-2 ring-offset-black scale-110 shadow-[0_0_18px_rgba(227,28,40,0.85)] border-white/40'
                          : 'border-white/15 opacity-85 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={app.title}
                          className="w-full h-full object-cover rounded-[22%]"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-accent">
                          <Smartphone size={20} />
                        </div>
                      )}

                      {/* Gloss Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/15 pointer-events-none rounded-[22%]" />

                      {/* Active Indicator Badge */}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-accent text-white rounded-full flex items-center justify-center shadow-md border border-black">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        </div>
                      )}
                    </div>

                    {/* App Label */}
                    <span
                      className={`mt-1 text-[8px] font-sans line-clamp-1 max-w-[58px] leading-tight transition-colors drop-shadow ${
                        isSelected
                          ? 'font-bold text-accent'
                          : 'text-white/80 group-hover:text-white'
                      }`}
                    >
                      {app.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Dock */}
          <div className="relative z-20 space-y-1.5 pt-1">
            <div className="p-1.5 bg-white/10 backdrop-blur-xl rounded-[24px] border border-white/10 flex items-center justify-around shadow-lg">
              <span className="text-[7.5px] uppercase tracking-wider font-mono text-white/50 px-2 py-0.5">
                Valgt: <strong className="text-white font-bold">{apps.find(a => a.id === currentAppId)?.title || 'App'}</strong>
              </span>
            </div>

            {/* iOS Home Indicator Bar */}
            <div className="w-24 h-1 bg-white/60 rounded-full mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
};
