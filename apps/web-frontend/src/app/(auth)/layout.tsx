import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen w-full lg:grid-cols-12 bg-white overflow-hidden">
      
      {/* PANEL IZQUIERDO: Imagen clara y visible con overlay sutil */}
      <section className="relative hidden lg:col-span-5 lg:flex flex-col justify-between p-12 text-white bg-slate-900 overflow-hidden">
        
        {/* Imagen Corporativa con alta visibilidad */}
        <Image
          src="/start-up-project.jpg"
          alt="ARCA Ltda."
          fill
          priority
          sizes="50vw"
          className="object-cover object-center opacity-70"
        />

        {/* Gradiente sutil para legibilidad del texto sin oscurecer la imagen */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/30" />

        {/* Logo Superior */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative h-10 w-40">
            <Image
              src="/ARCA-logo.png"
              alt="ARCA Ltda."
              fill
              priority
              className="object-contain object-left drop-shadow-md"
            />
          </div>
        </div>

        {/* Textos Principales al Centro */}
        <div className="relative z-10 my-auto py-8 drop-shadow-sm">
          <span className="block text-xs font-bold uppercase tracking-widest text-blue-300 mb-4">
            SISTEMA DE GESTIÓN HUMANA
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            La confianza comienza con una gestión clara.
          </h1>
          <p className="mt-4 text-base text-slate-200 font-normal leading-relaxed max-w-md">
            Información protegida, decisiones responsables y personas en el centro.
          </p>
        </div>

        {/* Marca de Agua Geométrica (Esquina Inferior) */}
        <div className="absolute -bottom-16 -right-16 pointer-events-none opacity-30 z-10">
          <div className="h-72 w-72 border-2 border-blue-400/50 rotate-45 rounded-2xl flex items-center justify-center">
            <div className="h-48 w-48 border-2 border-blue-300/40 rounded-xl flex items-center justify-center">
              <div className="h-8 w-8 bg-blue-500 rotate-45" />
            </div>
          </div>
        </div>

        {/* Pie de Columna */}
        <div className="relative z-10 text-xs text-slate-300 font-mono">
          &copy; {new Date().getFullYear()} ARCA Ltda. &middot; La Paz, Bolivia
        </div>
      </section>

      {/* PANEL DERECHO: Formulario amplio ocupando todo el ancho disponible */}
      <section className="lg:col-span-7 flex min-h-screen items-center justify-center bg-white p-8 sm:p-16 lg:p-20">
        <div className="w-full max-w-xl">
          {children}
        </div>
      </section>

    </main>
  );
}