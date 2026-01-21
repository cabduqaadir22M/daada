
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
  name: 'Guest',
  email: '',
  username: 'guest',
  strikes: 0,
  banUntil: 0
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => storage.getActiveUser());
  const [showAuth, setShowAuth] = useState(false);
  const [showGuestWarning, setShowGuestWarning] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentRenderSession, setCurrentRenderSession] = useState<ChatSession | null>(null);
  const [view, setView] = useState<ViewType>('chat');
  const [input, setInput] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = user || GUEST_USER;

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const loadSessions = useCallback(async () => {
    if (user) {
      const stored = await storage.getSessions(user.id, false);
      setSessions(stored);
    } else {
      setSessions([]);
    }
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    const fetchActive = async () => {
      if (!user) return;
      const found = sessions.find(s => s.id === activeSessionId);
      if (found) setCurrentRenderSession(found);
    };
    fetchActive();
  }, [activeSessionId, sessions, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentRenderSession?.messages, isLoading, view]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && attachments.length === 0) || isLoading) return;

    if (!user && !showGuestWarning) {
      setShowGuestWarning(true);
    }

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
        isPrivate: !user || isPrivateMode
      };
      sId = newId;
      setActiveSessionId(sId);
    }

    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: trimmedInput || "[Attachment]",
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    const assistantId = `msg_ai_${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() + 1 };
    const updatedSession = { ...session, messages: [...session.messages, userMsg, assistantMsg], updatedAt: Date.now() };

    setCurrentRenderSession(updatedSession);
    if (user && !isPrivateMode) await storage.saveSession(updatedSession);

    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const stream = geminiService.streamChat([...session.messages, userMsg], currentUser.name, [], !user || isPrivateMode);
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

      if (user && !isPrivateMode) {
        const finalSession = { ...updatedSession, messages: updatedSession.messages.map(m => m.id === assistantId ? { ...m, content: fullContent } : m) };
        await storage.saveSession(finalSession);
        setSessions(prev => {
          const exists = prev.find(s => s.id === sId);
          if (exists) return prev.map(s => s.id === sId ? finalSession : s);
          return [finalSession, ...prev];
        });
      }
    } catch (e: any) {
      setIsLoading(false);
      const errorMsg = "Sorry, an error occurred during the connection. Please try again.";
      setCurrentRenderSession(prev => prev ? { ...prev, messages: prev.messages.map(m => m.id === assistantId ? { ...m, content: errorMsg } : m) } : prev);
    } finally {
      setIsLoading(false);
    }
  };

  if (showAuth) return <AuthView onAuthSuccess={(u) => { setUser(u); setShowAuth(false); setShowGuestWarning(false); }} />;

  const renderContent = () => {
    switch(view) {
      case 'image-gen': return <ImageGenerator user={currentUser} />;
      case 'admin': return <AdminConsole />;
      default:
        return (
          <div className="flex-1 flex flex-col min-h-0 relative">
            <div ref={scrollRef} className="flex-1 overflow-y-auto pt-8 pb-32 custom-scrollbar">
              <div className="max-w-3xl mx-auto px-6">
                {!currentRenderSession || currentRenderSession.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center mt-20 text-center animate-in fade-in duration-1000">
                    <Logo className="w-40 h-40 mb-2" onLogoTextClick={() => setView('admin')} />
                    <h1 className="text-3xl font-black mb-4 tracking-tight text-zinc-900 dark:text-white">How can I help you today?</h1>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentRenderSession.messages.map(m => <ChatMessage key={m.id} message={m} user={currentUser} />)}
                    {isLoading && <ThinkingIndicator />}
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white dark:from-black via-white dark:via-black/90 to-transparent">
              <div className="max-w-3xl mx-auto relative">
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-2 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-xl">
                  {attachments.length > 0 && (
                    <div className="flex gap-2 p-2 mb-2">
                      {attachments.map(at => (
                        <div key={at.id} className="relative w-12 h-12 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-md">
                          <img src={`data:${at.mimeType};base64,${at.data}`} className="w-full h-full object-cover" />
                          <button onClick={() => setAttachments([])} className="absolute top-0 right-0 bg-black/50 p-1 text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-blue-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const base64 = (ev.target?.result as string).split(',')[1];
                        setAttachments([{ id: Date.now().toString(), type: 'image', mimeType: file.type, data: base64, name: file.name }]);
                      };
                      reader.readAsDataURL(file);
                    }} />
                    <textarea 
                      value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Ask me anything..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 outline-none resize-none max-h-32 dark:text-white placeholder-zinc-400 font-medium"
                      rows={1}
                    />
                    <button 
                      onClick={handleSend} 
                      disabled={isLoading || (!input.trim() && attachments.length === 0)}
                      className="w-11 h-11 flex items-center justify-center bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl disabled:opacity-20 hover:scale-105 active:scale-95 transition-all shadow-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="3" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors">
      <Sidebar 
        user={currentUser} onUpdateUser={() => {}} sessions={sessions} activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId} onNewChat={() => { setActiveSessionId(null); setCurrentRenderSession(null); setView('chat'); }}
        view={view} setView={setView} isOpen={isSidebarOpen} onToggle={() => setSidebarOpen(!isSidebarOpen)}
        onDeleteSession={async (id) => { await storage.deleteSession(id); setSessions(prev => prev.filter(s => s.id !== id)); }}
        onLogOut={user ? () => { storage.setActiveUser(null); setUser(null); } : () => setShowAuth(true)} 
        isPrivateMode={isPrivateMode} setPrivateMode={setIsPrivateMode}
        isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />
      <main className="flex-1 flex flex-col relative min-w-0 h-full">
        {showGuestWarning && !user && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 p-6 rounded-[2rem] shadow-2xl flex flex-col items-center text-center gap-4">
              <h3 className="text-sm font-black">Guest Mode</h3>
              <p className="text-[11px] text-zinc-500">History will not be saved locally until you sign in.</p>
              <div className="flex gap-2 w-full">
                <button onClick={() => setShowAuth(true)} className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold text-[10px] uppercase tracking-widest">Sign In</button>
                <button onClick={() => setShowGuestWarning(false)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl font-bold text-[10px] uppercase tracking-widest">Continue</button>
              </div>
            </div>
          </div>
        )}
        <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[11px] font-black text-zinc-400 tracking-wider uppercase">{view === 'admin' ? 'System Console' : 'Aqli Live'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {view !== 'chat' && <button onClick={() => setView('chat')} className="text-[10px] font-black text-zinc-400 hover:text-black dark:hover:text-white transition-colors border border-zinc-200 dark:border-white/10 px-3 py-1 rounded-lg">BACK</button>}
             {!user && <button onClick={() => setShowAuth(true)} className="px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:opacity-80 transition-opacity">Sign in</button>}
             <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-[10px] font-bold overflow-hidden border border-zinc-200 dark:border-white/5 shadow-inner">
               {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : currentUser.name.charAt(0)}
             </div>
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
