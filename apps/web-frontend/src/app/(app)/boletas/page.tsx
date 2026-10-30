import { ReceiptText } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Boletas',
};

export default function BoletasPage() {
  return (
    <div>
      <PageHeader
        title="Boletas"
        description="Consulta de boletas de pago y planillas del personal."
      />
      <EmptyState
        icon={<ReceiptText className="h-6 w-6" />}
        title="Módulo de boletas"
        description="Las boletas de pago se mostrarán aquí cuando ms-planillas esté integrado."
      />
    </div>
  );
}
