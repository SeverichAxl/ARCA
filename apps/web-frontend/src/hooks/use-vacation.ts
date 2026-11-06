'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  vacationApi,
  type VacationBalance,
  type VacationRequest,
  type VacationView,
} from '@/lib/vacation-api';

export function useVacations(
  view: 'mine' | 'approvals',
  approvalView: Exclude<VacationView, 'propias'>,
  canRequest: boolean,
) {
  const { request, session } = useAuth();
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [items, setItems] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (session?.mode !== 'api') {
        throw new Error('Activa NEXT_PUBLIC_AUTH_MODE=api para conectar con el servicio real de vacaciones.');
      }
      if (view === 'mine') {
        const [nextBalance, page] = await Promise.all([
          canRequest ? vacationApi.getBalance(request) : Promise.resolve(null),
          vacationApi.list(request, 'propias'),
        ]);
        setBalance(nextBalance);
        setItems(page.data);
      } else {
        const page = await vacationApi.list(request, approvalView);
        setItems(page.data);
        if (canRequest) setBalance(await vacationApi.getBalance(request));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el módulo de vacaciones.');
    } finally {
      setLoading(false);
    }
  }, [approvalView, canRequest, request, session?.mode, view]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const approveOrReject = useCallback(async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      if (action === 'approve') {
        if (approvalView === 'bandeja-jefe') await vacationApi.approveManager(request, id, comments[id]);
        else await vacationApi.approveHr(request, id, comments[id]);
      } else {
        const reason = comments[id]?.trim();
        if (!reason) throw new Error('Escribe el motivo del rechazo.');
        await vacationApi.reject(request, id, reason);
      }
      setNotice(action === 'approve' ? 'Aprobación registrada.' : 'Solicitud rechazada.');
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la solicitud.');
    } finally {
      setBusyId('');
    }
  }, [approvalView, comments, reload, request]);

  const resolveException = useCallback(async (id: string, decision: 'APROBADA' | 'RECHAZADA') => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await vacationApi.resolveException(request, id, decision, comments[id]);
      setNotice(decision === 'APROBADA' ? 'Excepción aprobada.' : 'Excepción rechazada.');
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo resolver la excepción.');
    } finally {
      setBusyId('');
    }
  }, [comments, reload, request]);

  return {
    balance, items, loading, error, setError, notice, setNotice, busyId,
    comments, setComments, reload, approveOrReject, resolveException,
  };
}
