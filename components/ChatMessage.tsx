
import React, { useState } from 'react';
import { Message, User } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { geminiService } from '../services/geminiService';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps & { user: User }> = ({ message, user }) => {
  const isAi = message.role === 'assistant';
  const [isPlaying, setIsPlaying] = useState(false);

  const speak = async () => {
    if (isPlaying) {
      geminiService.stopSpeaking();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    try {
      await geminiService.speakText(message.content, () => setIsPlaying(false));
    } catch (e) {
      setIsPlaying(false);
    }
  };

  return (
    <div className={`flex w-full mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500 ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex flex-col max-w-[88%] md:max-w-[75%] ${isAi ? 'items-start' : 'items-end'}`}>
        
        {/* Name Label */}
        <div className={`flex items-center gap-2 mb-2 px-3 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
            {isAi ? 'Aqli Neural Core' : user.name}
          </span>
          <span className="text-[8px] font-bold text-zinc-300 dark:text-zinc-700">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Bubble */}
        <div className={`relative px-6 py-5 rounded-[2rem] shadow-sm transition-all border-none ${
          isAi 
          ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-tl-none' 
          : 'bg-blue-600 text-white rounded-tr-none'
        }`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              {message.attachments.map(at => (
                at.type === 'image' && (
                  <img key={at.id} src={`data:${at.mimeType};base64,${at.data}`} className="w-full max-h-[300px] object-cover rounded-3xl shadow-xl" />
                )
              ))}
            </div>
          )}

          <div className={`text-[15px] leading-relaxed font-semibold ${!isAi ? 'selection:bg-white/30' : ''}`}>
            {message.content ? (
              <MarkdownRenderer content={message.content} />
            ) : (
              <div className="flex gap-1.5 py-3">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
          </div>

          {/* Sources / Grounding Links */}
          {(message as any).sources && (message as any).sources.length > 0 && (
            <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-white/5 flex flex-col gap-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Neural Grounding Sources</p>
              <div className="flex flex-wrap gap-2">
                {(message as any).sources.slice(0, 4).map((s: any, idx: number) => (
                  <a 
                    key={idx} 
                    href={s.uri} 
                    target="_blank" 
                    className="text-[10px] bg-white/10 dark:bg-black/20 px-4 py-2 rounded-full font-bold hover:bg-blue-500 hover:text-white transition-all truncate max-w-[180px] border-none"
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bubble Actions */}
        <div className={`flex items-center gap-5 mt-3 px-3 transition-opacity ${isAi ? 'justify-start' : 'justify-end'}`}>
           <button 
             onClick={() => navigator.clipboard.writeText(message.content)}
             className="text-[9px] font-black text-zinc-400 hover:text-blue-500 uppercase tracking-widest transition-colors"
           >
             Sync Copy
           </button>
           {isAi && (
             <button 
               onClick={speak}
               className={`text-[9px] font-black uppercase tracking-widest transition-all ${isPlaying ? 'text-red-500 animate-pulse' : 'text-zinc-400 hover:text-blue-500'}`}
             >
               {isPlaying ? 'Disconnect Audio' : 'Neural Voice'}
             </button>
           )}
        </div>
      </div>
    </div>
  );
};
