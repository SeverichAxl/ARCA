import { FileSignature } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Contratos',
};

export default function ContratosPage() {
  return (
    <div>
      <PageHeader
        title="Contratos"
        description="Consulta y administración de contratos laborales."
      />
      <EmptyState
        icon={<FileSignature className="h-6 w-6" />}
        title="Módulo de contratos"
        description="Los contratos, vigencias y documentos asociados se mostrarán aquí cuando ms-contratos esté integrado."
      />
    </div>
  );
}
