
import React, { useState } from 'react';
import { User } from '../types';
import { storage } from '../services/storage';
import { Logo } from './Logo';

interface AuthViewProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    
    setIsLoading(true);
    try {
      const users = await storage.getUsers();
      let user = users.find(u => u.username.toLowerCase() === trimmed.toLowerCase());
      
      if (!user) {
        user = { 
          id: `usr_${Date.now()}`, 
          email: `${trimmed.toLowerCase()}@daadir.local`, 
          username: trimmed,
          name: trimmed,
          strikes: 0,
          banUntil: 0
        };
        await storage.registerUser(user);
      }
      
      storage.setActiveUser(user);
      onAuthSuccess(user);
    } catch (err: any) {
      setError('System error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-6 font-sans">
      <div className="w-full max-w-[420px] animate-in fade-in zoom-in duration-1000">
        <div className="flex flex-col items-center mb-12 text-center">
          <Logo className="w-24 h-24 mb-6" hideText={true} />
          <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">Identity</h1>
          <p className="text-zinc-500 text-[10px] mt-3 font-black uppercase tracking-[0.4em] opacity-50">Choose a name to begin</p>
        </div>

        <form onSubmit={handleStart} className="space-y-6">
          <div className="relative group">
            <input 
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-[2rem] px-8 py-6 text-lg outline-none transition-all focus:ring-4 focus:ring-blue-500/10 dark:text-white placeholder-zinc-400 font-bold"
              placeholder="Your name..." required autoFocus
            />
          </div>

          {error && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest">{error}</p>}

          <button 
            type="submit" disabled={isLoading || !username.trim()}
            className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-black py-6 rounded-[2rem] transition-all shadow-2xl disabled:opacity-50 text-[12px] uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-95"
          >
            {isLoading ? 'Connecting...' : 'Start Intelligence'}
          </button>
        </form>
        
        <p className="mt-12 text-center text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
          Neural Core by Daadir &bull; UNISO Engineering
        </p>
      </div>
    </div>
  );
};
