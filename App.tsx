
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
    if ((!trimmedInput && attachments.length === 0) || isLoading || !user) return;

    let sId = activeSessionId;
    let session = currentRenderSession;

    if (!sId || !session) {
      const newId = `session_${Date.now()}`;
      session = {
        id: newId,
        userId: user.id,
        title: trimmedInput.slice(0, 40) || 'New conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
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
    
    // Optimistically update UI
    const updatedMessages = [...session.messages, userMsg, assistantMsg];
    const updatedSession = { ...session, messages: updatedMessages, updatedAt: Date.now() };

    setCurrentRenderSession(updatedSession);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      // Send history including the current user message
      const stream = geminiService.streamChat(updatedMessages.filter(m => m.id !== assistantId), user.name);
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

      const finalSession = { 
        ...updatedSession, 
        messages: updatedSession.messages.map(m => m.id === assistantId ? { ...m, content: fullContent } : m) 
      };
      await storage.saveSession(finalSession);
      setSessions(prev => {
        const exists = prev.find(s => s.id === sId);
        if (exists) return prev.map(s => s.id === sId ? finalSession : s);
        return [finalSession, ...prev];
      });
    } catch (e: any) {
      console.error("Chat Error:", e);
      setIsLoading(false);
      const errorMsg = "System interruption. Please try again.";
      setCurrentRenderSession(prev => prev ? { 
        ...prev, 
        messages: prev.messages.map(m => m.id === assistantId ? { ...m, content: errorMsg } : m) 
      } : prev);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <AuthView onAuthSuccess={(u) => setUser(u)} />;

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors">
      <Sidebar 
        user={user} isRealUser={true} onUpdateUser={() => {}} sessions={sessions} activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId} onNewChat={() => { setActiveSessionId(null); setCurrentRenderSession(null); setView('chat'); }}
        view={view} setView={setView} isOpen={isSidebarOpen} onToggle={() => setSidebarOpen(!isSidebarOpen)}
        onDeleteSession={async (id) => { await storage.deleteSession(id); setSessions(prev => prev.filter(s => s.id !== id)); }}
        onLogOut={() => { storage.setActiveUser(null); setUser(null); }} 
        isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />
      
      <main className="flex-1 flex flex-col relative w-full h-full min-w-0">
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2.5"/></svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-[10px] md:text-xs font-bold text-zinc-400 truncate tracking-widest uppercase">Aqli Neural Link</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
             {view !== 'chat' && (
               <button onClick={() => setView('chat')} className="text-[10px] font-bold text-zinc-500 hover:text-black dark:hover:text-white transition-all bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/5">
                 Chat
               </button>
             )}
             <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-[10px] font-bold overflow-hidden border border-zinc-200 dark:border-white/5 shadow-sm">
               {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0)}
             </div>
          </div>
        </header>

        <div className="flex-1 w-full overflow-hidden flex flex-col relative">
          {view === 'image-gen' ? (
            <ImageGenerator user={user} />
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
                    </div>
                  ) : (
                    <div className="space-y-6 md:space-y-10 w-full">
                      {currentRenderSession.messages.map(m => <ChatMessage key={m.id} message={m} user={user} />)}
                      {isLoading && <ThinkingIndicator />}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-4 md:p-8 bg-gradient-to-t from-white dark:from-black via-white/80 dark:via-black/80 to-transparent z-20">
                <div className="max-w-3xl mx-auto relative w-full">
                  <div className="bg-zinc-50 dark:bg-zinc-900/80 rounded-[2rem] p-2 md:p-3 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-xl backdrop-blur-md">
                    <div className="flex items-center gap-1 md:gap-2">
                      <button onClick={() => fileInputRef.current?.click()} className="p-3 md:p-4 text-zinc-400 hover:text-blue-600 transition-all shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" strokeLinecap="round"/></svg>
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
                        placeholder="Ask Aqli anything..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-base py-3 md:py-4 outline-none resize-none max-h-40 dark:text-white placeholder-zinc-400 font-medium"
                        rows={1}
                      />
                      <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)} className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl md:rounded-3xl disabled:opacity-20 hover:scale-105 active:scale-95 transition-all shadow-xl">
                        <svg className="w-5 h-5 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="3" strokeLinecap="round"/></svg>
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
