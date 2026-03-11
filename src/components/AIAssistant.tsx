import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { sendMessage, type ChatMessage, type ReportContext } from '@/lib/ai-assistant';
import { cn } from '@/lib/utils';

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
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[540px] max-w-[calc(100vw-3rem)]">
      <Card className="flex flex-col shadow-2xl p-0 max-h-[70dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
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
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
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
