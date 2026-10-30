import { UserRoundPlus } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Personal',
};

export default function PersonalPage() {
  return (
    <div>
      <PageHeader
        title="Personal"
        description="Administración de empleados, cargos y datos laborales."
      />
      <EmptyState
        icon={<UserRoundPlus className="h-6 w-6" />}
        title="Módulo de personal"
        description="Aquí se listarán y gestionarán los empleados de ARCA Ltda. La integración con ms-personal se hará en una historia posterior."
      />
    </div>
  );
}
