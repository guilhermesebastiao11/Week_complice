import { useState } from 'react';
import { CheckCircle2, Lock, Mail, Moon, Sun } from 'lucide-react';
import type { Category } from '../types.ts';
import { FontScaleControl, type FontScaleOption } from './FontScaleControl.tsx';

interface NewsletterFooterProps {
  categories: Category[];
  theme: 'dark' | 'light';
  fontScale: FontScaleOption;
  onToggleTheme: () => void;
  onChangeFontScale: (scale: FontScaleOption) => void;
  onSelectCategory: (slug: string) => void;
  onOpenAdmin: () => void;
}

export function NewsletterFooter({
  categories,
  theme,
  fontScale,
  onToggleTheme,
  onChangeFontScale,
  onSelectCategory,
  onOpenAdmin,
}: NewsletterFooterProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setFeedback({
        type: 'error',
        message: 'Por favor, introduza um endereço de e-mail válido.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível concluir a assinatura.');
      }
      if (data.alreadySubscribed) {
        setFeedback({
          type: 'info',
          message: 'Este endereço de e-mail já se encontra inscrito na nossa edição semanal.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: 'Assinatura confirmada. Receberá os destaques da Complice Week Lusophone por e-mail.',
        });
        setEmail('');
        setName('');
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao subscrever a newsletter.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <footer className="border-t border-[#E6E1D6] dark:border-[#262932] bg-[#F3EFE6] dark:bg-[#13151A] mt-16 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Editorial Brand & Sections */}
          <div className="lg:col-span-6 space-y-5">
            <div>
              <h2 className="font-serif text-xl font-bold text-[#171614] dark:text-[#F2EFE9]">
                Complice Week Lusophone
              </h2>
              <p className="text-sm text-[#47433D] dark:text-[#A9A398] leading-relaxed mt-2 max-w-md">
                Jornalismo independente, análise de risco, compliance, economia, cultura e inovação em todo o espaço lusófono — de Luanda a Lisboa, São Paulo, Maputo e Mindelo.
              </p>
            </div>

            {categories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#635E56] dark:text-[#8E887E] mb-2.5">
                  Secções Editoriais
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#47433D] dark:text-[#C5BFB4]">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onSelectCategory(cat.slug)}
                      className="hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] hover:underline transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Newsletter Subscription Form */}
          <div className="lg:col-span-6 bg-white dark:bg-[#191C23] border border-[#E6E1D6] dark:border-[#2A2D36] p-6 sm:p-7">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] mb-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Edição Semanal por E-mail</span>
            </div>

            <h3 className="font-serif text-xl font-semibold text-[#171614] dark:text-[#F2EFE9]">
              Assine a Newsletter Complice Week
            </h3>
            <p className="text-xs text-[#635E56] dark:text-[#A9A398] leading-relaxed mt-1 mb-5">
              Receba as principais reportagens, análises de Compliance Officer e entrevistas exclusivas diretamente na sua caixa de entrada.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-3" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label htmlFor="newsletter-name" className="sr-only">
                    Nome (opcional)
                  </label>
                  <input
                    id="newsletter-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="O seu nome (opcional)"
                    maxLength={80}
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                  />
                </div>

                <div className="sm:col-span-7">
                  <label htmlFor="newsletter-email" className="sr-only">
                    Endereço de e-mail
                  </label>
                  <input
                    id="newsletter-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="o.seu.email@exemplo.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-[#635E56] dark:text-[#8E887E]">
                  Sem spam. Cancelamento disponível a qualquer momento.
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {submitting ? 'A subscrever...' : 'Subscrever Newsletter'}
                </button>
              </div>

              {feedback && (
                <div
                  role={feedback.type === 'error' ? 'alert' : 'status'}
                  className={`flex items-start gap-2 pt-2 text-xs font-medium ${
                    feedback.type === 'error'
                      ? 'text-[#9A3412] dark:text-[#FB923C]'
                      : feedback.type === 'info'
                      ? 'text-[#1E3A8A] dark:text-[#60A5FA]'
                      : 'text-[#15803D] dark:text-[#4ADE80]'
                  }`}
                >
                  {feedback.type !== 'error' && (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Bottom Copyright & Utility Bar */}
        <div className="pt-6 border-t border-[#E6E1D6] dark:border-[#262932] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#635E56] dark:text-[#9B968C]">
          <span>Todos os direitos reservados a complice week 2026</span>

          <div className="flex flex-wrap items-center gap-3">
            <FontScaleControl fontScale={fontScale} onChangeFontScale={onChangeFontScale} />

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#D8D1C5] dark:border-[#2F333E] bg-white dark:bg-[#191C23] text-[#171614] dark:text-[#F2EFE9] hover:border-[#171614] dark:hover:border-[#60A5FA] transition-colors cursor-pointer whitespace-nowrap"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Modo Escuro</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenAdmin}
              title="Acesso Administrativo"
              aria-label="Acesso Administrativo"
              className="p-2 text-[#8C8478] dark:text-[#8E887E] hover:text-[#171614] dark:hover:text-[#F2EFE9] transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
