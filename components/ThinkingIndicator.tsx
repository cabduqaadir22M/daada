
import React from 'react';

interface ThinkingIndicatorProps {
  onCancel?: () => void;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ onCancel }) => (
  <div className="flex items-center gap-5 mb-12 animate-in fade-in duration-700 pl-11 md:pl-14">
    <div className="flex items-center gap-3">
      <div className="flex gap-1 items-center">
        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
      </div>
      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-tight italic uppercase tracking-widest">
        Aqli is thinking...
      </span>
    </div>
    
    {onCancel && (
      <button 
        onClick={onCancel}
        className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-full text-[8px] font-black text-red-500 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
      >
        Jooji
      </button>
    )}
  </div>
);
