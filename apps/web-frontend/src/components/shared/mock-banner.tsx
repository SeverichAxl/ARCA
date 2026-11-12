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
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-950 shadow-[0_-4px_12px_rgba(15,23,42,0.12)]"
    >
      DATOS SIMULADOS: {domains.join(', ')}
      <span className="ml-2 font-normal text-amber-900">
        No usar para decisiones reales.
      </span>
    </div>
  );
}
