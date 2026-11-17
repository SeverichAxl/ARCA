'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock, User, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import {
  AUTH_MODE,
  AUTH_NOTICE_KEY,
  getLandingPath,
  ROLE_LABELS,
  type RoleCode,
} from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [mockRole, setMockRole] = useState<RoleCode>('FUNCIONARIO');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const storedNotice = sessionStorage.getItem(AUTH_NOTICE_KEY);
    if (storedNotice) {
      setNotice(storedNotice);
      sessionStorage.removeItem(AUTH_NOTICE_KEY);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await login(
        formData.username.trim(),
        formData.password,
        AUTH_MODE === 'mock' ? mockRole : undefined,
      );
      const landingPath = getLandingPath(session.user.role, session.user.permissions);
      router.replace(landingPath ?? '/acceso-denegado');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error al iniciar sesión. Intente nuevamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <div className="lg:hidden">
        <Image
          src="/ARCA-logo.png"
          alt="ARCA Ltda."
          width={1408}
          height={768}
          priority
          className="arca-logo h-9 w-auto"
        />
      </div>

      {/* Encabezado del Formulario */}
      <div>
        <span
          className={`eyebrow mb-4 inline-flex items-center gap-2 rounded-[3px] border px-2.5 py-1 text-[10px] ${
            AUTH_MODE === 'mock'
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
          }`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          {AUTH_MODE === 'mock' ? 'Modo mock · solo desarrollo' : 'Autenticación conectada'}
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
          Bienvenido de nuevo
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Ingresa tus credenciales corporativas para continuar.
        </p>
      </div>

      {AUTH_MODE === 'mock' && (
        <div className="rounded-[4px] border border-amber-400/25 bg-amber-400/[0.07] p-4 text-sm leading-relaxed text-amber-200">
          Modo de prueba: selecciona uno de los siete roles. No se conecta al backend; puedes
          usar cualquier contraseña no vacía.
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-[4px] border border-amber-400/25 bg-amber-400/[0.07] p-4 text-sm text-amber-200"
        >
          {notice}
        </div>
      )}

      {/* Alerta de Error */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-[4px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200 animate-in fade-in"
        >
          {errorMessage}
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {AUTH_MODE === 'mock' && (
          <div className="space-y-2">
            <label htmlFor="mockRole" className="eyebrow block text-slate-400">
              Rol para probar
            </label>
            <select
              id="mockRole"
              value={mockRole}
              onChange={(event) => setMockRole(event.target.value as RoleCode)}
              className="h-12 w-full rounded-[4px] border border-white/10 bg-muted px-4 text-base text-white outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-ring/25"
            >
              {(Object.keys(ROLE_LABELS) as RoleCode[]).map((role) => (
                <option key={role} value={role} className="bg-card text-white">
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Campo Usuario */}
        <div className="space-y-2">
          <label htmlFor="username" className="eyebrow block text-slate-400">
            Usuario
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="username"
              name="username"
              type="text"
              required
              maxLength={100}
              autoComplete="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Ingresa tu usuario corporativo"
              className="h-12 w-full rounded-[4px] border border-white/10 bg-white/[0.04] pl-11 pr-4 text-base text-white placeholder-slate-400 outline-none transition focus:border-primary/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-ring/25"
            />
          </div>
        </div>

        {/* Campo Contraseña */}
        <div className="space-y-2">
          <label htmlFor="password" className="eyebrow block text-slate-400">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              maxLength={200}
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Ingresa tu contraseña"
              className="h-12 w-full rounded-[4px] border border-white/10 bg-white/[0.04] pl-11 pr-12 text-base text-white placeholder-slate-400 outline-none transition focus:border-primary/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-ring/25"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[3px] p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {AUTH_MODE !== 'mock' && (
            <div className="flex justify-end pt-1">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Contacte al administrador de TI para restablecer su contraseña.');
                }}
                className="text-sm font-medium text-violet-300 underline-offset-4 transition hover:text-violet-200 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          )}
        </div>

        {/* Botón Iniciar Sesión */}
        <Button
          type="submit"
          disabled={isLoading}
          className="group mt-4 h-12 w-full rounded-[4px] bg-primary text-base font-semibold text-primary-foreground shadow-[0_14px_40px_-18px_hsl(var(--primary)/0.85)] transition-all hover:bg-primary-hover"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            <>
              Iniciar sesión
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      {/* Footer del Formulario */}
      <div className="flex items-center justify-center gap-3 border-t border-white/10 pt-6 text-center">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
        <div className="text-left">
          <span className="eyebrow block text-[10px] text-slate-300">Conexión cifrada</span>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            Tus datos están protegidos con cifrado TLS.
          </span>
        </div>
      </div>
    </div>
  );
}