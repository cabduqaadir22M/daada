
import React from 'react';

export const Logo: React.FC<{ className?: string, hideText?: boolean, onLogoTextClick?: () => void }> = ({ className = "w-24 h-24", hideText = false, onLogoTextClick }) => {
  
  const handleLogoClick = () => {
    const scrollTarget = document.querySelector('.overflow-y-auto');
    if (scrollTarget) {
      scrollTarget.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {}
  };

  return (
    <div 
      className="flex flex-col items-center justify-center group select-none"
    >
      <div 
        className={`relative ${className} transition-all duration-500 group-hover:scale-105 group-active:scale-95 cursor-pointer`}
        onClick={handleLogoClick}
      >
        {/* Subtle deep shadow for "unique" presence */}
        <div className="absolute inset-0 rounded-full bg-zinc-900/5 dark:bg-white/5 blur-2xl group-hover:blur-3xl transition-all duration-700" />
        
        <svg viewBox="0 0 400 400" className="w-full h-full relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* A unique, sharp 'D' silhouette in deep black / pure white */}
          <path 
            d="M120 60 
               L 120 340 
               L 200 340 
               C 300 340, 360 280, 360 200 
               C 360 120, 300 60, 200 60 
               L 120 60 
               Z" 
            fill="currentColor" 
            className="text-zinc-950 dark:text-white"
          />
          
          {/* Internal architectural cut-out for uniqueness */}
          <path 
            d="M165 105 
               L 165 295 
               L 190 295 
               C 260 295, 300 250, 300 200 
               C 300 150, 260 105, 190 105 
               L 165 105 
               Z" 
            fill="currentColor" 
            className="text-white dark:text-zinc-950"
          />

          {/* Minimalist focus point */}
          <rect x="120" y="195" width="45" height="10" fill="currentColor" className="text-white dark:text-zinc-950" />
        </svg>
      </div>

      {!hideText && (
        <div className="mt-6 flex flex-col items-center">
          <span 
            onClick={onLogoTextClick}
            className="text-zinc-900 dark:text-white font-sans font-extrabold tracking-[0.5em] text-4xl sm:text-5xl transition-all duration-500 group-hover:tracking-[0.6em] cursor-pointer hover:opacity-80"
          >
            DAADIR
          </span>
          <div className="flex items-center gap-4 mt-3 opacity-40">
             <div className="h-[1px] w-6 bg-zinc-400" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">Intelligence</span>
             <div className="h-[1px] w-6 bg-zinc-400" />
          </div>
        </div>
      )}
    </div>
  );
};
