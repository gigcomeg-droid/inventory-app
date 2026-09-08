'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { useLocale } from '@/components/LocaleContext';

/**
 * Docked assistant chat panel. Renders a floating trigger button; clicking
 * it (or passing `openOnMount`) slides a chat panel in from the right.
 * Talks to the fully-local rule-based POST /api/assistant/query endpoint.
 */
export default function AssistantPanel({ openOnMount = false }) {
  const { t, locale } = useLocale();
  const DEFAULT_SUGGESTIONS = [
    t('assistant.suggestion1'),
    t('assistant.suggestion2'),
    t('assistant.suggestion3'),
    t('assistant.suggestion4'),
  ];
  const [open, setOpen] = useState(openOnMount);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: t('assistant.greeting'),
      items: [],
      suggestions: DEFAULT_SUGGESTIONS,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function ask(q) {
    const query = (q ?? input).trim();
    if (!query || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: query }]);
    setLoading(true);
    try {
      const res = await apiClient.post('/assistant/query', { q: query });
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: res?.answer || t('assistant.noResult'),
          items: res?.items || [],
          // Always use the UI's own translated suggestion chips rather than
          // whatever the backend sent — keeps chips correctly localized
          // regardless of which assistant backend (AI or local fallback)
          // answered this particular question.
          suggestions: DEFAULT_SUGGESTIONS,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: err.message || t('assistant.error'),
          items: [],
          suggestions: [],
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-glow transition hover:bg-brand-400"
        aria-label={t('assistant.openLabel')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 5h16v10H8l-4 4V5z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
          <circle cx="12" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="10" r="1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-base-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-base-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">{t('assistant.title')}</h2>
                <p className="text-xs text-base-100/40">{t('assistant.subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-base-100/50 hover:bg-white/5 hover:text-base-100"
                aria-label={t('assistant.closeLabel')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {messages.map((m, i) => (
                <ChatMessage key={i} message={m} onSuggestionClick={ask} />
              ))}
              {loading && (
                <div className="flex items-center gap-1.5 text-xs text-base-100/40">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
              className="flex items-center gap-2 border-t border-white/5 p-4"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('assistant.placeholder')}
                className="input-field"
              />
              <button type="submit" className="btn-primary shrink-0" disabled={loading || !input.trim()}>
                {t('assistant.ask')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ChatMessage({ message, onSuggestionClick }) {
  const { t } = useLocale();
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? 'bg-brand-500 text-white'
            : message.isError
            ? 'border border-accent-rose/30 bg-accent-rose/10 text-accent-rose'
            : 'border border-white/5 bg-white/5 text-base-100/90'
        }`}
      >
        <p>{message.text}</p>

        {Array.isArray(message.items) && message.items.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.items.slice(0, 8).map((it, i) => (
              <Link
                key={it.id || it.itemId || i}
                href={it.id || it.itemId ? `/items/${it.id || it.itemId}` : '#'}
                className="block rounded-lg border border-white/10 bg-base-950/40 px-2.5 py-1.5 text-xs transition hover:border-brand-500/40 hover:bg-base-950/70"
              >
                <span className="font-medium text-base-100">{it.name || it.sku || 'Item'}</span>
                {it.sku && <span className="ml-1.5 text-base-100/40">({it.sku})</span>}
                {(it.totalQuantity ?? it.quantity) !== undefined && (
                  <span className="ml-1.5 text-base-100/60">
                    · {it.totalQuantity ?? it.quantity} {it.unit || ''}
                  </span>
                )}
                {it.roomCode && (
                  <span className="ml-1.5 text-base-100/40">{t('assistant.inRoom', { room: it.roomCode })}</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {Array.isArray(message.suggestions) && message.suggestions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSuggestionClick(s)}
                className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-xs text-brand-300 transition hover:bg-brand-500/20"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
