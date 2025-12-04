import React, { useEffect, useRef } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import AudioVisualizer from './components/AudioVisualizer';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
);

const MicOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" x2="23" y1="1" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
)

const App: React.FC = () => {
  const { isConnected, connect, disconnect, messages, volume, error } = useGeminiLive();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-emerald-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center text-emerald-900 font-bold text-xl border-2 border-white">
                    ق
                </div>
                <div>
                    <h1 className="text-2xl font-bold font-serif tracking-wide">QaseemAiwala</h1>
                    <p className="text-emerald-200 text-xs">Islamic Scholar Assistant (Urdu)</p>
                </div>
            </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
            <span className="text-sm font-medium hidden sm:block">
                {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 flex flex-col gap-4 overflow-hidden h-[calc(100vh-140px)]">
        
        {/* Intro Card (Only if no messages) */}
        {messages.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 space-y-6 animate-fade-in p-6">
            <div className="bg-emerald-100 p-6 rounded-full text-emerald-800 mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">السلام علیکم</h2>
            <p className="max-w-md text-lg leading-relaxed">
              میں <strong>قاسم اے آئی والا</strong> ہوں۔ آپ مجھ سے احادیث کے بارے میں سوال کر سکتے ہیں۔<br/>
              میں احادیث کی تصدیق کروں گا اور اب میں <strong>تصویر بھی بنا سکتا ہوں</strong>۔
            </p>
            <p className="text-sm text-slate-400">
              بات کرنے کے لیے نیچے دیے گئے مائکروفون بٹن کو دبائیں۔
            </p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
            <div className="w-6 h-6"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg></div>
            <span>{error}</span>
          </div>
        )}

        {/* Chat Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-6 p-2 scrollbar-hide">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm text-lg leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                }`}
              >
                {/* Render Image if available */}
                {msg.image && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-slate-200">
                    <img src={msg.image} alt="Generated" className="w-full h-auto" />
                  </div>
                )}
                
                {/* Render Text */}
                {msg.text ? (
                   <div>{msg.text}</div>
                ) : (
                    // Only show loading ellipsis if no text AND no image
                    !msg.image && <span className="italic opacity-50 text-sm">...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Control Footer */}
      <footer className="bg-white border-t border-slate-200 p-4 sticky bottom-0">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          
          {/* Visualizer Area */}
          <div className="h-12 w-full flex items-center justify-center">
             <AudioVisualizer volume={volume} isActive={isConnected} />
          </div>

          {/* Main Button */}
          <button
            onClick={handleToggle}
            className={`
              relative group flex items-center justify-center w-16 h-16 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95
              ${isConnected 
                ? 'bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-100' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-100'
              }
            `}
          >
            {isConnected ? <MicOffIcon /> : <MicIcon />}
            
            {/* Tooltip */}
            {!isConnected && messages.length === 0 && (
                <span className="absolute -top-10 bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg animate-bounce">
                    شروع کرنے کے لیے دبائیں
                </span>
            )}
          </button>
          
          <p className="text-xs text-slate-400">
            {isConnected ? 'بولنا بند کرنے کے لیے دبائیں' : 'بات کرنے کے لیے مائک دبائیں'}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;