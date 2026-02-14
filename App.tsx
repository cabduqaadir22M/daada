
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
  const [lastError, setLastError] = useState<string | null>(null);
  
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

    setLastError(null);
    let sId = activeSessionId;
    let session = activeSession;

    if (!sId || !session) {
      sId = `session_${Date.now()}`;
      session = {
        id: sId,
        userId: user.id,
        title: trimmedInput.slice(0, 30) || 'New chat',
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
      content: trimmedInput,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    const assistantId = `msg_ai_${Date.now()}`;
    const assistantPlaceholder: Message = { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() + 1 };
    
    setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, userMsg, assistantPlaceholder], updatedAt: Date.now() } : s));
    
    const prevInput = input;
    const prevAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const stream = geminiService.streamChat([...session.messages, userMsg]);
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

      const updatedMessages = [...session.messages, userMsg, { ...assistantPlaceholder, content: fullContent, sources: finalSources } as any];
      await storage.saveSession({ ...session, messages: updatedMessages, updatedAt: Date.now() });
    } catch (e: any) {
      setLastError(e.message || "I'm having trouble connecting right now.");
      setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: s.messages.filter(m => m.id !== assistantId) } : s));
      setInput(prevInput);
      setAttachments(prevAttachments);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <AuthView onAuthSuccess={(u) => setUser(u)} />;

  return (
    <div className="flex h-[100dvh] w-full bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors selection:bg-blue-500/30">
      <Sidebar 
        user={user} isRealUser={true} onUpdateUser={() => {}} sessions={sessions} activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId} onNewChat={() => { setActiveSessionId(null); setView('chat'); }}
        view={view} setView={setView} isOpen={isSidebarOpen} onToggle={() => setSidebarOpen(!isSidebarOpen)}
        onDeleteSession={async (id) => { await storage.deleteSession(id); setSessions(prev => prev.filter(s => s.id !== id)); if(activeSessionId === id) setActiveSessionId(null); }}
        onLogOut={() => { storage.setActiveUser(null); setUser(null); }} 
        isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />
      
      <main className="flex-1 flex flex-col relative w-full h-full min-w-0 border-none">
        <header className="h-14 md:h-20 flex items-center justify-between px-4 md:px-10 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 shrink-0 border-none">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-zinc-500 border-none">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2.5"/></svg>
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Aqli assistant</span>
                <span className="px-1.5 py-0.5 bg-blue-600/10 text-[8px] font-bold rounded text-blue-600 uppercase">Beta</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-xs font-black overflow-hidden border-none shadow-sm">
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
              <div ref={scrollRef} className="flex-1 overflow-y-auto pt-4 pb-32 md:pb-56 w-full custom-scrollbar scroll-smooth">
                <div className="max-w-3xl mx-auto px-4 md:px-0 w-full">
                  {!activeSession || activeSession.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-20 md:mt-32 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 w-full">
                      <div className="relative mb-8">
                        <Logo className="w-20 h-20 md:w-28 md:h-28" hideText={true} />
                        <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-zinc-900 dark:bg-white text-white dark:text-black text-[8px] font-bold rounded-full uppercase">Beta</span>
                      </div>
                      <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight leading-tight">
                        What's on your mind?
                      </h1>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium max-w-sm mx-auto mb-8 px-4">
                        A smarter way to get things done. Fast, private, and built for you.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full pb-8 flex flex-col">
                      {activeSession.messages.map(m => <ChatMessage key={m.id} message={m} user={user} />)}
                      {isLoading && <ThinkingIndicator />}
                      {lastError && (
                        <div className="flex flex-col items-center gap-2 my-4 animate-in zoom-in duration-300">
                          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center px-10 leading-relaxed">{lastError}</p>
                          <button onClick={handleSend} className="bg-zinc-900 dark:bg-white text-white dark:text-black text-[9px] font-bold uppercase tracking-widest px-6 py-2.5 rounded-full hover:scale-105 transition-transform active:scale-95 shadow-lg">Retry message</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-4 md:p-10 bg-gradient-to-t from-white dark:from-black via-white/95 dark:via-black/95 to-transparent z-40 border-none">
                <div className="max-w-3xl mx-auto relative w-full border-none">
                  {attachments.length > 0 && (
                    <div className="flex gap-2 mb-3 animate-in slide-in-from-bottom-2">
                      {attachments.map(at => (
                        <div key={at.id} className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg border-2 border-white dark:border-zinc-800">
                           <img src={`data:${at.mimeType};base64,${at.data}`} className="w-full h-full object-cover" />
                           <button onClick={() => setAttachments(p => p.filter(x => x.id !== at.id))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg">
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="4"/></svg>
                           </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bg-zinc-100 dark:bg-zinc-900/90 rounded-[2rem] md:rounded-[2.8rem] p-2 md:p-3 shadow-2xl backdrop-blur-2xl border-none">
                    <div className="flex items-center gap-2 md:gap-4">
                      <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-blue-500 transition-colors border-none">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        files.forEach(file => {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const base64 = (ev.target?.result as string).split(',')[1];
                            setAttachments(prev => [...prev, { id: Date.now().toString(), type: 'image', mimeType: file.type, data: base64, name: file.name }]);
                          };
                          reader.readAsDataURL(file);
                        });
                      }} />
                      <textarea 
                        value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); handleSend(); } }}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-lg py-3 outline-none resize-none max-h-32 placeholder-zinc-500 font-semibold"
                        style={{ color: isDarkMode ? '#ffffff' : '#000000' }}
                        rows={1}
                      />
                      <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)} className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center bg-blue-600 text-white rounded-[1.4rem] md:rounded-[1.8rem] disabled:opacity-20 active:scale-95 transition-all shadow-xl shadow-blue-600/20 border-none shrink-0">
                        <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
