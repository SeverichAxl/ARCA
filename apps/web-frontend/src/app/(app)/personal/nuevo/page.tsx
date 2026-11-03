'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminPageTitle, ErrorBanner } from '@/components/admin/admin-components';
import { EmployeeCard } from '@/components/personal/employee-components';
import { useAuth } from '@/components/auth/auth-provider';
import { useEmployeeCatalogs } from '@/hooks/use-personal';
import {
  isSignatureFile,
  personalApi,
  type EmployeeCreateInput,
  type JobProtectionType,
} from '@/lib/personal-api';
import { AUTH_MODE } from '@/lib/auth';

const INITIAL_FORM = {
  nombres: '',
  apellidos: '',
  ci: '',
  ciExpedido: '',
  fechaNacimiento: '',
  email: '',
  telefono: '',
  direccion: '',
  areaId: '',
  cargoId: '',
  remuneracion: '',
  fechaIngreso: new Date().toISOString().slice(0, 10),
  esExtranjero: false,
  hasProtection: false,
  protectionType: 'GESTACION' as JobProtectionType,
  protectionStart: new Date().toISOString().slice(0, 10),
  protectionNote: '',
};

const PROTECTION_OPTIONS: Array<{ value: JobProtectionType; label: string; description: string }> = [
  {
    value: 'GESTACION',
    label: 'Gestación',
    description: 'Protección durante embarazo y periodo posterior.',
  },
  { value: 'PROGENITOR', label: 'Progenitor', description: 'Protección por paternidad o maternidad.' },
  { value: 'DISCAPACIDAD', label: 'Ley 223', description: 'Protección por discapacidad.' },
  {
    value: 'TUTOR_DISCAPACIDAD',
    label: 'Tutor Ley 223',
    description: 'Protección de tutor o familiar a cargo.',
  },
];

export default function NewEmployeePage() {
  const router = useRouter();
  const { request } = useAuth();
  const { areas, cargos, loading: catalogsLoading, error: catalogsError } = useEmployeeCatalogs();
  const [form, setForm] = useState(INITIAL_FORM);
  const [signature, setSignature] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!signature) {
      setSignaturePreview(null);
      return;
    }
    const url = URL.createObjectURL(signature);
    setSignaturePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [signature]);

  const eligiblePositions = cargos.filter((position) => !position.areaId || position.areaId === form.areaId);

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSignature = (file?: File) => {
    if (!file) return;
    if (!isSignatureFile(file)) {
      setSignature(null);
      setError('La firma debe ser una imagen PNG o JPEG de máximo 5 MiB.');
      return;
    }
    setError(null);
    setSignature(file);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!signature) {
      setError('Debes adjuntar la firma gráfica PNG o JPEG para registrar al funcionario.');
      return;
    }
    if (!form.areaId || !form.cargoId) {
      setError('Selecciona el área y el cargo del funcionario.');
      return;
    }

    setSaving(true);
    try {
      const input: EmployeeCreateInput = {
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        ci: form.ci.trim(),
        ...(form.ciExpedido.trim() ? { ciExpedido: form.ciExpedido.trim() } : {}),
        ...(form.fechaNacimiento ? { fechaNacimiento: form.fechaNacimiento } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.telefono.trim() ? { telefono: form.telefono.trim() } : {}),
        ...(form.direccion.trim() ? { direccion: form.direccion.trim() } : {}),
        areaId: form.areaId,
        cargoId: form.cargoId,
        remuneracion: Number(form.remuneracion),
        fechaIngreso: form.fechaIngreso,
        esExtranjero: form.esExtranjero,
        ...(form.hasProtection
          ? {
              inamovilidad: {
                tipo: form.protectionType,
                fechaInicio: form.protectionStart,
                ...(form.protectionNote.trim()
                  ? { observacion: form.protectionNote.trim() }
                  : {}),
              },
            }
          : {}),
      };
      const employee = await personalApi.createEmployee(request, input, signature);
      router.replace(`/personal/${employee.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo registrar al funcionario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link href="/personal">
          <ArrowLeft className="h-4 w-4" />
          Volver a Personal
        </Link>
      </Button>
      <AdminPageTitle
        eyebrow="Sistema de Gestión Humana"
        title="Nuevo funcionario"
        description="Completa la información personal y laboral para crear el expediente."
      />

      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: el alta queda guardada en esta sesión del navegador y comienza En prueba por 90 días.
        </div>
      )}
      {error && <ErrorBanner message={error} />}
      {catalogsError && <ErrorBanner message={catalogsError} />}

      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <EmployeeCard
            title="Datos personales"
            description="Información de identificación y contacto."
            icon="personal"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Nombres *</span>
                <Input
                  required
                  maxLength={100}
                  value={form.nombres}
                  onChange={(event) => updateForm('nombres', event.target.value)}
                  placeholder="Ej. Daniela Alejandra"
                />
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Apellidos *</span>
                <Input
                  required
                  maxLength={100}
                  value={form.apellidos}
                  onChange={(event) => updateForm('apellidos', event.target.value)}
                  placeholder="Ej. Vargas Flores"
                />
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Cédula de identidad *</span>
                <Input
                  required
                  maxLength={30}
                  value={form.ci}
                  onChange={(event) => updateForm('ci', event.target.value)}
                  placeholder="6543210 LP"
                />
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">CI expedida en</span>
                <Input
                  maxLength={20}
                  value={form.ciExpedido}
                  onChange={(event) => updateForm('ciExpedido', event.target.value)}
                  placeholder="La Paz"
                />
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Fecha de nacimiento</span>
                <Input
                  type="date"
                  value={form.fechaNacimiento}
                  onChange={(event) => updateForm('fechaNacimiento', event.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Correo electrónico</span>
                <Input
                  type="email"
                  maxLength={200}
                  value={form.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                  placeholder="nombre@arca.bo"
                />
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Teléfono</span>
                <Input
                  maxLength={30}
                  value={form.telefono}
                  onChange={(event) => updateForm('telefono', event.target.value)}
                  placeholder="+591 700 000 00"
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="caption-small font-medium">Dirección</span>
                <Input
                  maxLength={250}
                  value={form.direccion}
                  onChange={(event) => updateForm('direccion', event.target.value)}
                  placeholder="Dirección actual"
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.esExtranjero}
                  onChange={(event) => updateForm('esExtranjero', event.target.checked)}
                  className="h-4 w-4 rounded border-input text-secondary focus:ring-ring"
                />
                <span className="body-default">Funcionario extranjero</span>
              </label>
            </div>
          </EmployeeCard>

          <EmployeeCard
            title="Datos laborales"
            description="Asignación organizacional y condiciones iniciales."
            icon="work"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Área *</span>
                <select
                  required
                  value={form.areaId}
                  onChange={(event) => {
                    updateForm('areaId', event.target.value);
                    updateForm('cargoId', '');
                  }}
                  disabled={catalogsLoading}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="">
                    {catalogsLoading ? 'Cargando áreas…' : 'Selecciona un área'}
                  </option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Cargo *</span>
                <select
                  required
                  value={form.cargoId}
                  onChange={(event) => updateForm('cargoId', event.target.value)}
                  disabled={!form.areaId || catalogsLoading}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="">Selecciona un cargo</option>
                  {eligiblePositions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Haber básico (Bs) *</span>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.remuneracion}
                  onChange={(event) => updateForm('remuneracion', event.target.value)}
                  placeholder="0.00"
                />
                <span className="caption-small text-muted-foreground">
                  El sistema valida los límites establecidos por el backend.
                </span>
              </label>
              <label className="space-y-1.5">
                <span className="caption-small font-medium">Fecha de ingreso *</span>
                <Input
                  type="date"
                  required
                  value={form.fechaIngreso}
                  onChange={(event) => updateForm('fechaIngreso', event.target.value)}
                />
              </label>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 sm:col-span-2">
                <span className="rounded-full bg-[hsl(var(--warning-bg))] px-2.5 py-1 caption-small font-medium text-[hsl(var(--warning))]">
                  En prueba
                </span>
                <span className="caption-small text-muted-foreground">Periodo inicial: 90 días</span>
              </div>
            </div>
          </EmployeeCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <EmployeeCard
            title="Firma gráfica"
            description="Archivo PNG o JPEG · obligatorio · máximo 5 MiB."
            icon="signature"
          >
            <label
              htmlFor="signature"
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-input bg-muted/40 p-5 text-center transition hover:border-secondary"
            >
              {signaturePreview ? (
                <Image
                  src={signaturePreview}
                  alt="Vista previa de firma"
                  width={360}
                  height={120}
                  unoptimized
                  className="max-h-28 max-w-full object-contain"
                />
              ) : (
                <ImagePlus className="h-8 w-8 text-secondary" />
              )}
              <span className="body-medium mt-3">
                {signature?.name ?? 'Arrastra la firma aquí o haz clic para seleccionar'}
              </span>
              <span className="caption-small mt-1 text-muted-foreground">
                Firma requerida para habilitar el registro
              </span>
            </label>
            <input
              id="signature"
              type="file"
              accept="image/png,image/jpeg,.png,.jpeg,.jpg"
              className="sr-only"
              onChange={(event) => handleSignature(event.target.files?.[0])}
            />
            {signature && (
              <p className="caption-small mt-2 text-[hsl(var(--success))]">
                Archivo listo · {(signature.size / 1024).toFixed(0)} KiB
              </p>
            )}
          </EmployeeCard>

          <EmployeeCard
            title="Inamovilidad laboral"
            description="Registra el fuero laboral vigente si corresponde."
            icon="protection"
          >
            <div className="space-y-2">
              {PROTECTION_OPTIONS.map((protection) => (
                <label
                  key={protection.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md bg-muted/50 p-3"
                >
                  <input
                    type="radio"
                    name="protection"
                    checked={form.hasProtection && form.protectionType === protection.value}
                    onChange={() => {
                      updateForm('hasProtection', true);
                      updateForm('protectionType', protection.value);
                    }}
                    className="mt-1 h-4 w-4 border-input text-secondary focus:ring-ring"
                  />
                  <span>
                    <span className="block body-medium">{protection.label}</span>
                    <span className="caption-small text-muted-foreground">{protection.description}</span>
                  </span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3">
                <input
                  type="checkbox"
                  checked={!form.hasProtection}
                  onChange={() => updateForm('hasProtection', false)}
                  className="h-4 w-4 rounded border-input text-secondary focus:ring-ring"
                />
                <span className="body-default">No registra inamovilidad</span>
              </label>
            </div>
            {form.hasProtection && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="caption-small font-medium">Fecha de inicio *</span>
                  <Input
                    type="date"
                    required
                    value={form.protectionStart}
                    onChange={(event) => updateForm('protectionStart', event.target.value)}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="caption-small font-medium">Observación</span>
                  <Input
                    maxLength={250}
                    value={form.protectionNote}
                    onChange={(event) => updateForm('protectionNote', event.target.value)}
                    placeholder="Detalle adicional"
                  />
                </label>
              </div>
            )}
          </EmployeeCard>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-background/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="caption-small text-muted-foreground">
            Los campos marcados con * son obligatorios. La firma gráfica es requerida.
          </p>
          <div className="flex gap-2">
            <Button asChild type="button" variant="outline">
              <Link href="/personal">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={saving || !signature || catalogsLoading}>
              {saving ? 'Registrando…' : 'Registrar funcionario'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
