
import React, { useState } from 'react';
import { Message, User } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { geminiService } from '../services/geminiService';
import { Logo } from './Logo';

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

  // WhatsApp style bubbles: justify-end for user, justify-start for AI
  return (
    <div className={`flex w-full mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isAi ? 'items-start' : 'items-end'}`}>
        
        {/* Identity Label (Optional for compact view) */}
        <div className={`flex items-center gap-2 mb-2 px-2 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
            {isAi ? 'Aqli Core' : user.name}
          </span>
          <span className="text-[8px] font-bold text-zinc-300 dark:text-zinc-700">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Bubble */}
        <div className={`relative px-5 py-4 rounded-[1.8rem] shadow-sm transition-all ${
          isAi 
          ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-tl-none' 
          : 'bg-blue-600 text-white rounded-tr-none'
        }`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map(at => (
                at.type === 'image' && (
                  <img key={at.id} src={`data:${at.mimeType};base64,${at.data}`} className="w-full max-h-64 object-cover rounded-2xl shadow-md" />
                )
              ))}
            </div>
          )}

          <div className={`text-[15px] leading-relaxed font-medium ${!isAi ? 'selection:bg-white/30' : ''}`}>
            {message.content ? (
              <MarkdownRenderer content={message.content} />
            ) : (
              <div className="flex gap-1 py-2">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
          </div>

          {/* Sources / Grounding */}
          {(message as any).sources && (message as any).sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Neural Sources</p>
              <div className="flex flex-wrap gap-2">
                {(message as any).sources.slice(0, 3).map((s: any, idx: number) => (
                  <a 
                    key={idx} 
                    href={s.uri} 
                    target="_blank" 
                    className="text-[10px] bg-white/10 px-3 py-1.5 rounded-full font-bold hover:bg-white/20 transition-all truncate max-w-[150px]"
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons under bubble */}
        <div className={`flex items-center gap-4 mt-2 px-2 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 transition-opacity ${isAi ? 'justify-start' : 'justify-end'}`}>
           <button 
             onClick={() => navigator.clipboard.writeText(message.content)}
             className="text-[9px] font-black text-zinc-400 hover:text-blue-500 uppercase tracking-widest"
           >
             Copy
           </button>
           {isAi && (
             <button 
               onClick={speak}
               className={`text-[9px] font-black uppercase tracking-widest ${isPlaying ? 'text-red-500 animate-pulse' : 'text-zinc-400 hover:text-blue-500'}`}
             >
               {isPlaying ? 'Stop' : 'Listen'}
             </button>
           )}
        </div>
      </div>
    </div>
  );
};
