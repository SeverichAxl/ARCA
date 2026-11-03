'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import {
  AUTH_MODE,
  AUTH_NOTICE_KEY,
  hasAnyPermission,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ROUTE_PERMISSIONS,
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
      const landingPath = Object.entries(ROUTE_PERMISSIONS).find(([, permissions]) =>
        hasAnyPermission(session.user.permissions, permissions),
      )?.[0];
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
      {/* Encabezado del Formulario */}
      <div>
        <span
          className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            AUTH_MODE === 'mock'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {AUTH_MODE === 'mock' ? 'Modo mock · solo desarrollo' : 'Autenticación conectada'}
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Bienvenido de nuevo
        </h2>
        <p className="mt-2 text-base text-slate-500">
          Ingresa tus credenciales corporativas para continuar.
        </p>
      </div>

      {AUTH_MODE === 'mock' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Modo de prueba: selecciona uno de los siete roles. No se conecta al backend; puedes
          usar cualquier contraseña no vacía.
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {notice}
        </div>
      )}

      {/* Alerta de Error */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 animate-in fade-in"
        >
          {errorMessage}
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {AUTH_MODE === 'mock' && (
          <div className="space-y-2">
            <label htmlFor="mockRole" className="block text-sm font-semibold text-slate-700">
              Rol para probar
            </label>
            <select
              id="mockRole"
              value={mockRole}
              onChange={(event) => setMockRole(event.target.value as RoleCode)}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              {(Object.keys(ROLE_LABELS) as RoleCode[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Campo Usuario */}
        <div className="space-y-2">
          <label htmlFor="username" className="block text-sm font-semibold text-slate-700">
            Usuario
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
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
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </div>

        {/* Campo Contraseña */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
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
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-12 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
              className="text-sm font-medium text-blue-600 hover:text-blue-500 transition"
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
          className="h-12 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base shadow-lg shadow-blue-600/20 transition-all rounded-xl mt-4"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            'Iniciar sesión'
          )}
        </Button>
      </form>

      {/* Footer del Formulario */}
      <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-3 text-center text-xs text-slate-500">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="text-left">
          <span className="font-semibold block text-slate-700 text-xs">Conexión cifrada</span>
          <span className="text-[11px] text-slate-500">Tus datos están protegidos con cifrado TLS.</span>
        </div>
      </div>
    </div>
  );
}