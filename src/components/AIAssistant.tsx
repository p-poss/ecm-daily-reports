import { useState, useRef, useEffect, useCallback, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Minus, ArrowUp, Loader2, Mic } from 'lucide-react';
import { AIIcon } from '@/components/icons/AIIcon';
import { sendMessage, type ChatMessage, type ReportContext } from '@/lib/ai-assistant';
import { cn } from '@/lib/utils';

// Minimal Web Speech API types
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognition;
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const DRAG_THRESHOLD = 8; // pixels moved before it counts as a drag

function useDraggable(initialPosition: { x: number; y: number }, containerRef?: React.RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState(initialPosition);
  const dragging = useRef(false);
  const wasDragged = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const clamp = useCallback((x: number, y: number, el: HTMLElement) => {
    // Use container ref if available (for panel), otherwise use the element itself (for FAB)
    const sizeEl = containerRef?.current ?? el;
    const rect = sizeEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Measure header and footer to keep the element between them
    const header = document.querySelector('header');
    const footer = document.querySelector('[class*="fixed bottom-0"]');
    const minY = header ? header.getBoundingClientRect().bottom + 4 : 4;
    const maxY = (footer ? footer.getBoundingClientRect().top : vh) - rect.height - 4;
    const clampedX = Math.max(4, Math.min(vw - rect.width - 4, x));
    const clampedY = Math.max(minY, Math.min(maxY, y));
    return { x: clampedX, y: clampedY };
  }, [containerRef]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    // Only drag with primary button / single touch
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    dragging.current = true;
    wasDragged.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...position };
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (!wasDragged.current && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    wasDragged.current = true;
    const el = e.currentTarget;
    const newPos = clamp(startOffset.current.x + dx, startOffset.current.y + dy, el);
    setPosition(newPos);
  }, [clamp]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return {
    position,
    setPosition,
    wasDragged,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}

const markdownComponents: Components = {
  p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-2 last:mb-0 leading-relaxed" {...props}>{children}</p>
  ),
  strong: ({ children, ...props }: ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold text-foreground" {...props}>{children}</strong>
  ),
  ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => (
    <ul className="mb-2 last:mb-0 ml-4 space-y-1 list-disc marker:text-muted-foreground" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => (
    <ol className="mb-2 last:mb-0 ml-4 space-y-1 list-decimal marker:text-muted-foreground" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => (
    <li className="pl-1 leading-relaxed" {...props}>{children}</li>
  ),
  h1: ({ children, ...props }: ComponentPropsWithoutRef<'h1'>) => (
    <h1 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props}>{children}</h3>
  ),
  code: ({ children, className, ...props }: ComponentPropsWithoutRef<'code'>) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <pre className="mb-2 last:mb-0 rounded-md bg-background/60 border px-3 py-2 overflow-x-auto">
          <code className="text-xs font-mono" {...props}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-background/60 border px-1 py-0.5 text-xs font-mono" {...props}>{children}</code>
    );
  },
  hr: (props: ComponentPropsWithoutRef<'hr'>) => (
    <hr className="my-2 border-border" {...props} />
  ),
  blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="mb-2 last:mb-0 border-l-2 border-primary/40 pl-3 text-muted-foreground italic" {...props}>{children}</blockquote>
  ),
};

interface AIAssistantProps {
  context: ReportContext;
  onToolCall: (name: string, input: Record<string, unknown>) => void;
  onBeforeToolCalls?: () => void;
}

export function AIAssistant({ context, onToolCall, onBeforeToolCalls }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check if Web Speech API is supported
  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  function startListening() {
    if (!speechSupported) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      setInput((finalTranscript + interim).trim());
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function handleMicClick() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  // Default position: right side, vertically centered
  const { position, setPosition, wasDragged, handlers } = useDraggable({
    x: typeof window !== 'undefined' ? window.innerWidth - 80 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 - 28 : 0,
  }, panelRef);

  // Keep in-bounds on resize
  useEffect(() => {
    function onResize() {
      setPosition((prev) => {
        const header = document.querySelector('header');
        const footer = document.querySelector('[class*="fixed bottom-0"]');
        const minY = header ? header.getBoundingClientRect().bottom + 4 : 4;
        const maxY = (footer ? footer.getBoundingClientRect().top : window.innerHeight) - 60;
        return {
          x: Math.max(4, Math.min(prev.x, window.innerWidth - 60)),
          y: Math.max(minY, Math.min(prev.y, maxY)),
        };
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setPosition]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const result = await sendMessage(newMessages, context);

      // Execute tool calls
      if (result.toolCalls.length > 0) {
        onBeforeToolCalls?.();
      }
      for (const tool of result.toolCalls) {
        onToolCall(tool.name, tool.input);
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.response || (result.toolCalls.length > 0 ? 'Done!' : 'I couldn\'t process that request.'),
      };
      setMessages([...newMessages, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Something went wrong. Check your API key.'}`,
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        {...handlers}
        onClick={() => {
          if (!wasDragged.current) setIsOpen(true);
        }}
        style={{ left: position.x, top: position.y, boxShadow: '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)' }}
        className="fixed z-50 w-14 h-14 rounded-xl bg-primary text-white dark:text-muted-foreground hover:bg-primary/90 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <AIIcon className="w-9 h-9 pointer-events-none" />
      </button>
    );
  }

  // Clamp panel position so it stays between header and footer
  const headerEl = document.querySelector('header');
  const footerEl = document.querySelector('[class*="fixed bottom-0"]');
  const panelMinY = headerEl ? headerEl.getBoundingClientRect().bottom + 4 : 4;
  const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 400;
  const panelMaxY = (footerEl ? footerEl.getBoundingClientRect().top : window.innerHeight) - panelHeight - 4;
  const panelX = Math.min(position.x, window.innerWidth - Math.min(540, window.innerWidth - 48) - 8);
  const panelY = Math.max(panelMinY, Math.min(position.y, panelMaxY));

  return (
    <div
      ref={panelRef}
      style={{ left: panelX, top: panelY }}
      className="fixed z-50 w-[540px] max-w-[calc(100vw-3rem)]"
    >
      <Card className="flex flex-col shadow-2xl p-0 max-h-[70dvh]">
        {/* Header — draggable handle */}
        <div
          {...handlers}
          className="flex items-center justify-between px-4 py-3 border-b cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <AIIcon className="w-5 h-5 text-[#E76E4B]" />
            <span className="font-semibold text-sm">Report Claude</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setIsOpen(false)}
          >
            <Minus className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              <p>Hi! I can help you fill out this report.</p>
              <p className="mt-2 text-xs">Try: &quot;Add John and Mike with 8 hours each&quot; or &quot;Set weather to sunny&quot;</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'text-sm rounded-lg px-3 py-2',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-auto max-w-[85%]'
                  : 'bg-muted mr-auto max-w-full'
              )}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          ))}
          {isLoading && (
            <div className="bg-muted rounded-lg px-3 py-2 max-w-[85%] mr-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what to fill out..."
              className="text-sm"
              disabled={isLoading}
            />
            {input.trim() ? (
              <Button
                type="submit"
                size="icon"
                disabled={isLoading}
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={handleMicClick}
                disabled={isLoading || !speechSupported}
                title={speechSupported ? (isListening ? 'Stop listening' : 'Start voice input') : 'Voice input not supported in this browser'}
                className={isListening ? 'animate-pulse' : ''}
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}
          </form>
        </div>
      </Card>
    </div>
  );
}
