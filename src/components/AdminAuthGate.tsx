import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import type { AdminAuthStatus } from '../types.ts';
import { setAdminToken } from '../utils/adminAuth.ts';

interface AdminAuthGateProps {
  setupRequired: boolean;
  onAuthenticated: (status: AdminAuthStatus) => void;
  onBackToPortal: () => void;
}

export function AdminAuthGate({
  setupRequired,
  onAuthenticated,
  onBackToPortal,
}: AdminAuthGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Indique um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }
    if (setupRequired && password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = setupRequired ? '/api/auth/setup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha na autenticação.');
      }
      const statusData = data as AdminAuthStatus;
      if (statusData.token) {
        setAdminToken(statusData.token);
      }
      onAuthenticated(statusData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <button
        type="button"
        onClick={onBackToPortal}
        className="inline-flex items-center gap-2 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao Jornal</span>
      </button>

      <div className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] p-8 space-y-6">
        <div className="space-y-2 border-b border-[#E6E1D6] dark:border-[#262932] pb-5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
            {setupRequired ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>
              {setupRequired ? 'Configuração Inicial Única' : 'Área Reservada à Direção'}
            </span>
          </div>

          <h1 className="font-serif text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9]">
            {setupRequired
              ? 'Definir Conta de Administrador'
              : 'Autenticação de Administrador'}
          </h1>

          <p className="text-xs text-[#635E56] dark:text-[#9B968C] leading-relaxed">
            {setupRequired
              ? 'Defina o e-mail e palavra-passe exclusivos do administrador. Após esta configuração inicial, apenas esta conta terá acesso ao painel editorial.'
              : 'O painel administrativo do Complice Week Lusophone é de acesso exclusivo ao administrador.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5"
            >
              E-mail do Administrador
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="administrador@compliceweek.com"
              className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5"
            >
              Palavra-passe
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={setupRequired ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#635E56] dark:text-[#9B968C] hover:text-[#171614] dark:hover:text-[#F2EFE9] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {setupRequired && (
            <div>
              <label
                htmlFor="admin-password-confirm"
                className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5"
              >
                Confirmar Palavra-passe
              </label>
              <input
                id="admin-password-confirm"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a palavra-passe"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-medium text-[#9A3412] dark:text-[#FB923C]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting
              ? 'A validar...'
              : setupRequired
              ? 'Guardar Conta e Aceder ao Painel'
              : 'Entrar no Painel Administrativo'}
          </button>
        </form>
      </div>
    </div>
  );
}
