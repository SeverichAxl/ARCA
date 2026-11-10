'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  VacationApprovalList,
  VacationBalanceCards,
  VacationRequestDialog,
  VacationRequestList,
} from '@/components/vacation/vacation-components';
import { VacationCalendar } from '@/components/vacation/vacation-calendar';
import { useVacations } from '@/hooks/use-vacation';
import { vacationApi, type VacationRequest, type VacationView } from '@/lib/vacation-api';
import { getVacationMonthBounds } from '@/lib/vacation-calendar';

export default function VacacionesPage() {
  const { session, request } = useAuth();
  const permissions = session?.user.permissions ?? [];
  const canRequest = permissions.includes('vacaciones:request');
  const canReadOwn = permissions.includes('vacaciones:read_own');
  const canManager = permissions.includes('vacaciones:approve_jefe');
  const canHr = permissions.includes('vacaciones:approve_rrhh');
  const canResolveException = permissions.includes('vacaciones:excepcion_resolve');
  const [view, setView] = useState<'mine' | 'approvals'>('mine');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [calendarItems, setCalendarItems] = useState<VacationRequest[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [approvalView, setApprovalView] = useState<Exclude<VacationView, 'propias'>>('bandeja-jefe');
  const [showRequest, setShowRequest] = useState(false);
  const vacations = useVacations(view, approvalView, canRequest);

  useEffect(() => {
    if (!calendarOpen || !canReadOwn) return;
    let active = true;
    setCalendarLoading(true);
    setCalendarError('');

    if (session?.mode !== 'api') {
      setCalendarItems([]);
      setCalendarError('El calendario requiere una sesión conectada al API de vacaciones.');
      setCalendarLoading(false);
      return () => { active = false; };
    }

    const range = getVacationMonthBounds(calendarMonth);
    void vacationApi.list(request, 'propias', undefined, range)
      .then((page) => {
        if (active) setCalendarItems(page.data.filter((item) => item.estado === 'APROBADO_FINAL'));
      })
      .catch((reason) => {
        if (active) setCalendarError(reason instanceof Error ? reason.message : 'No se pudo cargar el calendario de vacaciones.');
      })
      .finally(() => {
        if (active) setCalendarLoading(false);
      });

    return () => { active = false; };
  }, [calendarMonth, calendarOpen, calendarRevision, canReadOwn, request, session?.mode]);

  useEffect(() => {
    if (!canRequest && (canManager || canHr)) setView('approvals');
    if (!canManager && canHr) setApprovalView('bandeja-rrhh');
    else if (canManager) setApprovalView('bandeja-jefe');
  }, [canHr, canManager, canRequest]);

  const availableDays = vacations.balance?.gestiones.reduce(
    (total, gestion) => total + gestion.diasPendientes,
    0,
  ) ?? 0;
  const ownRequests = useMemo(
    () => [...vacations.items].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)),
    [vacations.items],
  );
  const approvalRequests = vacations.items.filter((item) =>
    approvalView === 'bandeja-jefe'
      ? item.estado === 'PENDIENTE_JEFE'
      : item.estado === 'APROBADO_JEFE',
  );

  async function submitRequest(input: {
    fechaInicio: string;
    fechaFin: string;
    days: number;
    exception: boolean;
    justification: string;
  }) {
    try {
      await vacationApi.create(request, {
        fechaInicio: input.fechaInicio,
        fechaFin: input.fechaFin,
        solicitarExcepcion: input.exception,
        ...(input.exception ? { justificacionExcepcion: input.justification } : {}),
      });
      setShowRequest(false);
      vacations.setNotice('Solicitud enviada. El servidor validó días hábiles, feriados y traslapes.');
      await vacations.reload();
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error('No se pudo enviar la solicitud.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={calendarOpen ? 'Calendario de descansos' : view === 'mine' ? 'Mis vacaciones' : 'Bandeja de aprobación'}
        description={calendarOpen
          ? 'Consulta los rangos de vacaciones que ya tienen aprobación final.'
          : view === 'mine'
          ? 'Consulta tu saldo y programa tus días de descanso.'
          : 'Revisa y resuelve solicitudes según tu nivel de autorización.'}
      >
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => calendarOpen ? setCalendarRevision((revision) => revision + 1) : void vacations.reload()}
            disabled={calendarOpen ? calendarLoading : vacations.loading}
            aria-label="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {view === 'mine' && canRequest && (
            <Button type="button" onClick={() => setShowRequest(true)}><Plus className="h-4 w-4" />Solicitar vacaciones</Button>
          )}
        </div>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {canRequest && <Tab active={!calendarOpen && view === 'mine'} onClick={() => { setCalendarOpen(false); setView('mine'); }}>Mi saldo y solicitudes</Tab>}
        {(canManager || canHr) && <Tab active={!calendarOpen && view === 'approvals'} onClick={() => { setCalendarOpen(false); setView('approvals'); }}>Aprobaciones</Tab>}
        {canReadOwn && <Tab active={calendarOpen} onClick={() => setCalendarOpen(true)}>Calendario</Tab>}
      </div>

      {vacations.error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{vacations.error}</div>}
      {vacations.notice && <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{vacations.notice}</div>}

      {calendarOpen ? (
        <VacationCalendar
          month={calendarMonth}
          items={calendarItems}
          loading={calendarLoading}
          error={calendarError}
          onMonthChange={setCalendarMonth}
          onRetry={() => setCalendarRevision((revision) => revision + 1)}
        />
      ) : vacations.loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Cargando información de vacaciones…</div>
      ) : view === 'mine' ? (
        <>
          {vacations.balance && <VacationBalanceCards balance={vacations.balance} />}
          <VacationRequestList items={ownRequests} />
        </>
      ) : (
        <>
          {canManager && canHr && <div className="mb-5 inline-flex rounded-lg bg-slate-100 p-1"><Tab active={approvalView === 'bandeja-jefe'} onClick={() => setApprovalView('bandeja-jefe')}>Jefatura</Tab><Tab active={approvalView === 'bandeja-rrhh'} onClick={() => setApprovalView('bandeja-rrhh')}>RRHH</Tab></div>}
          {canResolveException && <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">Las excepciones pendientes aparecen junto a su solicitud cuando la API las incluye en la bandeja.</p>}
          <VacationApprovalList
            items={approvalRequests}
            view={approvalView}
            busyId={vacations.busyId}
            comments={vacations.comments}
            onCommentChange={(id, value) => vacations.setComments((current) => ({ ...current, [id]: value }))}
            canResolveException={canResolveException}
            onAct={(id, action) => void vacations.approveOrReject(id, action)}
            onResolveException={(id, decision) => void vacations.resolveException(id, decision)}
          />
        </>
      )}

      {showRequest && <VacationRequestDialog balance={vacations.balance} available={availableDays} onClose={() => setShowRequest(false)} onSubmit={submitRequest} />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`border-b-2 px-4 py-3 text-sm font-medium ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{children}</button>;
}
