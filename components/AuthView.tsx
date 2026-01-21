
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { storage } from '../services/storage';
import { Logo } from './Logo';

declare global {
  interface Window {
    google: any;
  }
}

interface AuthViewProps {
  onAuthSuccess: (user: User) => void;
}

const INTEREST_OPTIONS = [
  'Technology', 'Business', 'Science', 'Art', 'Politics', 
  'Education', 'Healthcare', 'Economics', 'Literature'
];

const GOOGLE_CLIENT_ID = "651372338161-placeholder.apps.googleusercontent.com";

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1); 
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'available' | 'taken' | 'invalid' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const initGoogle = () => {
      try {
        if (window.google && window.google.accounts) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
          });

          const container = document.getElementById("googleBtnContainer");
          if (container) {
            window.google.accounts.id.renderButton(container, {
              theme: "outline",
              size: "large",
              width: container.offsetWidth,
              text: "continue_with",
              shape: "pill"
            });
          }
        }
      } catch (e) { 
        console.warn("Google Identity Services failed to load."); 
      }
    };
    const timer = setTimeout(initGoogle, 1500);
    return () => clearTimeout(timer);
  }, [step, isLogin]);

  useEffect(() => {
    if (isLogin || !username || username.length < 3) {
      setUsernameStatus(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const taken = await storage.isUsernameTaken(username);
        setUsernameStatus(taken ? 'taken' : 'available');
      } catch (e) {
        console.error(e);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [username, isLogin]);

  const handleCredentialResponse = async (response: any) => {
    setIsLoading(true);
    setError('');
    try {
      if (!response.credential) throw new Error("Authentication failed.");
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const googleUser = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));

      if (!googleUser.email.toLowerCase().endsWith('@gmail.com')) {
        throw new Error("Only Gmail addresses are permitted.");
      }

      const users = await storage.getUsers();
      const existing = users.find(u => u.email.toLowerCase() === googleUser.email.toLowerCase());
      
      if (existing) {
        storage.setActiveUser(existing);
        onAuthSuccess(existing);
      } else {
        const genUsername = googleUser.name.toLowerCase().replace(/\s+/g, '_') + Math.floor(Math.random() * 1000);
        const newGoogleUser: User = {
          id: `goog_${Date.now()}`,
          email: googleUser.email,
          username: genUsername,
          name: googleUser.name,
          interests: ['Technology'],
          avatar: googleUser.picture,
          strikes: 0,
          banUntil: 0
        };
        await storage.registerUser(newGoogleUser);
        storage.setActiveUser(newGoogleUser);
        onAuthSuccess(newGoogleUser);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try manual entry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isLogin && step === 1) {
      if (usernameStatus === 'taken') { setError('Username is already taken.'); return; }
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      setStep(2);
    } else {
      await handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    try {
      if (isLogin) {
        const user = await storage.authenticate(email.trim(), password);
        if (user) {
          storage.setActiveUser(user);
          onAuthSuccess(user);
        } else {
          setError('Invalid email or password.');
        }
      } else {
        const newUser: User = { 
          id: `usr_${Date.now()}`, 
          email: email.trim().toLowerCase(), 
          username: username.trim().toLowerCase(),
          name: name.trim(),
          interests: interests,
          strikes: 0,
          banUntil: 0
        };
        await storage.registerUser(newUser, password);
        storage.setActiveUser(newUser);
        onAuthSuccess(newUser);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#050505] p-6 font-sans text-zinc-900 dark:text-white">
      <div className="w-full max-w-[420px] animate-in fade-in zoom-in duration-500">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 mb-6 drop-shadow-xl">
              <Logo className="w-full h-full" hideText={true} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter">
              {isLogin ? 'Welcome back' : step === 1 ? 'Join Daadir' : 'Final step'}
            </h1>
            <p className="text-zinc-500 text-[10px] mt-2 font-bold opacity-60 tracking-wider">
              Somali intelligence
            </p>
          </div>

          <form onSubmit={handleNext} className="space-y-5">
            {step === 1 ? (
              <>
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 ml-1">Full name</label>
                    <input 
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none transition-all focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Your full name" required
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 ml-1">Email (Gmail)</label>
                  <input 
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none transition-all focus:ring-4 focus:ring-blue-500/10"
                    placeholder="example@gmail.com" required
                  />
                </div>
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 ml-1">Username</label>
                    <input 
                      type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                      className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none transition-all focus:ring-4 focus:ring-blue-500/10"
                      placeholder="username" required
                    />
                  </div>
                )}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-bold text-zinc-400 ml-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none transition-all pr-12 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="••••••••" required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-xl opacity-40 hover:opacity-100 transition-opacity">
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-zinc-400 text-center tracking-wider">Select interests ({interests.length}/3)</p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                  {INTEREST_OPTIONS.map(opt => (
                    <button
                      key={opt} type="button"
                      onClick={() => setInterests(prev => prev.includes(opt) ? prev.filter(i => i !== opt) : (prev.length < 3 ? [...prev, opt] : prev))}
                      className={`px-3 py-3 rounded-xl text-[10px] font-bold transition-all border ${interests.includes(opt) ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-500'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[11px] text-center font-bold">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 text-[11px] tracking-widest"
            >
              {isLoading ? 'Wait...' : isLogin ? 'Sign in' : step === 1 ? 'Next' : 'Create account'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-zinc-100 dark:border-white/5 pt-6">
            <button onClick={() => { setIsLogin(!isLogin); setStep(1); setError(''); }} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors">
              {isLogin ? <>New here? <span className="text-blue-600 underline">Create account</span></> : <>Have an account? <span className="text-blue-600 underline">Sign in</span></>}
            </button>
          </div>
          <div id="googleBtnContainer" className="mt-6 w-full flex justify-center min-h-[50px]"></div>
        </div>
      </div>
    </div>
  );
};
