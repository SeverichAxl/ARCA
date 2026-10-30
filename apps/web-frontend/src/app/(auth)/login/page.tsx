import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
};

export default function LoginPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">ARCA Ltda.</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Iniciar sesión
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Ingrese con sus credenciales corporativas para continuar.
        </p>
      </div>

      <form className="space-y-5" action="/dashboard">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="usuario@arca.com"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Contraseña
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </div>

        <Button asChild className="w-full">
          <Link href="/dashboard">
            Ingresar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Autenticación disponible en la siguiente iteración.
      </p>
    </div>
  );
}
