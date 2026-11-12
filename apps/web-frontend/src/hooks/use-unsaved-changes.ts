'use client';

import { useEffect } from 'react';

/**
 * Advierte al cerrar/recargar la pestaña si hay cambios sin guardar.
 *
 * Limitación de Next App Router: no existe un evento público para interceptar
 * toda navegación interna. La pantalla de edición también intercepta su propio
 * botón "Volver"; la navegación por el menú lateral no se puede bloquear aquí.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
