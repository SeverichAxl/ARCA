'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Save,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/shared/error-alert';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { SafeHtmlPreview } from '@/components/shared/safe-html-preview';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EditorToolbar } from '@/components/contratos/editor-toolbar';
import { VariableBar } from '@/components/contratos/variable-bar';
import { createVariableHighlightExtension } from '@/components/contratos/variable-highlight-extension';
import { useAuth } from '@/components/auth/auth-provider';
import { usePlantilla } from '@/hooks/use-contratos';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes';
import { isApiError } from '@/lib/api/api-error';
import { contratosApi } from '@/lib/api/contratos/contratos-api';
import { formatBolivianos, formatDate } from '@/lib/api/contratos/format';
import {
  validateTemplate,
  type TemplateValues,
} from '@/lib/api/contratos/variables';
import {
  TEMPLATE_DESCRIPTION_MAX_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH,
  VARIABLES_PERMITIDAS,
  type VariablePermitida,
} from '@/lib/api/contratos/types';
import { isDomainMocked } from '@/lib/api/mock-status';
import { cn } from '@/lib/utils';

const EDITOR_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  createVariableHighlightExtension(VARIABLES_PERMITIDAS),
];

interface SavedSnapshot {
  nombre: string;
  descripcion: string;
  activa: boolean;
  contenidoHtml: string;
  versionActual: number;
}

function fieldMessage(fields: Record<string, string> | null, key: string): string | null {
  if (!fields) return null;
  const value = fields[key];
  return typeof value === 'string' ? value : null;
}

function readServerFields(error: unknown): Record<string, string> | null {
  if (!isApiError(error)) return null;
  if (!error.details || typeof error.details !== 'object') return null;
  const fields = (error.details as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object') return null;

  const entries = Object.entries(fields as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function TemplateEditorScreen({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const { request, session } = useAuth();
  const canManage =
    session?.user.permissions.includes('contrato:template_manage') ?? false;
  const readOnly = !canManage;

  const { plantilla, loading, error, reload } = usePlantilla(templateId);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activa, setActiva] = useState(true);
  const [content, setContent] = useState('');
  const [lastSaved, setLastSaved] = useState<SavedSnapshot | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [serverFields, setServerFields] = useState<Record<string, string> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  const initializedRef = useRef<string | null>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: canManage,
    extensions: EDITOR_EXTENSIONS,
    content: '',
    editorProps: {
      attributes: {
        class:
          'arca-editor min-h-[520px] px-6 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Contenido de la plantilla de contrato',
      },
    },
    onUpdate: ({ editor: current }) => {
      setContent(current.getHTML());
      setServerFields(null);
    },
  });

  useEffect(() => {
    editor?.setEditable(canManage);
  }, [canManage, editor]);

  useEffect(() => {
    if (!editor) return;

    if (templateId) {
      if (!plantilla) return;
      if (initializedRef.current === plantilla.id) return;

      initializedRef.current = plantilla.id;
      setNombre(plantilla.nombre);
      setDescripcion(plantilla.descripcion ?? '');
      setActiva(plantilla.activa);
      setContent(plantilla.contenidoHtml);
      setLastSaved({
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion ?? '',
        activa: plantilla.activa,
        contenidoHtml: plantilla.contenidoHtml,
        versionActual: plantilla.versionActual,
      });
      editor.commands.setContent(plantilla.contenidoHtml, { emitUpdate: false });
      return;
    }

    if (initializedRef.current === 'new') return;
    initializedRef.current = 'new';
    setLastSaved({
      nombre: '',
      descripcion: '',
      activa: true,
      contenidoHtml: '',
      versionActual: 0,
    });
  }, [editor, plantilla, templateId]);

  const validation = useMemo(
    () =>
      validateTemplate({
        nombre,
        descripcion,
        contenidoHtml: content,
      }),
    [content, descripcion, nombre],
  );

  const isDirty = useMemo(() => {
    if (!lastSaved) return false;
    return (
      nombre !== lastSaved.nombre ||
      descripcion !== lastSaved.descripcion ||
      activa !== lastSaved.activa ||
      content !== lastSaved.contenidoHtml
    );
  }, [activa, content, descripcion, lastSaved, nombre]);

  useUnsavedChangesWarning(isDirty);

  const previewSubjects = useMemo(() => contratosApi.listPreviewSubjects(), []);
  const [subjectId, setSubjectId] = useState(previewSubjects[0]?.id ?? '');
  const subject =
    previewSubjects.find((item) => item.id === subjectId) ?? previewSubjects[0];

  const previewValues = useMemo<TemplateValues>(() => {
    if (!subject) return {};
    return {
      nombre_empleado: subject.nombreCompleto,
      ci: subject.ci,
      cargo: subject.cargo,
      remuneracion: formatBolivianos(subject.remuneracion),
      fecha_ingreso: formatDate(subject.fechaIngreso),
      duracion_prueba: `${subject.duracionPrueba} días`,
    };
  }, [subject]);

  const debouncedContent = useDebouncedValue(content, 300);

  const visibleErrors = useMemo(
    () =>
      showValidation
        ? validation.errors
        : validation.errors.filter(
            (issue) =>
              issue.code === 'VARIABLE_DESCONOCIDA' ||
              issue.code === 'LLAVES_DESBALANCEADAS' ||
              issue.code === 'VARIABLE_MALFORMADA',
          ),
    [showValidation, validation.errors],
  );

  const nameError =
    validation.errors.find((issue) => issue.field === 'nombre') ?? null;
  const descriptionError =
    validation.errors.find((issue) => issue.field === 'descripcion') ?? null;
  const contentErrors = visibleErrors.filter(
    (issue) => issue.field === 'contenidoHtml',
  );

  const handleBack = () => {
    if (isDirty) {
      setLeaveOpen(true);
      return;
    }
    router.push('/contratos/plantillas');
  };

  const insertVariable = (variable: VariablePermitida) => {
    if (!editor || readOnly) return;
    editor.chain().focus().insertContent(`{{${variable}}}`).run();
  };

  const save = async () => {
    setShowValidation(true);
    setSaveError(null);
    setServerFields(null);
    setNotice(null);

    if (validation.errors.length > 0) {
      nameInputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      if (templateId) {
        const updated = await contratosApi.updatePlantilla(request, templateId, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          contenidoHtml: content,
          activa,
        });

        const nextDescription = updated.descripcion ?? '';
        setNombre(updated.nombre);
        setDescripcion(nextDescription);
        setActiva(updated.activa);
        setContent(updated.contenidoHtml);
        setLastSaved({
          nombre: updated.nombre,
          descripcion: nextDescription,
          activa: updated.activa,
          contenidoHtml: updated.contenidoHtml,
          versionActual: updated.versionActual,
        });
        editor?.commands.setContent(updated.contenidoHtml, { emitUpdate: false });
        setNotice(`Plantilla guardada. Versión actual: v${updated.versionActual}.`);
      } else {
        const created = await contratosApi.createPlantilla(request, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          contenidoHtml: content,
          activa,
        });
        setNotice('Plantilla creada correctamente.');
        router.replace(`/contratos/plantillas/${created.id}`);
      }
    } catch (reason) {
      setSaveError(reason);
      setServerFields(readServerFields(reason));
    } finally {
      setSaving(false);
    }
  };

  const startDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDivider = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const bounds = splitContainerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;
    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;
    setSplit(Math.min(70, Math.max(30, percent)));
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (templateId && loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Plantilla de contrato"
          description="Cargando el contenido de la plantilla."
        />
        <LoadingSkeleton variant="form" />
      </div>
    );
  }

  if (templateId && error) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Plantilla de contrato"
          description="No se pudo cargar la plantilla."
        />
        <ErrorAlert error={error} onRetry={() => void reload()} />
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/contratos/plantillas">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Volver a plantillas
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!templateId && readOnly) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Nueva plantilla"
          description="La creación de plantillas requiere permisos de gestión."
        />
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        >
          <Eye aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Modo lectura</p>
            <p>
              Tu rol puede consultar plantillas, pero no crear nuevas. La creación
              requiere el permiso <code className="font-mono">contrato:template_manage</code>.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/contratos/plantillas">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Volver a plantillas
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={templateId ? nombre || 'Editar plantilla' : 'Nueva plantilla'}
        description={
          readOnly
            ? 'Consulta el contenido y las variables de la plantilla en modo lectura.'
            : 'Edita el contenido WYSIWYG y guarda una nueva versión cuando cambie el HTML.'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
            >
              <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
              Cambios sin guardar
            </span>
          ) : lastSaved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
              Sin cambios
            </span>
          ) : null}

          <Button type="button" variant="outline" onClick={handleBack}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Volver
          </Button>

          {canManage ? (
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="h-4 w-4" />
              )}
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          ) : null}
        </div>
      </PageHeader>

      {readOnly ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        >
          <Eye aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Modo lectura</p>
            <p>
              Tu rol puede consultar plantillas, pero no crear ni modificarlas. La edición requiere
              el permiso <code className="font-mono">contrato:template_manage</code>.
            </p>
          </div>
        </div>
      ) : null}

      {isDomainMocked('contratos') ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Datos simulados: los cambios se conservan solo durante esta sesión del navegador.
        </div>
      ) : null}

      {saveError ? <ErrorAlert error={saveError} className="mb-4" /> : null}
      {notice ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_180px]">
        <div>
          <Label htmlFor="plantilla-nombre">Nombre *</Label>
          <Input
            id="plantilla-nombre"
            ref={nameInputRef}
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              setServerFields(null);
            }}
            readOnly={readOnly}
            maxLength={TEMPLATE_NAME_MAX_LENGTH}
            aria-invalid={Boolean(nameError || fieldMessage(serverFields, 'nombre'))}
            aria-describedby={
              nameError || fieldMessage(serverFields, 'nombre')
                ? 'plantilla-nombre-error'
                : undefined
            }
            className={readOnly ? 'bg-slate-50' : undefined}
          />
          {nameError || fieldMessage(serverFields, 'nombre') ? (
            <p id="plantilla-nombre-error" role="alert" className="mt-1 text-sm text-red-700">
              {nameError?.message ?? fieldMessage(serverFields, 'nombre')}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="plantilla-descripcion">Descripción</Label>
          <Input
            id="plantilla-descripcion"
            value={descripcion}
            onChange={(event) => {
              setDescripcion(event.target.value);
              setServerFields(null);
            }}
            readOnly={readOnly}
            maxLength={TEMPLATE_DESCRIPTION_MAX_LENGTH}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={descriptionError ? 'plantilla-descripcion-error' : undefined}
            className={readOnly ? 'bg-slate-50' : undefined}
          />
          {descriptionError ? (
            <p
              id="plantilla-descripcion-error"
              role="alert"
              className="mt-1 text-sm text-red-700"
            >
              {descriptionError.message}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="plantilla-activa">Estado</Label>
          <select
            id="plantilla-activa"
            value={activa ? 'true' : 'false'}
            onChange={(event) => setActiva(event.target.value === 'true')}
            disabled={readOnly}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </select>
          {templateId && plantilla ? (
            <p className="mt-2 text-xs text-slate-500">
              v{plantilla.versionActual} · {plantilla.versiones.length} versión(es)
            </p>
          ) : null}
        </div>
      </div>

      {contentErrors.length > 0 ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-semibold">Revisa el contenido antes de guardar</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {contentErrors.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {validation.warnings.length > 0 && content.trim() ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-semibold">Advertencia (no bloquea el guardado)</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {validation.warnings.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <VariableBar
        onInsert={insertVariable}
        disabled={readOnly}
        detectedVariables={validation.variables}
      />

      <div className="mt-4 flex gap-2 lg:hidden" role="tablist" aria-label="Vista del editor">
        <Button
          type="button"
          variant={mobileTab === 'editor' ? 'secondary' : 'outline'}
          onClick={() => setMobileTab('editor')}
          aria-pressed={mobileTab === 'editor'}
          aria-controls="editor-pane"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          Editor
        </Button>
        <Button
          type="button"
          variant={mobileTab === 'preview' ? 'secondary' : 'outline'}
          onClick={() => setMobileTab('preview')}
          aria-pressed={mobileTab === 'preview'}
          aria-controls="preview-pane"
        >
          <Eye aria-hidden="true" className="h-4 w-4" />
          Vista previa
        </Button>
      </div>

      <div
        ref={splitContainerRef}
        className="mt-2 gap-3 lg:grid"
        style={{
          gridTemplateColumns: `minmax(0, ${split}%) 8px minmax(0, ${100 - split}%)`,
        }}
      >
        <section
          id="editor-pane"
          aria-label="Editor de contenido"
          className={cn('min-w-0', mobileTab === 'editor' ? 'block' : 'hidden', 'lg:block')}
        >
          <EditorToolbar editor={editor} disabled={readOnly} />
          <div className="rounded-b-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {editor ? (
              <EditorContent editor={editor} />
            ) : (
              <LoadingSkeleton variant="form" className="p-4" />
            )}
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar el ancho de la vista previa"
          aria-valuemin={30}
          aria-valuemax={70}
          aria-valuenow={Math.round(split)}
          tabIndex={0}
          onPointerDown={startDragging}
          onPointerMove={moveDivider}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setSplit((current) => Math.max(30, current - 2));
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              setSplit((current) => Math.min(70, current + 2));
            }
          }}
          className={cn(
            'hidden cursor-col-resize rounded-full bg-slate-300 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:block',
            dragging && 'bg-blue-600',
          )}
        />

        <section
          id="preview-pane"
          aria-label="Vista previa de la plantilla"
          className={cn(
            'min-w-0',
            mobileTab === 'preview' ? 'block' : 'hidden',
            'lg:block',
          )}
        >
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Vista previa A4
              </h2>
              <p className="text-xs text-slate-500">
                Se actualiza 300 ms después de dejar de escribir.
              </p>
            </div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Funcionario de ejemplo
              <select
                value={subject?.id ?? ''}
                onChange={(event) => setSubjectId(event.target.value)}
                className="ml-2 h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {previewSubjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombreCompleto}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Datos de ejemplo para revisar el diseño; no son datos reales de funcionarios.
            {!isDomainMocked('contratos')
              ? ' El contrato real no expone vista previa de plantillas; esta vista se genera localmente.'
              : null}
          </div>

          <SafeHtmlPreview
            html={debouncedContent}
            values={previewValues}
            minHeight={720}
            title="Vista previa de la plantilla de contrato"
          />
        </section>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Descartar cambios"
        description="Hay cambios sin guardar. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        onConfirm={() => {
          setLeaveOpen(false);
          router.push('/contratos/plantillas');
        }}
        destructive
      />
    </div>
  );
}
