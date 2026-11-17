import { getActiveMockDomains } from '@/lib/api/mock-status';

/**
 * Banner global fijo mientras exista al menos un dominio simulado.
 * Se calcula en build: NEXT_PUBLIC_* queda embebido en el bundle.
 */
export function MockBanner() {
  const domains = getActiveMockDomains();
  if (domains.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-[hsl(var(--warning)/0.4)] bg-background px-4 py-2 text-center font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[hsl(var(--warning))] shadow-[0_-8px_24px_rgba(0,0,0,0.5)]"
    >
      DATOS SIMULADOS: {domains.join(', ')}
      <span className="ml-2 font-normal normal-case tracking-normal text-[hsl(var(--warning)/0.7)]">
        No usar para decisiones reales.
      </span>
    </div>
  );
}
