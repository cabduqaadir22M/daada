
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
    <div className={`flex w-full mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500 ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex flex-col max-w-[88%] md:max-w-[75%] ${isAi ? 'items-start' : 'items-end'}`}>
        
        {/* Simple & Clean Header */}
        <div className={`flex items-center gap-2.5 mb-2 px-4 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className={`text-[10px] font-black uppercase tracking-widest ${isAi ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'}`}>
            {isAi ? 'Aqli' : user.name}
          </span>
          <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-800 rounded-full" />
          <span className="text-[9px] font-bold text-zinc-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Intelligence-First Bubble */}
        <div className={`relative px-6 py-5 rounded-[2.2rem] shadow-2xl transition-all border-none ${
          isAi 
          ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-tl-none' 
          : 'bg-zinc-900 dark:bg-white text-white dark:text-black rounded-tr-none'
        }`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-4">
              {message.attachments.map(at => (
                at.type === 'image' && (
                  <img key={at.id} src={`data:${at.mimeType};base64,${at.data}`} className="w-full max-h-[350px] object-cover rounded-2xl shadow-xl" />
                )
              ))}
            </div>
          )}

          <div className="text-[15px] leading-relaxed font-semibold text-inherit">
            {message.content ? (
              <MarkdownRenderer content={message.content} />
            ) : (
              <div className="flex gap-2 py-3">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
          </div>

          {/* Web Grounding Sources */}
          {(message as any).sources && (message as any).sources.length > 0 && (
            <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-white/5 flex flex-col gap-3">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3"/></svg>
                Xaqiijinta Macluumaadka
              </p>
              <div className="flex flex-wrap gap-2">
                {(message as any).sources.map((s: any, idx: number) => (
                  <a 
                    key={idx} 
                    href={s.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[9px] bg-white dark:bg-black/50 px-3 py-2 rounded-xl font-bold hover:text-blue-500 transition-all border border-zinc-100 dark:border-white/5 shadow-sm truncate max-w-[150px]"
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className={`flex items-center gap-5 mt-2.5 px-4 opacity-0 hover:opacity-100 transition-opacity ${isAi ? 'justify-start' : 'justify-end'}`}>
           <button 
             onClick={() => navigator.clipboard.writeText(message.content)}
             className="text-[8px] font-black text-zinc-400 hover:text-blue-500 uppercase tracking-widest"
           >
             Copy
           </button>
           {isAi && (
             <button 
               onClick={speak}
               className={`text-[8px] font-black uppercase tracking-widest ${isPlaying ? 'text-red-500 animate-pulse' : 'text-zinc-400 hover:text-blue-500'}`}
             >
               {isPlaying ? 'Stop' : 'Voice'}
             </button>
           )}
        </div>
      </div>
    </div>
  );
};
