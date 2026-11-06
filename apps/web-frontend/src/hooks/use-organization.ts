'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  organizationApi,
  type OrganizationSnapshot,
} from '@/lib/organization-api';

const EMPTY_SNAPSHOT: OrganizationSnapshot = {
  tree: [],
  areas: [],
  cargos: [],
  employees: [],
  canReadPeople: false,
  canManageCatalogs: false,
};

export function useOrganization() {
  const { request, session } = useAuth();
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissions = useMemo(() => session?.user.permissions ?? [], [session]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await organizationApi.load(request, permissions));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo cargar la estructura organizacional.',
      );
    } finally {
      setLoading(false);
    }
  }, [permissions, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...snapshot, loading, error, reload };
}
