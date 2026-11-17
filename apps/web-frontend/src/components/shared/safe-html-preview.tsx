'use client';

import { useMemo } from 'react';
import {
  buildPreviewDocument,
  PREVIEW_SANDBOX,
} from '@/lib/api/contratos/preview';
import type { TemplateValues } from '@/lib/api/contratos/variables';
import { cn } from '@/lib/utils';

/**
 * Vista previa segura de la plantilla.
 *
 * - iframe con `sandbox=""` (sin allow-scripts ni allow-same-origin).
 * - `srcDoc` generado con DOMPurify y CSP restrictiva.
 * - Hoja A4 blanca: el tema oscuro de la app no altera el documento.
 */
export function SafeHtmlPreview({
  html,
  values = {},
  title = 'Vista previa del contrato',
  className,
  minHeight = 640,
}: {
  html: string;
  values?: TemplateValues;
  title?: string;
  className?: string;
  minHeight?: number;
}) {
  const document = useMemo(() => buildPreviewDocument(html, values), [html, values]);

  return (
    <iframe
      title={title}
      sandbox={PREVIEW_SANDBOX}
      srcDoc={document}
      referrerPolicy="no-referrer"
      className={cn(
        'w-full rounded-xl border border-border bg-white shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)]',
        className,
      )}
      style={{ minHeight }}
    />
  );
}
