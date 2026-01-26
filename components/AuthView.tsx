
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
    if (!username.trim()) return;
    setIsLoading(true);
    try {
      const newUser: User = { 
        id: `local_usr_${Date.now()}`, 
        email: `${username.trim()}@daadir.local`, 
        username: username.trim().toLowerCase(),
        name: username.trim(),
        strikes: 0,
        banUntil: 0
      };
      await storage.registerUser(newUser); // Saves to local DB
      storage.setActiveUser(newUser);
      onAuthSuccess(newUser);
    } catch (err: any) {
      setError('System error. Please try another name.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-6 font-sans">
      <div className="w-full max-w-[400px] animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center mb-10 text-center">
          <Logo className="w-20 h-20 mb-6" hideText={true} />
          <h1 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">What's your name?</h1>
          <p className="text-zinc-500 text-[10px] mt-2 font-bold uppercase tracking-widest opacity-60">Enter a username to begin</p>
        </div>

        <form onSubmit={handleStart} className="space-y-6">
          <input 
            type="text" value={username} onChange={e => setUsername(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-3xl px-6 py-5 text-base outline-none transition-all focus:ring-4 focus:ring-blue-500/10 dark:text-white"
            placeholder="Username..." required autoFocus
          />

          {error && <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-widest">{error}</p>}

          <button 
            type="submit" disabled={isLoading || !username.trim()}
            className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-black py-5 rounded-3xl transition-all shadow-xl disabled:opacity-50 text-[11px] uppercase tracking-[0.2em]"
          >
            {isLoading ? 'Establishing...' : 'Start Intelligence'}
          </button>
        </form>
      </div>
    </div>
  );
};
