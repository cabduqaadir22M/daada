
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

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages.length, isLoading, view]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && attachments.length === 0) || isLoading || !user) return;

    let sId = activeSessionId;
    let session = activeSession;

    if (!sId || !session) {
      sId = `session_${Date.now()}`;
      session = {
        id: sId,
        userId: user.id,
        title: trimmedInput.slice(0, 30) || 'Neural Thread',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setActiveSessionId(sId);
      setSessions(prev => [session!, ...prev]);
    }

    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: trimmedInput || "Establishing sync...",
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    const assistantId = `msg_ai_${Date.now()}`;
    const assistantPlaceholder: Message = { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() + 1 };
    
    // UI Update (Optimistic)
    setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, userMsg, assistantPlaceholder], updatedAt: Date.now() } : s));
    
    const previousInput = input;
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const historyForAPI = [...session.messages, userMsg];
      const stream = geminiService.streamChat(historyForAPI);
      let fullContent = '';
      let finalSources: any[] = [];

      for await (const update of stream) {
        fullContent += (update as any).text || '';
        if ((update as any).sources) finalSources = (update as any).sources;

        setSessions(prev => prev.map(s => {
          if (s.id !== sId) return s;
          return {
            ...s,
            messages: s.messages.map(m => m.id === assistantId ? { ...m, content: fullContent, sources: finalSources } as any : m)
          };
        }));
      }

      const finalSession = { 
        ...session, 
        messages: [...session.messages, userMsg, { ...assistantPlaceholder, content: fullContent, sources: finalSources } as any],
        updatedAt: Date.now()
      };
      await storage.saveSession(finalSession);
    } catch (e: any) {
      console.error("Neural Signal Fault:", e);
      
      // CRITICAL: We DO NOT save this error state to storage. 
      // We only update the local state to inform the user.
      setSessions(prev => prev.map(s => s.id === sId ? { 
        ...s, 
        messages: s.messages.map(m => m.id === assistantId ? { 
          ...m, 
          content: "Neural Connection Stabilized. The previous link was too weak. Please resend your message now - Aqli is ready." 
        } : m) 
      } : s));
      
      // Optional: Restore input so user doesn't have to retype
      if (!input) setInput(previousInput);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <AuthView onAuthSuccess={(u) => setUser(u)} />;

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors selection:bg-blue-500/30">
      <Sidebar 
        user={user} isRealUser={true} onUpdateUser={() => {}} sessions={sessions} activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId} onNewChat={() => { setActiveSessionId(null); setView('chat'); }}
        view={view} setView={setView} isOpen={isSidebarOpen} onToggle={() => setSidebarOpen(!isSidebarOpen)}
        onDeleteSession={async (id) => { await storage.deleteSession(id); setSessions(prev => prev.filter(s => s.id !== id)); if(activeSessionId === id) setActiveSessionId(null); }}
        onLogOut={() => { storage.setActiveUser(null); setUser(null); }} 
        isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />
      
      <main className="flex-1 flex flex-col relative w-full h-full min-w-0 border-none">
        <header className="h-16 md:h-20 flex items-center justify-between px-6 md:px-10 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-10 shrink-0 border-none">
          <div className="flex items-center gap-4 border-none">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors border-none">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2.5"/></svg>
            </button>
            <div className="flex flex-col border-none">
              <span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em]">DAADIR NEURAL CORE</span>
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">v10.0.0 &bull; Grounded 2026</span>
            </div>
          </div>
          <div className="flex items-center gap-4 border-none">
             {view !== 'chat' && (
               <button onClick={() => setView('chat')} className="text-[10px] font-black text-zinc-500 hover:text-black dark:hover:text-white transition-all bg-zinc-100 dark:bg-zinc-900 px-6 py-2 rounded-full uppercase tracking-widest border-none">
                 BACK TO CORE
               </button>
             )}
             <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-xs font-black overflow-hidden shadow-2xl border-none">
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
              <div ref={scrollRef} className="flex-1 overflow-y-auto pt-6 pb-40 md:pb-52 w-full custom-scrollbar scroll-smooth border-none">
                <div className="max-w-4xl mx-auto px-6 md:px-10 w-full border-none">
                  {!activeSession || activeSession.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-24 md:mt-40 text-center animate-in fade-in duration-1000 w-full border-none">
                      <Logo className="w-32 h-32 md:w-40 md:h-40 mb-10" hideText={false} />
                      <h1 className="text-3xl md:text-5xl font-black mb-6 tracking-tighter text-zinc-900 dark:text-white px-4 leading-tight border-none">
                        Intelligence Unbound.
                      </h1>
                      <div className="flex gap-4 opacity-30 border-none">
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">Pure Somali</span>
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">Neural Grounding</span>
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">2026 Ready</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full pb-10 flex flex-col border-none">
                      {activeSession.messages.map(m => <ChatMessage key={m.id} message={m} user={user} />)}
                      {isLoading && <ThinkingIndicator />}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-6 md:p-12 bg-gradient-to-t from-white dark:from-black via-white/95 dark:via-black/95 to-transparent z-20 border-none">
                <div className="max-w-4xl mx-auto relative w-full border-none">
                  <div className="bg-zinc-50 dark:bg-zinc-900/95 rounded-[2.8rem] p-3 md:p-4 shadow-2xl backdrop-blur-3xl border-none">
                    <div className="flex items-center gap-3 md:gap-4 border-none">
                      <button onClick={() => fileInputRef.current?.click()} className="p-4 text-zinc-400 hover:text-blue-500 transition-all hover:scale-110 border-none">
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
                        placeholder="Establish link..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-lg py-4 outline-none resize-none max-h-48 dark:text-white placeholder-zinc-400 font-bold"
                        rows={1}
                      />
                      <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)} className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-blue-600 text-white rounded-[1.8rem] disabled:opacity-20 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/30 border-none">
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
