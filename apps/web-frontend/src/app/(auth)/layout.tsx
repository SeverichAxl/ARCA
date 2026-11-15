import Image from 'next/image';

const MODULES = ['Personal', 'Nómina', 'Contratos', 'Vacaciones'];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen w-full bg-[#0b0714] lg:grid-cols-12">
      {/* PANEL IZQUIERDO: escena nocturna, horizonte y mensaje de marca */}
      <section className="cosmic relative hidden min-h-screen flex-col justify-between overflow-hidden p-12 text-white lg:col-span-6 lg:flex xl:p-14">
        <div className="starfield" aria-hidden="true" />
        <div className="orbit-grid" aria-hidden="true" />
        <div
          className="orbit-ring"
          aria-hidden="true"
          style={{ width: '44rem', height: '44rem', right: '-16rem', top: '12%' }}
        />
        <div
          className="orbit-ring"
          aria-hidden="true"
          style={{ width: '30rem', height: '30rem', right: '-9rem', top: '24%' }}
        />
        <div className="planet-horizon" aria-hidden="true" />

        <div className="enter relative z-10 flex items-center justify-between gap-4">
          <Image
            src="/ARCA-logo.png"
            alt="ARCA Ltda."
            width={1408}
            height={768}
            priority
            className="h-12 w-auto brightness-0 invert"
          />
          <span className="eyebrow hidden text-slate-400 xl:block">ARCA / GH</span>
        </div>

        <div className="enter enter-1 relative z-10 max-w-xl py-10">
          <span className="eyebrow inline-flex items-center gap-2 text-violet-300">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-violet-400" />
            Sistema de gestión humana
          </span>
          <p className="mt-6 font-display text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-white xl:text-[3.4rem]">
            La confianza comienza con una gestión clara.
          </p>
          <p className="mt-6 max-w-md text-base leading-relaxed text-slate-300">
            Información protegida, decisiones responsables y personas en el centro.
          </p>

          <div className="eyebrow mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-slate-400">
            {MODULES.map((module) => (
              <span key={module} className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-1 w-1 bg-violet-400" />
                {module}
              </span>
            ))}
          </div>
        </div>

        <div className="eyebrow relative z-10 flex items-center justify-between gap-4 text-slate-400">
          <span>&copy; {new Date().getFullYear()} ARCA Ltda.</span>
          <span>La Paz · Bolivia</span>
        </div>
      </section>

      {/* PANEL DERECHO: formulario de acceso */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden border-white/10 bg-[#120b22] p-6 sm:p-10 lg:col-span-6 lg:border-l xl:p-20">
        <div className="starfield opacity-40" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.24),transparent_65%)]"
        />

        <div className="enter enter-2 relative z-10 w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
