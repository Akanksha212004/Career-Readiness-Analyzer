import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { useCareerStore } from '@/store/useCareerStore';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_REPLIES = [
  "What skills should I learn?",
  "Suggest project ideas",
  "Best courses for me",
  "How to improve ATS score?",
  "Interview preparation tips",
  "How is my score calculated?",
];

const RobotIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="8" width="14" height="10" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="8" y="11" width="2.5" height="2.5" rx="0.5" fill="currentColor"/>
    <rect x="13.5" y="11" width="2.5" height="2.5" rx="0.5" fill="currentColor"/>
    <path d="M9.5 15.5 Q12 17 14.5 15.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <path d="M12 8 L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
    <path d="M5 12 L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M19 12 L21 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ChatBot = () => {
  const { selectedRole } = useCareerStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      content: `Hi! 👋 I'm your AI Career Counselor. Ask me about skills, projects, courses, or interview tips for **${selectedRole || 'your target role'}**.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setShowQuick(false);

    const userMsg: Message = { id: Date.now(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Points directly to Python ML Service on Port 8000
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          role: selectedRole || 'frontend', // Fallback role
          history: messages.slice(-6).map((m) => ({ 
            role: m.role === 'assistant' ? 'assistant' : 'user', 
            content: m.content 
          })),
        }),
      });

      if (!res.ok) throw new Error("Server responded with an error");

      const data = await res.json();
      const reply = data.reply || "I'm sorry, I couldn't process that right now.";

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: reply },
      ]);
    } catch (error) {
      console.error("Chatbot Error:", error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: "Connection error. Please ensure the Python ML service is running on port 8000." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatMessage = (text: string) => {
    return text.split('\n').map((line, lineIdx) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={lineIdx}>
          {parts.map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={i} className="font-semibold text-primary">{part.slice(2, -2)}</strong>
              : <span key={i}>{part}</span>
          )}
          {lineIdx < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen((v) => !v)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6 text-white" />
            </motion.div>
          ) : (
            <motion.div key="robot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <RobotIcon size={28} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
        {!isOpen && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(34,197,94,0.35)' }} />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl bg-card shadow-2xl ring-1 ring-border overflow-hidden"
            style={{ width: '360px', height: '520px' }}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3" style={{ background: 'linear-gradient(135deg, #22c55e15, #16a34a10)' }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                <RobotIcon size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Career Counselor</p>
                <p className="text-xs text-muted-foreground">{selectedRole ? `Helping with: ${selectedRole}` : 'Online'}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${msg.role === 'assistant' ? '' : 'bg-muted'}`} style={msg.role === 'assistant' ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)' } : {}}>
                    {msg.role === 'assistant' ? <RobotIcon size={16} className="text-white" /> : <span className="text-xs font-medium">U</span>}
                  </div>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${msg.role === 'user' ? 'text-white rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`} style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)' } : {}}>
                    {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
                  </div>
                </motion.div>
              ))}
              {loading && <div className="text-xs text-muted-foreground animate-pulse">AI is thinking...</div>}
              <div ref={bottomRef} />
            </div>

            {showQuick && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {QUICK_REPLIES.slice(0, 4).map((q) => (
                  <button key={q} onClick={() => sendMessage(q)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-green-50 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-border p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none"
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} className="h-9 w-9 flex items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatBot;