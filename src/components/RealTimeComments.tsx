import { useCallback, useEffect, useRef, useState } from 'react';
import { CornerDownRight, MessageSquare, Send, ThumbsUp, Users } from 'lucide-react';
import { useRealtimeSocket } from '../hooks/useWebSocket.ts';
import type { Comment, WsServerMessage } from '../types.ts';
import { formatRelativeTime } from '../utils/format.ts';

interface RealTimeCommentsProps {
  articleId: string;
  initialComments: Comment[];
  onCountChange?: (count: number) => void;
}

const AUTHOR_STORAGE_KEY = 'complice_reader_name';

export function RealTimeComments({
  articleId,
  initialComments,
  onCountChange,
}: RealTimeCommentsProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [activeReaders, setActiveReaders] = useState<number>(1);
  const [typingAuthors, setTypingAuthors] = useState<string[]>([]);
  const [authorName, setAuthorName] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    setComments(initialComments);
    setReplyingTo(null);
    setTypingAuthors([]);
  }, [articleId, initialComments]);

  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

  const handleWsMessage = useCallback(
    (msg: WsServerMessage) => {
      if (msg.type === 'comments:init' && msg.articleId === articleId) {
        setComments(msg.comments);
        setActiveReaders(msg.activeReaders);
      } else if (msg.type === 'presence:update' && msg.articleId === articleId) {
        setActiveReaders(msg.activeReaders);
      } else if (msg.type === 'typing:update' && msg.articleId === articleId) {
        setTypingAuthors((prev) => {
          if (msg.isTyping) {
            return prev.includes(msg.authorName) ? prev : [...prev, msg.authorName];
          }
          return prev.filter((name) => name !== msg.authorName);
        });
      } else if (msg.type === 'comment:created' && msg.articleId === articleId) {
        setComments((prev) => {
          if (prev.some((c) => c.id === msg.comment.id)) return prev;
          return [msg.comment, ...prev];
        });
      } else if (msg.type === 'comment:deleted' && msg.articleId === articleId) {
        setComments((prev) =>
          prev.filter((c) => c.id !== msg.commentId && c.parentId !== msg.commentId)
        );
      } else if (msg.type === 'comment:liked' && msg.articleId === articleId) {
        setComments((prev) =>
          prev.map((c) => (c.id === msg.commentId ? { ...c, likes: msg.likes } : c))
        );
      } else if (msg.type === 'error') {
        setError(msg.message);
      }
    },
    [articleId]
  );

  const { status, sendMessage } = useRealtimeSocket(handleWsMessage);

  useEffect(() => {
    sendMessage({ type: 'join_article', articleId });
    return () => {
      if (isTypingRef.current && authorName.trim()) {
        sendMessage({
          type: 'typing',
          articleId,
          authorName: authorName.trim(),
          isTyping: false,
        });
      }
      sendMessage({ type: 'leave_article', articleId });
    };
  }, [articleId, sendMessage, authorName]);

  function handleBodyChange(nextValue: string) {
    setContent(nextValue);
    const cleanName = authorName.trim();
    if (!cleanName || status !== 'connected') return;

    if (!isTypingRef.current && nextValue.trim().length > 0) {
      isTypingRef.current = true;
      sendMessage({ type: 'typing', articleId, authorName: cleanName, isTyping: true });
    }

    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendMessage({ type: 'typing', articleId, authorName: cleanName, isTyping: false });
      }
    }, 1800);
  }

  async function handleLikeComment(commentId: string) {
    if (likedIds.has(commentId)) return;
    setLikedIds((prev) => new Set(prev).add(commentId));
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}/like`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = (await res.json()) as { likes: number };
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, likes: data.likes } : c))
        );
      }
    } catch {
      // Ignore transient error
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanName = authorName.trim();
    const cleanContent = content.trim();

    if (cleanName.length < 2) {
      setError('Por favor, indique o seu nome (mínimo 2 caracteres).');
      return;
    }
    if (cleanContent.length < 2) {
      setError('Escreva o seu comentário antes de publicar.');
      return;
    }

    try {
      localStorage.setItem(AUTHOR_STORAGE_KEY, cleanName);
    } catch {
      // Ignore storage failures
    }

    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendMessage({ type: 'typing', articleId, authorName: cleanName, isTyping: false });
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: cleanName,
          content: cleanContent,
          parentId: replyingTo?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível enviar o comentário.');
      }
      setComments((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev;
        return [data as Comment, ...prev];
      });
      setContent('');
      setReplyingTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar comentário.');
    } finally {
      setSubmitting(false);
    }
  }

  const rootComments = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parentId) {
      const list = repliesByParent.get(c.parentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentId, list);
    }
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return (
    <section
      aria-labelledby="comentarios-heading"
      className="mt-14 pt-10 border-t border-[#E6E1D6] dark:border-[#262932]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} />
          <h2 id="comentarios-heading" className="font-serif text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9]">
            Debate dos Leitores
          </h2>
          <span className="font-mono text-xs text-[#635E56] dark:text-[#9B968C] tabular-nums">
            ({comments.length})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#635E56] dark:text-[#9B968C]">
          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
            <Users className="w-3.5 h-3.5 text-[#47433D] dark:text-[#C5BFB4]" />
            <span>
              {activeReaders} {activeReaders === 1 ? 'leitor ativo' : 'leitores ativos'}
            </span>
          </span>

          <span className="inline-flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected' ? 'bg-[#15803D] dark:bg-[#4ADE80]' : 'bg-[#B45309] dark:bg-[#F59E0B]'
              }`}
              aria-hidden="true"
            />
            <span>
              {status === 'connected'
                ? 'Ligado em tempo real'
                : 'A restabelecer ligação em tempo real'}
            </span>
          </span>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] p-6 mb-8 space-y-4"
      >
        {replyingTo && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#F6F2EA] dark:bg-[#1D2027] border border-[#E6E1D6] dark:border-[#2F333E] text-xs text-[#47433D] dark:text-[#C5BFB4]">
            <span className="truncate">
              A responder a <strong className="text-[#171614] dark:text-[#F2EFE9]">{replyingTo.authorName}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-[#9A3412] dark:text-[#FB923C] font-medium hover:underline cursor-pointer shrink-0"
            >
              Cancelar resposta
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="comment-author"
              className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5"
            >
              O seu nome
            </label>
            <input
              id="comment-author"
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Ex.: Ana Beatriz Mendes"
              maxLength={80}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
            />
          </div>
          <div className="flex items-end">
            <p className="text-xs text-[#635E56] dark:text-[#9B968C] leading-relaxed">
              Os comentários surgem instantaneamente para todos os leitores que acompanham esta reportagem.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="comment-body"
            className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5"
          >
            {replyingTo ? 'A sua resposta' : 'Comentário'}
          </label>
          <textarea
            id="comment-body"
            rows={3}
            value={content}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder={
              replyingTo
                ? `Responder a ${replyingTo.authorName}...`
                : 'Partilhe a sua análise ou perspetiva sobre este artigo...'
            }
            maxLength={2000}
            className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA] resize-y"
          />
        </div>

        {typingAuthors.length > 0 && (
          <p className="text-xs italic text-[#635E56] dark:text-[#9B968C]">
            {typingAuthors.join(', ')} {typingAuthors.length === 1 ? 'está a escrever...' : 'estão a escrever...'}
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs font-medium text-[#9A3412] dark:text-[#FB923C]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="font-mono text-xs text-[#8C8478] dark:text-[#78746D] tabular-nums">
            {content.length}/2000
          </span>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {submitting
                ? 'A publicar...'
                : replyingTo
                ? 'Publicar Resposta'
                : 'Publicar Comentário'}
            </span>
          </button>
        </div>
      </form>

      {rootComments.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-[#D8D1C5] dark:border-[#2F333E] bg-[#F6F2EA] dark:bg-[#16181D]">
          <p className="text-sm text-[#635E56] dark:text-[#9B968C]">
            Ainda não existem comentários neste artigo. Seja o primeiro leitor a abrir o debate.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E6E1D6] dark:divide-[#262932] border-t border-b border-[#E6E1D6] dark:border-[#262932]">
          {rootComments.map((comment) => {
            const replies = repliesByParent.get(comment.id) ?? [];
            const hasLiked = likedIds.has(comment.id);

            return (
              <article key={comment.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-[#171614] dark:text-[#F2EFE9]">
                    {comment.authorName}
                  </span>
                  <time
                    dateTime={comment.createdAt}
                    className="font-mono text-xs text-[#635E56] dark:text-[#9B968C] tabular-nums"
                  >
                    {formatRelativeTime(comment.createdAt)}
                  </time>
                </div>

                <p className="text-[15px] leading-relaxed text-[#2F2C27] dark:text-[#D6D2C9] whitespace-pre-line mb-3">
                  {comment.content}
                </p>

                <div className="flex items-center gap-4 text-xs text-[#635E56] dark:text-[#9B968C]">
                  <button
                    type="button"
                    onClick={() => handleLikeComment(comment.id)}
                    disabled={hasLiked}
                    className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      hasLiked
                        ? 'text-[#1E3A8A] dark:text-[#60A5FA] font-semibold'
                        : 'hover:text-[#171614] dark:hover:text-white'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">
                      Útil ({comment.likes ?? 0})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(comment);
                      document.getElementById('comment-body')?.focus();
                    }}
                    className="inline-flex items-center gap-1 hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] transition-colors cursor-pointer"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    <span>Responder</span>
                  </button>
                </div>

                {replies.length > 0 && (
                  <div className="mt-4 ml-5 pl-5 border-t border-[#EBE6DF] dark:border-[#262932] divide-y divide-[#EBE6DF] dark:divide-[#262932]">
                    {replies.map((reply) => {
                      const replyLiked = likedIds.has(reply.id);
                      return (
                        <div key={reply.id} className="py-3.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-[#171614] dark:text-[#F2EFE9]">
                              {reply.authorName}
                            </span>
                            <time
                              dateTime={reply.createdAt}
                              className="font-mono text-[11px] text-[#635E56] dark:text-[#9B968C] tabular-nums"
                            >
                              {formatRelativeTime(reply.createdAt)}
                            </time>
                          </div>
                          <p className="text-sm leading-relaxed text-[#2F2C27] dark:text-[#D6D2C9] whitespace-pre-line mb-2">
                            {reply.content}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleLikeComment(reply.id)}
                            disabled={replyLiked}
                            className={`inline-flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                              replyLiked
                                ? 'text-[#1E3A8A] dark:text-[#60A5FA] font-semibold'
                                : 'text-[#635E56] dark:text-[#9B968C] hover:text-[#171614] dark:hover:text-white'
                            }`}
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span className="font-mono tabular-nums">
                              Útil ({reply.likes ?? 0})
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
