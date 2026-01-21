
import React from 'react';

export const ThinkingIndicator: React.FC = () => (
  <div className="flex items-start gap-4 sm:gap-6 mb-12 animate-in fade-in duration-500">
    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-lg">
      A
    </div>
    <div className="flex items-center gap-2 h-8 sm:h-10">
      <div className="flex gap-1.5 items-center px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/5">
        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce"></span>
      </div>
      <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 ml-2 animate-pulse">Aqli is preparing an answer...</span>
    </div>
  </div>
);
