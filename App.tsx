
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

const GUEST_USER: User = {
  id: 'guest_user',
  name: 'Aqli Guest',
  email: '',
  username: 'guest',
  strikes: 0,
  banUntil: 0
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => storage.getActiveUser());
  const [showAuth, setShowAuth] = useState(false);
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

  const currentUser = user || GUEST_USER;

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const canSeeAdmin = localStorage.getItem('daadir_admin_mode') === 'true';

  const loadSessions = useCallback(async () => {
    const stored = await storage.getSessions(currentUser.id, false);
    setSessions(stored);
  }, [currentUser.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    const fetchActive = async () => {
      const found = sessions.find(s => s.id === activeSessionId);
      if (found) setCurrentRenderSession(found);
    };
    fetchActive();
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentRenderSession?.messages, isLoading, view]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && attachments.length === 0) || isLoading) return;

    let sId = activeSessionId;
    let session = currentRenderSession;

    if (!sId || !session) {
      const newId = `session_${Date.now()}`;
      session = {
        id: newId,
        userId: currentUser.id,
        title: trimmedInput.slice(0, 40) || 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPrivate: false
      };
      sId = newId;
      setActiveSessionId(sId);
    }

    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: trimmedInput || "Attached file",
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    const assistantId = `msg_ai_${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() + 1 };
    const updatedSession = { ...session, messages: [...session.messages, userMsg, assistantMsg], updatedAt: Date.now() };

    setCurrentRenderSession(updatedSession);
    await storage.saveSession(updatedSession);

    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const stream = geminiService.streamChat([...session.messages, userMsg], currentUser.name);
      let fullContent = '';
      let isFirstChunk = true;

      for await (const update of stream) {
        if (isFirstChunk) { setIsLoading(false); isFirstChunk = false; }
        fullContent += update.text || '';
        
        setCurrentRenderSession(prev => {
          if (!prev || prev.id !== sId) return prev;
          return {
            ...prev,
            messages: prev.messages.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
          };
        });
      }

      const finalSession = { ...updatedSession, messages: updatedSession.messages.map(m => m.id === assistantId ? { ...m, content: fullContent } : m) };
      await storage.saveSession(finalSession);
      setSessions(prev => {
        const exists = prev.find(s => s.id === sId);
        if (exists) return prev.map(s => s.id === sId ? finalSession : s);
        return [finalSession, ...prev];
      });
    } catch (e: any) {
      setIsLoading(false);
      const errorMsg = "The neural link encountered an error. Check your connection.";
      setCurrentRenderSession(prev => prev ? { ...prev, messages: prev.messages.map(m => m.id === assistantId ? { ...m, content: errorMsg } : m) } : prev);
    } finally {
      setIsLoading(false);
    }
  };

  if (showAuth) return <AuthView onAuthSuccess={(u) => { setUser(u); setShowAuth(false); }} />;

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors">
      <Sidebar 
        user={currentUser} isRealUser={!!user} onUpdateUser={() => {}} sessions={sessions} activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId} onNewChat={() => { setActiveSessionId(null); setCurrentRenderSession(null); setView('chat'); }}
        view={view} setView={setView} isOpen={isSidebarOpen} onToggle={() => setSidebarOpen(!isSidebarOpen)}
        onDeleteSession={async (id) => { await storage.deleteSession(id); setSessions(prev => prev.filter(s => s.id !== id)); }}
        onLogOut={user ? () => { storage.setActiveUser(null); setUser(null); } : () => setShowAuth(true)} 
        isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />
      
      <main className="flex-1 flex flex-col relative w-full h-full min-w-0">
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2.5"/></svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-[10px] md:text-xs font-bold text-zinc-400 truncate tracking-wide">Aqli Intelligence</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
             {view !== 'chat' && (
               <button 
                 onClick={() => setView('chat')} 
                 className="text-[10px] font-bold text-zinc-500 hover:text-black dark:hover:text-white transition-all bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/5 shadow-sm"
               >
                 Chat
               </button>
             )}
             {!user && <button onClick={() => setShowAuth(true)} className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black text-[9px] md:text-[10px] font-bold rounded-full hover:opacity-80 transition-opacity whitespace-nowrap uppercase tracking-widest shadow-lg">Add Account</button>}
             {canSeeAdmin && <button onClick={() => setView('admin')} className="p-2 text-zinc-400 hover:text-blue-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2.5"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2.5"/></svg></button>}
             <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-[10px] font-bold overflow-hidden border border-zinc-200 dark:border-white/5 shadow-sm">
               {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : currentUser.name.charAt(0)}
             </div>
          </div>
        </header>

        <div className="flex-1 w-full overflow-hidden flex flex-col relative">
          {view === 'image-gen' ? (
            <ImageGenerator user={currentUser} />
          ) : view === 'admin' ? (
            <AdminConsole />
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto pt-4 md:pt-8 pb-32 md:pb-40 custom-scrollbar w-full">
                <div className="max-w-3xl mx-auto px-4 md:px-6 w-full">
                  {!currentRenderSession || currentRenderSession.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-12 md:mt-24 text-center animate-in fade-in duration-1000 w-full">
                      <Logo className="w-24 h-24 md:w-32 md:h-32 mb-6" />
                      <h1 className="text-xl md:text-3xl font-black mb-4 tracking-tighter text-zinc-900 dark:text-white px-4 leading-tight">
                        How can I assist you today?
                      </h1>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest max-w-[200px] leading-relaxed">
                        Neural Core V3.1 Active & Ready
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8 md:space-y-12 w-full">
                      {currentRenderSession.messages.map(m => <ChatMessage key={m.id} message={m} user={currentUser} />)}
                      {isLoading && <ThinkingIndicator />}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-4 md:p-8 bg-gradient-to-t from-white dark:from-black via-white/90 dark:via-black/90 to-transparent z-20">
                <div className="max-w-3xl mx-auto relative w-full">
                  <div className="bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-3xl md:rounded-[2rem] p-2 md:p-3 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-2xl backdrop-blur-md">
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 mb-2">
                        {attachments.map(at => (
                          <div key={at.id} className="relative group px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl flex items-center gap-2 shadow-sm animate-in zoom-in duration-200">
                            <span className="text-[9px] md:text-[10px] font-bold truncate max-w-[80px] md:max-w-[150px]">{at.name}</span>
                            <button onClick={() => setAttachments(prev => prev.filter(x => x.id !== at.id))} className="text-zinc-400 hover:text-red-500 transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1 md:gap-2">
                      <button onClick={() => fileInputRef.current?.click()} className="p-3 md:p-4 text-zinc-400 hover:text-blue-600 transition-all shrink-0 active:scale-90">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => {
                        const files = Array.from(e.target.files || []) as File[];
                        files.forEach(file => {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const base64 = (ev.target?.result as string).split(',')[1];
                            setAttachments(prev => [...prev, { 
                              id: Date.now() + Math.random().toString(), 
                              type: file.type.startsWith('image/') ? 'image' : 'file', 
                              mimeType: file.type, 
                              data: base64, 
                              name: file.name 
                            }]);
                          };
                          reader.readAsDataURL(file);
                        });
                      }} />
                      <textarea 
                        value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); handleSend(); } }}
                        placeholder="Message Aqli..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-base py-3 md:py-4 outline-none resize-none max-h-40 dark:text-white placeholder-zinc-400 font-medium"
                        rows={1}
                      />
                      <button 
                        onClick={handleSend} 
                        disabled={isLoading || (!input.trim() && attachments.length === 0)}
                        className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl md:rounded-3xl disabled:opacity-20 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-zinc-900/10 dark:shadow-white/5 shrink-0"
                      >
                        <svg className="w-5 h-5 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
