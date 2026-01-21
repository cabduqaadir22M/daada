
import React from 'react';

export const ThinkingIndicator: React.FC = () => (
  <div className="flex items-center gap-3 mb-12 animate-in fade-in duration-700 pl-11 md:pl-14">
    <div className="flex gap-1 items-center">
      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
    </div>
    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-tight italic">
      Aqli is thinking...
    </span>
  </div>
);
