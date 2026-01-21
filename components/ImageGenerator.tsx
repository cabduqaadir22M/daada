
import React, { useState, useEffect, useRef } from 'react';
import { User, GeneratedImage, Attachment } from '../types';
import { geminiService } from '../services/geminiService';
import { storage } from '../services/storage';
import { Logo } from './Logo';

export const ImageGenerator: React.FC<{ user: User }> = ({ user }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [baseImage, setBaseImage] = useState<Attachment | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadImages = async () => {
      const images = await storage.getImages(user.id);
      setHistory(images);
    };
    loadImages();
  }, [user]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const url = await geminiService.generateImage(prompt, baseImage || undefined);
      const newImg: GeneratedImage = {
        id: Date.now().toString(),
        userId: user.id,
        prompt: baseImage ? `Neural refinement: ${prompt}` : prompt,
        url,
        timestamp: Date.now()
      };
      await storage.saveImage(newImg);
      setHistory([newImg, ...history]);
      setPrompt('');
      setBaseImage(null);
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera access denied", err);
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
      
      setBaseImage({
        id: Date.now().toString(),
        type: 'image',
        mimeType: 'image/jpeg',
        data: base64,
        name: 'biometric_capture.jpg'
      });

      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraOpen(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      setBaseImage({
        id: Date.now().toString(),
        type: 'image',
        mimeType: file.type,
        data: base64,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const downloadImage = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `aqli-vision-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#080808] transition-all relative overflow-hidden">
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pt-6 pb-64 custom-scrollbar scroll-smooth"
      >
        <div className="max-w-4xl mx-auto px-6 sm:px-8">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center mt-24 sm:mt-32 space-y-8 animate-in fade-in duration-700">
              <div className="w-20 h-20 transition-transform duration-700 hover:scale-110">
                <Logo className="w-full h-full" />
              </div>
              <div>
                 <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white mb-3 tracking-tighter text-center">
                   Aqli vision
                 </h1>
                 <p className="text-sm font-bold text-zinc-400 dark:text-zinc-500 tracking-wide text-center">
                   Next-gen neural image synthesis active
                 </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-8">
              {history.map(img => (
                <div 
                  key={img.id} 
                  className="group relative bg-zinc-50 dark:bg-white/5 rounded-[2.5rem] overflow-hidden border-2 border-zinc-100 dark:border-white/5 shadow-xl transition-all hover:scale-[1.02] cursor-pointer"
                  onClick={() => setSelectedImage(img)}
                >
                  <div className="aspect-square relative overflow-hidden">
                    <img src={img.url} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" strokeLinecap="round"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth="2" strokeLinecap="round"/></svg>
                      </div>
                      <p className="text-[10px] text-white font-bold line-clamp-2 uppercase">"{img.prompt}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full screen modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-6 backdrop-blur-2xl animate-in fade-in duration-300">
           <button 
             onClick={() => setSelectedImage(null)}
             className="absolute top-8 right-8 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-white/20 transition-all"
           >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" strokeLinecap="round"/></svg>
           </button>
           <div className="w-full max-w-4xl h-full flex flex-col items-center justify-center gap-8">
              <div className="relative w-full aspect-square max-h-[75vh] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10">
                 <img src={selectedImage.url} className="w-full h-full object-contain" />
              </div>
              <div className="text-center w-full">
                 <p className="text-zinc-400 text-[11px] font-bold mb-6 px-6">"{selectedImage.prompt}"</p>
                 <button 
                   onClick={(e) => { e.stopPropagation(); downloadImage(selectedImage.url); }}
                   className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 active:scale-95 flex items-center gap-3 mx-auto"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                   Save visual unit
                 </button>
              </div>
           </div>
        </div>
      )}

      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-6 backdrop-blur-xl">
          <div className="w-full max-w-lg aspect-[3/4] rounded-[3rem] overflow-hidden bg-zinc-900 border-4 border-blue-600 shadow-2xl relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-10 inset-x-0 flex justify-center gap-6">
              <button onClick={() => setIsCameraOpen(false)} className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
              <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-90">
                <div className="w-12 h-12 border-4 border-zinc-900 rounded-full" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input section - Matched to chat view */}
      <div className="absolute bottom-0 inset-x-0 p-6 sm:p-12 bg-gradient-to-t from-white dark:from-[#080808] to-transparent pointer-events-none z-50">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className="relative bg-white dark:bg-[#121212] border-2 border-zinc-100 dark:border-white/5 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
            {baseImage && (
              <div className="p-4 bg-blue-600/5 flex items-center gap-4 border-b border-zinc-100 dark:border-white/5 animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border-2 border-white dark:border-zinc-800 shrink-0">
                  <img src={`data:${baseImage.mimeType};base64,${baseImage.data}`} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-blue-600">Image source locked</p>
                </div>
                <button onClick={() => setBaseImage(null)} className="p-2 text-zinc-400 hover:text-red-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round"/></svg>
                </button>
              </div>
            )}
            
            <div className="flex items-end gap-3 p-4">
              <div className="flex items-center gap-1">
                <button 
                  onClick={startCamera} 
                  className="p-4 text-zinc-400 hover:text-blue-600 transition-all active:scale-90"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2" strokeLinecap="round"/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="p-4 text-zinc-400 hover:text-blue-600 transition-all active:scale-90"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
              
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
              
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                placeholder="Describe your vision..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-base py-4 outline-none resize-none max-h-40 font-medium dark:text-white overflow-hidden"
                rows={1}
              />

              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="p-5 rounded-[1.8rem] bg-blue-600 text-white shadow-xl shadow-blue-600/30 disabled:opacity-20 active:scale-95 transition-all"
              >
                {isGenerating ? (
                   <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                ) : (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="3" strokeLinecap="round"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
