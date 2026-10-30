import { CalendarCheck2 } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Vacaciones',
};

export default function VacacionesPage() {
  return (
    <div>
      <PageHeader
        title="Vacaciones"
        description="Solicitudes, saldos y aprobación de vacaciones del personal."
      />
      <EmptyState
        icon={<CalendarCheck2 className="h-6 w-6" />}
        title="Módulo de vacaciones"
        description="Las solicitudes y saldos de vacaciones se mostrarán aquí cuando ms-vacaciones esté integrado."
      />
    </div>
  );
}
