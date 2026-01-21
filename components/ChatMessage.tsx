
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
      console.error("TTS failed", e);
      setIsPlaying(false);
    }
  };

  return (
    <div className={`group flex flex-col gap-3 md:gap-5 mb-8 md:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <div className="flex items-center gap-3 md:gap-4">
        {isAi ? (
          <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shrink-0">
            <Logo className="w-6 h-6 md:w-8 md:h-8" hideText={true} />
          </div>
        ) : (
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black flex items-center justify-center font-bold text-[10px] md:text-xs shadow-md shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-xl md:rounded-2xl" />
            ) : (
              user.name.charAt(0)
            )}
          </div>
        )}
        <div className="flex flex-col">
          <span className={`text-[12px] md:text-sm font-bold ${isAi ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {isAi ? 'Aqli' : user.name}
          </span>
          <span className="text-[9px] md:text-[10px] text-zinc-400 dark:text-zinc-600 font-medium">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      
      <div className="pl-11 md:pl-14 space-y-4">
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-2">
            {message.attachments.map(at => (
              at.type === 'image' ? (
                <div key={at.id} className="max-w-full md:max-w-xl rounded-2xl md:rounded-[2rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg">
                  <img src={`data:${at.mimeType};base64,${at.data}`} alt={at.name} className="w-full h-auto object-contain" />
                </div>
              ) : (
                <div key={at.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[11px] font-medium text-zinc-500">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth="2"/></svg>
                   {at.name}
                </div>
              )
            ))}
          </div>
        )}

        <div className="text-zinc-900 dark:text-zinc-100 leading-relaxed text-sm md:text-[16px] font-medium max-w-none transition-colors">
          {message.content ? (
            <MarkdownRenderer content={message.content} />
          ) : (
            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-full" />
          )}
        </div>

        <div className="flex items-center gap-4 md:gap-6 pt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
          <button 
            onClick={() => navigator.clipboard.writeText(message.content)} 
            className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-zinc-400 font-bold hover:text-blue-600 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth="2.5"/></svg>
            Copy
          </button>
          {isAi && message.content && (
            <button 
              onClick={speak}
              className={`flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold transition-all ${isPlaying ? 'text-red-500 animate-pulse' : 'text-zinc-400 hover:text-blue-600'}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" strokeWidth="2.5"/></svg>
              {isPlaying ? 'Stop' : 'Listen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
