/**
 * The assistant's sheet: the conversation, a few starting questions, and the
 * box to ask in.
 *
 * Answers are rendered as plain text, never as HTML or markdown: a model's
 * output is untrusted, and a sentence needs no markup to be read.
 */

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { askQuestion, clearChat, useChatState } from './chat-store';
import type { AssistantProvider } from './useAssistantProvider';

const STARTERS = [
  'What is in my PC?',
  'What comes out this year?',
  'How much did I make last month?',
];

/** Long enough for any real question; short enough that a paste is not a prompt. */
const MAX_QUESTION_CHARS = 1000;

interface AssistantPanelProps {
  provider: AssistantProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close: the control that opened the panel, or the menu button it sat in. */
  returnFocusTo: () => HTMLElement | null;
}

export default function AssistantPanel({ provider, open, onOpenChange, returnFocusTo }: AssistantPanelProps) {
  const { pathname } = useLocation();
  const { entries, pending } = useChatState();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries.length, pending]);

  const submit = (question: string) => {
    if (pending || !question.trim()) return;
    void askQuestion(provider, question, pathname);
    setDraft('');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  // Enter asks; Shift+Enter is a new line, as in every chat box.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(draft);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden border-l border-border/40 bg-card p-0 text-foreground sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo()?.focus();
        }}
      >
        <SheetHeader className="space-y-1 border-b border-border/40 pb-4 pl-6 pr-14 pt-6 text-left">
          <SheetTitle className="font-sans text-base">Ask the site</SheetTitle>
          <SheetDescription className="font-sans text-xs">
            Reads finance, inventory and the watchlist; changes nothing. Every figure comes from
            the site&rsquo;s own calculations. Answered by {provider.label}.
          </SheetDescription>
        </SheetHeader>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4 font-sans text-sm"
          aria-live="polite"
          aria-busy={pending}
        >
          {entries.length === 0 && !pending ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">Try one of these, or ask your own.</p>
              <div className="flex flex-col items-start gap-2">
                {STARTERS.map(question => (
                  <Button
                    key={question}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-left"
                    onClick={() => submit(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            entries.map(item => (
              <div key={item.id} className={cn(item.role === 'user' && 'flex justify-end')}>
                {item.role === 'user' ? (
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-secondary px-4 py-2">
                    {item.text}
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className={cn('whitespace-pre-wrap break-words leading-relaxed', item.role === 'notice' && 'text-muted-foreground')}>
                      {item.text}
                    </p>
                    {item.sources && (
                      <p className="text-xs text-muted-foreground">From {item.sources.join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {pending && (
            <p role="status" className="flex items-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Working it out…
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-2 border-t border-border/40 px-6 py-4 font-sans">
          <label htmlFor="assistant-question" className="sr-only">Your question</label>
          <Textarea
            id="assistant-question"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={MAX_QUESTION_CHARS}
            placeholder="Ask about money, things you own, or what comes out"
            className="resize-none text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={clearChat}
              disabled={pending || entries.length === 0}
            >
              Clear
            </Button>
            <Button type="submit" size="sm" className="min-h-11" disabled={pending || !draft.trim()}>
              Ask
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
