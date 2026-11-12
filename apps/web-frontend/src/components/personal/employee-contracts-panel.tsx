'use client';

import { useState } from 'react';
import { FilePlus2, FileText } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState } from '@/components/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FileDownloadButton } from '@/components/shared/file-download-button';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { SafeHtmlPreview } from '@/components/shared/safe-html-preview';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useContratosEmpleado, usePlantillasActivas } from '@/hooks/use-contratos';
import { contratosApi } from '@/lib/api/contratos/contratos-api';
import type { PreviewContrato } from '@/lib/api/contratos/types';
import {
  contractDownloadFileName,
  missingContractFields,
  versionHasDocument,
} from '@/lib/personal-ficha';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO').format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function MissingFields({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <div className="rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 text-sm text-[hsl(var(--warning))]">
      <p className="font-medium">Faltan datos para generar el contrato</p>
      <ul className="mt-1 list-inside list-disc">
        {fields.map((field) => (
          <li key={field} className="break-all">
            {field}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmployeeContractsPanel({
  employeeId,
  canView,
  canGenerate,
}: {
  employeeId: string;
  canView: boolean;
  canGenerate: boolean;
}) {
  const { request } = useAuth();
  const { contratos, loading, error, notFound, reload } = useContratosEmpleado(
    employeeId,
    canView,
  );
  const {
    data: plantillas,
    loading: templatesLoading,
    error: templatesError,
    reload: reloadTemplates,
  } = usePlantillasActivas(canGenerate);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlantillaId, setSelectedPlantillaId] = useState('');
  const [preview, setPreview] = useState<PreviewContrato | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openDialog = () => {
    setDialogOpen(true);
    setSelectedPlantillaId(plantillas[0]?.id ?? '');
    setPreview(null);
    setPreviewError(null);
    setCreateError(null);
    setCreatedContractId(null);
    setSuccessMessage(null);
  };

  const runPreview = async () => {
    if (!selectedPlantillaId) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    setCreateError(null);
    try {
      setPreview(
        await contratosApi.previewPlantilla(request, {
          plantillaId: selectedPlantillaId,
          empleadoId: employeeId,
        }),
      );
    } catch (reason) {
      setPreviewError(reason);
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmCreate = async () => {
    if (!selectedPlantillaId) return;
    setCreating(true);
    setCreateError(null);
    let contractId = createdContractId;
    try {
      if (!contractId) {
        const contrato = await contratosApi.createContrato(request, {
          plantillaId: selectedPlantillaId,
          empleadoId: employeeId,
        });
        contractId = contrato.id;
        setCreatedContractId(contractId);
      }

      const document = await contratosApi.generarPdf(request, contractId);
      setDialogOpen(false);
      setCreatedContractId(null);
      setSuccessMessage(`Contrato generado correctamente (PDF v${document.version}).`);
      await reload();
    } catch (reason) {
      setCreateError(reason);
      if (contractId) await reload();
    } finally {
      setCreating(false);
    }
  };

  const previewFields = preview?.camposFaltantes ?? [];
  const previewErrorFields = missingContractFields(previewError);
  const createErrorFields = missingContractFields(createError);
  const canConfirm =
    Boolean(preview) &&
    previewFields.length === 0 &&
    !previewLoading &&
    !creating &&
    Boolean(selectedPlantillaId);

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <header className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="body-medium text-card-foreground">Contratos</h2>
          <p className="caption-small text-muted-foreground">
            Documentos generados, versiones PDF y descargas firmadas.
          </p>
        </div>
        {canGenerate ? (
          <Button type="button" className="gap-2" onClick={openDialog}>
            <FilePlus2 aria-hidden="true" className="h-4 w-4" />
            Generar contrato
          </Button>
        ) : null}
      </header>

      {successMessage ? (
        <p role="status" className="mb-4 rounded-md border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success-bg))] px-4 py-3 text-sm text-[hsl(var(--success))]">
          {successMessage}
        </p>
      ) : null}

      {!canView ? (
        <p className="body-default text-muted-foreground">
          No tienes permiso para consultar los contratos de este funcionario.
        </p>
      ) : loading ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : error ? (
        <ErrorAlert
          error={error}
          title="No se pudieron cargar los contratos"
          onRetry={() => void reload()}
        />
      ) : notFound || contratos.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Sin contratos registrados"
          description="Este funcionario todavía no tiene contratos generados. Si tienes permiso, puedes generar el primero desde una plantilla activa."
          badge={null}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table aria-label="Contratos del funcionario">
            <TableHeader>
              <TableRow>
                <TableHead>Plantilla</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Documento y versiones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratos.map((contrato) => {
                const latestVersion = contrato.versiones.find(
                  (version) =>
                    version.version === contrato.versionVigente && versionHasDocument(version),
                );
                return (
                  <TableRow key={contrato.id}>
                    <TableCell className="min-w-44 font-medium">
                      {contrato.plantillaNombre}
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Plantilla v{contrato.plantillaVersion}
                      </span>
                    </TableCell>
                    <TableCell>
                      {contrato.versionVigente ? `v${contrato.versionVigente}` : 'Sin PDF'}
                    </TableCell>
                    <TableCell><StatusBadge status={contrato.estado} /></TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(contrato.creadoEn)}</TableCell>
                    <TableCell className="min-w-56">
                      <div className="space-y-2">
                        {latestVersion ? (
                          <FileDownloadButton
                            download={() => contratosApi.descargarContrato(request, contrato.id)}
                            defaultFileName={contractDownloadFileName(
                              contrato.plantillaNombre,
                              latestVersion.version,
                            )}
                            label="Descargar última versión"
                          />
                        ) : (
                          <span className="caption-small text-muted-foreground">Sin PDF vigente</span>
                        )}
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-secondary hover:underline">
                            Ver versiones ({contrato.versiones.length})
                          </summary>
                          <div className="mt-2 overflow-x-auto rounded-md border border-border">
                            <Table aria-label={`Versiones de ${contrato.plantillaNombre}`}>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Versión</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead>Firmas</TableHead>
                                  <TableHead>Creado</TableHead>
                                  <TableHead>Documento</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {contrato.versiones.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-muted-foreground">
                                      Todavía no hay versiones PDF para este contrato.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  contrato.versiones.map((version) => (
                                    <TableRow key={version.id}>
                                      <TableCell>v{version.version}</TableCell>
                                      <TableCell><StatusBadge status={version.estado} /></TableCell>
                                      <TableCell className="whitespace-nowrap">
                                        Trabajador {version.firmadoTrabajador ? 'sí' : 'no'} ·
                                        Representante {version.firmadoRepresentante ? 'sí' : 'no'}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap">
                                        {formatDateTime(version.creadoEn)}
                                      </TableCell>
                                      <TableCell>
                                        {versionHasDocument(version) ? (
                                          <FileDownloadButton
                                            download={() =>
                                              contratosApi.descargarContrato(
                                                request,
                                                contrato.id,
                                                version.id,
                                              )
                                            }
                                            defaultFileName={contractDownloadFileName(
                                              contrato.plantillaNombre,
                                              version.version,
                                            )}
                                            label={`Descargar v${version.version}`}
                                          />
                                        ) : (
                                          <span className="caption-small text-muted-foreground">
                                            Sin PDF
                                          </span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </details>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generar contrato</DialogTitle>
            <DialogDescription>
              Elige una plantilla activa, revisa la vista previa real con los datos del
              funcionario y confirma la generación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <label className="block space-y-1.5">
              <span className="caption-small font-medium">Plantilla activa *</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedPlantillaId}
                onChange={(event) => {
                  setSelectedPlantillaId(event.target.value);
                  setPreview(null);
                  setPreviewError(null);
                  setCreateError(null);
                  setCreatedContractId(null);
                }}
                disabled={templatesLoading || plantillas.length === 0}
                required
              >
                <option value="">
                  {templatesLoading ? 'Cargando plantillas…' : 'Selecciona una plantilla'}
                </option>
                {plantillas.map((plantilla) => (
                  <option key={plantilla.id} value={plantilla.id}>
                    {plantilla.nombre} (v{plantilla.versionActual})
                  </option>
                ))}
              </select>
            </label>

            {templatesError ? (
              <ErrorAlert
                error={templatesError}
                title="No se pudieron cargar las plantillas"
                onRetry={() => void reloadTemplates()}
              />
            ) : null}

            {!templatesLoading && !templatesError && plantillas.length === 0 ? (
              <p className="body-default text-muted-foreground">
                No hay plantillas activas disponibles para generar contratos.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void runPreview()}
                disabled={!selectedPlantillaId || previewLoading}
              >
                {previewLoading ? 'Generando vista previa…' : 'Vista previa real'}
              </Button>
            </div>

            {previewLoading ? <LoadingSkeleton variant="form" /> : null}

            {previewError ? (
              <div className="space-y-3">
                <ErrorAlert
                  error={previewError}
                  title="No se pudo generar la vista previa"
                  onRetry={() => void runPreview()}
                />
                <MissingFields fields={previewErrorFields} />
              </div>
            ) : null}

            {preview ? (
              <div className="space-y-3">
                <p className="caption-small text-muted-foreground">
                  Plantilla v{preview.plantillaVersion} · Variables resueltas:{' '}
                  {preview.variablesResueltas.length}
                </p>
                <MissingFields fields={previewFields} />
                {preview.advertencias.length ? (
                  <ul className="list-inside list-disc text-sm text-muted-foreground">
                    {preview.advertencias.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
                <SafeHtmlPreview
                  html={preview.htmlPreview}
                  title="Vista previa del contrato a generar"
                  minHeight={360}
                />
              </div>
            ) : null}

            {createError ? (
              <div className="space-y-3">
                <ErrorAlert
                  error={createError}
                  title="No se pudo generar el contrato"
                  onRetry={() => void confirmCreate()}
                />
                <MissingFields fields={createErrorFields} />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmCreate()}
              disabled={!canConfirm}
            >
              {creating
                ? 'Generando…'
                : createdContractId
                  ? 'Reintentar generación PDF'
                  : 'Confirmar y generar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
