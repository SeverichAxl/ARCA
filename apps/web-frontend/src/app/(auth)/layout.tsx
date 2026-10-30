import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-slate-700/40 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="hidden text-slate-100 lg:block">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-slate-200">
            <ShieldCheck className="h-4 w-4 text-blue-400" />
            Plataforma de gestión humana
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            ARCA Ltda.
            <span className="mt-3 block text-2xl font-normal text-slate-300">
              Un solo lugar para su equipo, contratos y nómina.
            </span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-6 text-slate-400">
            Acceso seguro para administración de personal, vacaciones, contratos y planillas.
          </p>
        </section>

        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-blue-950/40">
          {children}
        </div>
      </div>
    </div>
  );
}
