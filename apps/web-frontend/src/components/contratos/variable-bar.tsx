'use client';

import { Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  VARIABLES_PERMITIDAS,
  VARIABLE_LABELS,
  type VariablePermitida,
} from '@/lib/api/contratos/types';

/**
 * Variables que el backend sustituye. Un clic inserta el texto literal
 * `{{variable}}` en la posición del cursor.
 */
export function VariableBar({
  onInsert,
  disabled = false,
  detectedVariables = [],
}: {
  onInsert: (variable: VariablePermitida) => void;
  disabled?: boolean;
  detectedVariables?: string[];
}) {
  return (
    <section
      aria-label="Variables disponibles"
      className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Braces aria-hidden="true" className="h-4 w-4" />
        Variables permitidas
      </div>
      <div className="flex flex-wrap gap-2">
        {VARIABLES_PERMITIDAS.map((variable) => {
          const isUsed = detectedVariables.includes(variable);
          return (
            <Button
              key={variable}
              type="button"
              variant={isUsed ? 'secondary' : 'outline'}
              size="sm"
              disabled={disabled}
              onClick={() => onInsert(variable)}
              aria-label={`Insertar variable ${variable}`}
              title={`${VARIABLE_LABELS[variable]} — insertar {{${variable}}}`}
              className="font-mono text-xs"
            >
              {`{{${variable}}}`}
            </Button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Las variables se guardan como texto literal; el backend las sustituye al generar el
        contrato. No escribas variables fuera de esta lista.
      </p>
    </section>
  );
}
