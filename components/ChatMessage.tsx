
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
    <div className={`flex w-full mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex flex-col max-w-[85%] md:max-w-[72%] ${isAi ? 'items-start' : 'items-end'}`}>
        
        {/* Header Label */}
        <div className={`flex items-center gap-3 mb-2 px-3 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
            {isAi ? 'AQLI NEURAL CORE' : user.name}
          </span>
          <span className="text-[9px] font-bold text-zinc-300 dark:text-zinc-700">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Message Bubble */}
        <div className={`relative px-6 py-5 rounded-[2.2rem] shadow-xl transition-all border-none ${
          isAi 
          ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-tl-none' 
          : 'bg-blue-600 text-white rounded-tr-none'
        }`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-4">
              {message.attachments.map(at => (
                at.type === 'image' && (
                  <img key={at.id} src={`data:${at.mimeType};base64,${at.data}`} className="w-full max-h-[400px] object-cover rounded-[1.8rem] shadow-2xl" />
                )
              ))}
            </div>
          )}

          <div className={`text-[15px] leading-relaxed font-semibold ${!isAi ? 'selection:bg-white/30 text-white' : ''}`}>
            {message.content ? (
              <MarkdownRenderer content={message.content} />
            ) : (
              <div className="flex gap-2 py-4">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
          </div>

          {/* Sources / Grounding Display */}
          {(message as any).sources && (message as any).sources.length > 0 && (
            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-white/5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Neural Grounding Sources</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(message as any).sources.slice(0, 5).map((s: any, idx: number) => (
                  <a 
                    key={idx} 
                    href={s.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] bg-zinc-200/50 dark:bg-black/30 px-4 py-2.5 rounded-2xl font-bold hover:bg-blue-600 hover:text-white transition-all truncate max-w-[200px] border-none flex items-center gap-2"
                  >
                    <span className="opacity-40">{idx + 1}</span>
                    <span className="truncate">{s.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bubble Actions */}
        <div className={`flex items-center gap-6 mt-3 px-4 transition-opacity ${isAi ? 'justify-start' : 'justify-end'}`}>
           <button 
             onClick={() => navigator.clipboard.writeText(message.content)}
             className="text-[9px] font-black text-zinc-400 hover:text-blue-500 uppercase tracking-widest transition-colors flex items-center gap-1.5"
           >
             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth="2.5"/></svg>
             Copy
           </button>
           {isAi && (
             <button 
               onClick={speak}
               className={`text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${isPlaying ? 'text-red-500 animate-pulse' : 'text-zinc-400 hover:text-blue-500'}`}
             >
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" strokeWidth="2.5"/></svg>
               {isPlaying ? 'Stop' : 'Neural Voice'}
             </button>
           )}
        </div>
      </div>
    </div>
  );
};
