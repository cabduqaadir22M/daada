
import React from 'react';
import { ChatSession, ViewType, User } from '../types';
import { Logo } from './Logo';

interface SidebarProps {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: (isPrivate?: boolean) => void;
  view: ViewType;
  setView: (v: ViewType) => void;
  isOpen: boolean;
  onToggle: () => void;
  onDeleteSession: (id: string) => void;
  onLogOut: () => void;
  isPrivateMode: boolean;
  setPrivateMode: (v: boolean) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  user, sessions, activeSessionId, onSelectSession, onNewChat, view, setView, isOpen, onToggle, onLogOut, isDarkMode, onToggleTheme
}) => {
  const filteredSessions = sessions.filter(s => !s.isPrivate);

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden" onClick={onToggle} />}
      <aside className={`fixed md:static inset-y-0 left-0 w-72 bg-zinc-50 dark:bg-[#080808] border-r border-zinc-200 dark:border-zinc-900 flex flex-col z-40 transition-all duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="w-7 h-7" hideText={true} />
              <span className="font-black text-xl tracking-tighter text-zinc-900 dark:text-white">DAADIR</span>
            </div>
            <button 
              onClick={onToggleTheme} 
              className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors text-zinc-500"
            >
              {isDarkMode ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" strokeWidth="2.5" strokeLinecap="round"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" strokeWidth="2.5" strokeLinecap="round"/></svg>
              )}
            </button>
          </div>

          <button 
            onClick={() => { setView('chat'); onNewChat(false); onToggle(); }}
            className="w-full flex items-center justify-between px-6 py-4.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 group shadow-xl shadow-zinc-900/10 dark:shadow-white/5"
          >
            <span className="text-xs font-black uppercase tracking-widest">New Session</span>
            <svg className="w-4 h-4 opacity-40 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-1">
          <div className="px-4 mb-4">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest opacity-60">Neural Threads</h3>
          </div>
          {filteredSessions.length === 0 ? (
            <div className="px-6 py-12 text-center opacity-20">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Void</p>
            </div>
          ) : (
            filteredSessions.map(s => (
              <button
                key={s.id}
                onClick={() => { setView('chat'); onSelectSession(s.id); onToggle(); }}
                className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-bold truncate transition-all group ${activeSessionId === s.id ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-md border border-zinc-200 dark:border-white/5' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                {s.title || 'Untitled Session'}
              </button>
            ))
          )}
        </div>

        <div className="p-6 border-t border-zinc-200 dark:border-zinc-900 space-y-3">
           <div className="flex items-center justify-between px-4 py-3 mb-2 bg-zinc-100 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-white/5">
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Edge Synced</span>
              </div>
              <span className="text-[8px] font-bold text-zinc-400">v2.0</span>
           </div>

           <button 
             onClick={() => { setView('image-gen'); onToggle(); }}
             className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all border ${view === 'image-gen' ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-transparent border-zinc-200 dark:border-zinc-900 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-900'}`}
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2.5" strokeLinecap="round"/></svg>
             <span className="text-xs font-black uppercase tracking-widest">Aqli Vision</span>
           </button>

           <button 
             onClick={() => { setView('admin'); onToggle(); }}
             className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all border ${view === 'admin' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xl' : 'bg-transparent border-zinc-200 dark:border-zinc-900 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900'}`}
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
             <span className="text-xs font-black uppercase tracking-widest">Console</span>
           </button>
           
           <div className="flex items-center gap-3 px-4 py-4 mt-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 shadow-sm">
              <div className="w-9 h-9 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-xs text-white dark:text-black font-black">
                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-2xl" /> : user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-zinc-900 dark:text-white truncate uppercase tracking-tighter">{user.name}</p>
                <button onClick={onLogOut} className="text-[9px] text-red-500 font-black uppercase tracking-widest hover:text-red-400 transition-colors">Sign out</button>
              </div>
           </div>
        </div>
      </aside>
    </>
  );
};
