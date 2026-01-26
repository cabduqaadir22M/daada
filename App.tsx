
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { AuthView } from './components/AuthView';
import { ThinkingIndicator } from './components/ThinkingIndicator';
import { ImageGenerator } from './components/ImageGenerator';
import { AdminConsole } from './components/AdminConsole';
import { Message, ChatSession, User, ViewType, Attachment } from './types';
import { geminiService } from './services/geminiService';
import { storage } from './services/storage';
import { Logo } from './components/Logo';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => storage.getActiveUser());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentRenderSession, setCurrentRenderSession] = useState<ChatSession | null>(null);
  const [view, setView] = useState<ViewType>('chat');
  const [input, setInput] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    const stored = await storage.getSessions(user.id, false);
    setSessions(stored);
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Sync currentRenderSession with sessions list
  useEffect(() => {
    if (activeSessionId) {
      const found = sessions.find(s => s.id === activeSessionId);
      if (found) setCurrentRenderSession(found);
    } else {
      setCurrentRenderSession(null);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentRenderSession?.messages, isLoading, view]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && attachments.length === 0) || isLoading || !user) return;

    let currentSId = activeSessionId;
    let session = currentRenderSession;

    // Create session if it doesn't exist
    if (!currentSId || !session) {
      currentSId = `session_${Date.now()}`;
      session = {
        id: currentSId,
        userId: user.id,
        title: trimmedInput.slice(0, 40) || 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setActiveSessionId(currentSId);
    }

    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: trimmedInput || "Attached visual context",
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    const assistantId = `msg_ai_${Date.now()}`;
    const assistantMsg: Message = { 
      id: assistantId, 
      role: 'assistant', 
      content: '', 
      timestamp: Date.now() + 1 
    };
    
    // 1. Add messages to local state immediately to avoid disappearing UI
    const updatedMessages = [...session.messages, userMsg, assistantMsg];
    const updatedSession = { ...session, messages: updatedMessages, updatedAt: Date.now() };

    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== currentSId);
      return [updatedSession, ...filtered];
    });

    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const historyForAPI = [...session.messages, userMsg];
      const stream = geminiService.streamChat(historyForAPI, user.name);
      let fullContent = '';

      for await (const update of stream) {
        fullContent += update.text || '';
        
        // Update session in list as chunks arrive
        setSessions(prev => prev.map(s => {
          if (s.id !== currentSId) return s;
          return {
            ...s,
            messages: s.messages.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
          };
        }));
      }

      // Final save to storage
      const finalSession = { 
        ...session, 
        messages: [...session.messages, userMsg, { ...assistantMsg, content: fullContent }],
        updatedAt: Date.now()
      };
      await storage.saveSession(finalSession);
    } catch (e: any) {
      console.error("Neural processing failed:", e);
      setSessions(prev => prev.map(s => {
        if (s.id !== currentSId) return s;
        return {
          ...s,
          messages: s.messages.map(m => m.id === assistantId ? { ...m, content: "System interruption. Please check your link and try again." } : m)
        };
      }));
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <AuthView onAuthSuccess={(u) => setUser(u)} />;

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors selection:bg-blue-500/30">
      <Sidebar 
        user={user} isRealUser={true} onUpdateUser={() => {}} sessions={sessions} activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId} onNewChat={() => { setActiveSessionId(null); setCurrentRenderSession(null); setView('chat'); }}
        view={view} setView={setView} isOpen={isSidebarOpen} onToggle={() => setSidebarOpen(!isSidebarOpen)}
        onDeleteSession={async (id) => { await storage.deleteSession(id); setSessions(prev => prev.filter(s => s.id !== id)); if(activeSessionId === id) setActiveSessionId(null); }}
        onLogOut={() => { storage.setActiveUser(null); setUser(null); }} 
        isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />
      
      <main className="flex-1 flex flex-col relative w-full h-full min-w-0 border-none">
        <header className="h-16 md:h-20 flex items-center justify-between px-6 md:px-10 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-10 shrink-0 border-none">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2.5"/></svg>
            </button>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em]">Neural Core</span>
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Active Link</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {view !== 'chat' && (
               <button onClick={() => setView('chat')} className="text-[10px] font-black text-zinc-500 hover:text-black dark:hover:text-white transition-all bg-zinc-100 dark:bg-zinc-900 px-5 py-2 rounded-full uppercase tracking-widest">
                 Threads
               </button>
             )}
             <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-xs font-black overflow-hidden shadow-2xl">
               {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0)}
             </div>
          </div>
        </header>

        <div className="flex-1 w-full overflow-hidden flex flex-col relative border-none">
          {view === 'image-gen' ? (
            <ImageGenerator user={user} />
          ) : view === 'admin' ? (
            <AdminConsole />
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto pt-6 pb-40 md:pb-52 w-full border-none">
                <div className="max-w-4xl mx-auto px-6 md:px-10 w-full border-none">
                  {!currentRenderSession || currentRenderSession.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-24 md:mt-40 text-center animate-in fade-in duration-1000 w-full">
                      <Logo className="w-32 h-32 md:w-48 md:h-48 mb-10" />
                      <h1 className="text-3xl md:text-5xl font-black mb-6 tracking-tighter text-zinc-900 dark:text-white px-4 leading-tight">
                        How can I assist you?
                      </h1>
                      <div className="flex gap-4 opacity-30">
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">Reasoning</span>
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">Vision</span>
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">Synthesis</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-12 md:space-y-16 w-full pb-10 border-none">
                      {currentRenderSession.messages.map(m => <ChatMessage key={m.id} message={m} user={user} />)}
                      {isLoading && <ThinkingIndicator />}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-6 md:p-12 bg-gradient-to-t from-white dark:from-black via-white/95 dark:via-black/95 to-transparent z-20 border-none">
                <div className="max-w-4xl mx-auto relative w-full border-none">
                  <div className="bg-zinc-50 dark:bg-zinc-900/90 rounded-[2.5rem] p-3 md:p-4 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all shadow-2xl backdrop-blur-2xl border-none">
                    <div className="flex items-center gap-3 md:gap-4 border-none">
                      <button onClick={() => fileInputRef.current?.click()} className="p-4 text-zinc-400 hover:text-blue-500 transition-all hover:scale-110 active:scale-95 border-none">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => {
                        const files = Array.from(e.target.files || []) as File[];
                        files.forEach(file => {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const base64 = (ev.target?.result as string).split(',')[1];
                            setAttachments(prev => [...prev, { id: Date.now().toString(), type: file.type.startsWith('image/') ? 'image' : 'file', mimeType: file.type, data: base64, name: file.name }]);
                          };
                          reader.readAsDataURL(file);
                        });
                      }} />
                      <textarea 
                        value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); handleSend(); } }}
                        placeholder="Neural prompt..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-lg py-4 outline-none resize-none max-h-48 dark:text-white placeholder-zinc-400 font-bold"
                        rows={1}
                      />
                      <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)} className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl disabled:opacity-20 hover:scale-105 active:scale-95 transition-all shadow-2xl border-none">
                        <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
