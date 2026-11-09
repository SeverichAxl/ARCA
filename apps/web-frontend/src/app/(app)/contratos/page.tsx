import { FileSignature } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { PermissionGate } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { CONTRATOS_PLANTILLAS_PERMISSIONS } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Contratos',
};

export default function ContratosPage() {
  return (
    <div>
      <PageHeader
        title="Contratos"
        description="Administra las plantillas que sirven de base para los contratos laborales."
      />
      <EmptyState
        icon={<FileSignature className="h-6 w-6" />}
        title="Generación de contratos"
        description="La generación de contratos con datos de funcionarios se integrará cuando el servicio de contratos esté conectado. Mientras tanto, puedes administrar las plantillas."
        badge={null}
        action={
          <PermissionGate anyOf={CONTRATOS_PLANTILLAS_PERMISSIONS}>
            <Button asChild>
              <Link href="/contratos/plantillas">Ir a plantillas de contrato</Link>
            </Button>
          </PermissionGate>
        }
      />
    </div>
  );
}
