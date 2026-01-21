
import React, { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { User, ChatSession } from '../types';
import { Logo } from './Logo';

export const AdminConsole: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalSessions: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const allUsers = await storage.getUsers();
      setUsers(allUsers);
      
      let sessionCount = 0;
      for (const user of allUsers) {
        const sessions = await storage.getSessions(user.id);
        sessionCount += sessions.length;
      }
      
      setStats({
        totalUsers: allUsers.length,
        totalSessions: sessionCount
      });
      setIsLoading(false);
    };
    loadData();
  }, []);

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `daadir_database_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-zinc-200 dark:border-zinc-800 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Neural Link Establishing...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-16 bg-zinc-50 dark:bg-[#050505] custom-scrollbar">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-16 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">Internal</span>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Version 2.0.4</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-zinc-900 dark:text-white">System Console</h1>
          </div>
          <button 
            onClick={exportData}
            className="group flex items-center gap-3 px-8 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all active:scale-95"
          >
            <svg className="w-4 h-4 text-zinc-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export Local Database
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-[2.5rem] shadow-sm">
            <p className="text-[10px] font-black text-zinc-400 uppercase mb-3 tracking-widest">Total Nodes</p>
            <div className="flex items-baseline gap-2">
              <p className="text-5xl font-black tracking-tighter text-zinc-900 dark:text-white">{stats.totalUsers}</p>
              <span className="text-xs font-bold text-zinc-400 italic">Users</span>
            </div>
          </div>
          <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-[2.5rem] shadow-sm">
            <p className="text-[10px] font-black text-zinc-400 uppercase mb-3 tracking-widest">Neural Sessions</p>
            <div className="flex items-baseline gap-2">
              <p className="text-5xl font-black tracking-tighter text-blue-600">{stats.totalSessions}</p>
              <span className="text-xs font-bold text-zinc-400 italic">Threads</span>
            </div>
          </div>
          <div className="p-8 bg-blue-600 rounded-[2.5rem] shadow-2xl shadow-blue-600/20 text-white">
            <p className="text-[10px] font-black text-blue-100 uppercase mb-3 tracking-widest">Storage Mode</p>
            <p className="text-2xl font-black tracking-tighter">EDGE-LOCAL</p>
            <p className="text-[9px] font-bold text-blue-200 mt-2 uppercase opacity-80 leading-relaxed">Zero cost &bull; High privacy &bull; Decentralized</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/10">
                  <th className="px-10 py-8 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Profile Architecture</th>
                  <th className="px-10 py-8 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Access Level</th>
                  <th className="px-10 py-8 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Synchronization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
                {users.map(u => (
                  <tr key={u.id} className="group hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-sm shadow-inner group-hover:scale-110 transition-transform">
                          {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover rounded-2xl" /> : u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-base text-zinc-900 dark:text-white tracking-tight">{u.name}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-blue-500">@{u.username}</span>
                        <div className="flex gap-1">
                          {u.interests?.slice(0, 2).map(i => (
                            <span key={i} className="text-[8px] font-black text-zinc-400 uppercase">{i}</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active Edge</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-16 flex flex-col items-center gap-4 opacity-30 group">
          <Logo className="w-12 h-12 grayscale group-hover:grayscale-0 transition-all duration-700" hideText={true} />
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.8em]">DAADIR NEURAL NETWORK</p>
        </div>
      </div>
    </div>
  );
};
