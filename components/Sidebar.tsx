
import React from 'react';
import { ChatSession, ViewType, User } from '../types';
import { Logo } from './Logo';

interface SidebarProps {
  user: User;
  isRealUser: boolean;
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
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  user, isRealUser, sessions, activeSessionId, onSelectSession, onNewChat, view, setView, isOpen, onToggle, onLogOut, isDarkMode, onToggleTheme
}) => {
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 md:hidden animate-in fade-in duration-300" 
          onClick={onToggle} 
        />
      )}
      <aside className={`fixed md:static inset-y-0 left-0 w-[280px] md:w-64 bg-zinc-50 dark:bg-[#080808] border-r border-zinc-200 dark:border-zinc-900 flex flex-col z-50 transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-5 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo className="w-7 h-7" hideText={true} />
              <span className="font-black text-xl tracking-tighter text-zinc-900 dark:text-white">Daadir.ai</span>
            </div>
            <button onClick={onToggleTheme} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors text-zinc-500 border border-transparent dark:border-white/5">
              {isDarkMode ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" strokeWidth="2.5"/></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" strokeWidth="2.5"/></svg>}
            </button>
          </div>

          <button 
            onClick={() => { setView('chat'); onNewChat(false); onToggle(); }}
            className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl transition-all hover:scale-[0.98] active:scale-95 shadow-xl shadow-zinc-900/10 dark:shadow-white/5"
          >
            <span className="text-[11px] font-bold tracking-tight">New chat</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
          <div className="px-4 mb-2">
            <h3 className="text-[9px] font-bold text-zinc-400 tracking-wider opacity-60">Memory bank</h3>
          </div>
          {sessions.length === 0 ? (
            <div className="px-6 py-10 text-center opacity-30">
              <p className="text-[10px] font-bold italic tracking-wider">No sessions yet</p>
            </div>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => { setView('chat'); onSelectSession(s.id); onToggle(); }}
                className={`w-full text-left px-4 py-3.5 rounded-2xl text-[12px] font-bold truncate transition-all ${activeSessionId === s.id ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border border-zinc-200 dark:border-white/5 shadow-md scale-[1.02]' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-900/50 hover:text-zinc-900'}`}
              >
                {s.title || 'Untitled chat'}
              </button>
            ))
          )}
        </div>

        <div className="p-5 border-t border-zinc-200 dark:border-zinc-900 space-y-3">
           <button 
             onClick={() => { setView('image-gen'); onToggle(); }} 
             className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all shadow-sm ${view === 'image-gen' ? 'bg-blue-600 text-white shadow-blue-600/20' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-900'}`}
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
             <span className="text-[11px] font-bold">Aqli vision</span>
           </button>

           <div className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 shadow-lg">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-xs text-white dark:text-black font-black border border-white/10">
                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-xl" /> : user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-zinc-900 dark:text-white truncate tracking-tight">{user.name}</p>
                <button onClick={onLogOut} className={`text-[9px] font-bold tracking-tight hover:opacity-70 transition-opacity ${isRealUser ? 'text-red-500' : 'text-blue-600'}`}>
                  {isRealUser ? 'Log out' : 'Add account'}
                </button>
              </div>
           </div>
        </div>
      </aside>
    </>
  );
};
