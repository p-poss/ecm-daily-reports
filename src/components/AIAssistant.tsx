import { useState, useRef, useEffect, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { sendMessage, type ChatMessage, type ReportContext } from '@/lib/ai-assistant';
import { cn } from '@/lib/utils';

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
}

export function AIAssistant({ context, onToolCall }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        onClick={() => setIsOpen(true)}
        className="fixed top-1/2 -translate-y-1/2 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed top-1/2 -translate-y-1/2 right-6 z-50 w-[540px] max-w-[calc(100vw-3rem)]">
      <Card className="flex flex-col shadow-2xl p-0 max-h-[70dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Report Assistant</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-4 h-4" />
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
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
