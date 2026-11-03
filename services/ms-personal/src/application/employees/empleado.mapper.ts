import { formatFecha } from '../../domain/empleado/fechas';
import { ratificableDesde } from '../../domain/empleado/periodo-prueba';
import type { PersonalCryptoService } from '../../infrastructure/crypto/personal-crypto.service';

export interface EmpleadoConRelaciones {
  id: string;
  nombres: string;
  apellidos: string;
  ciCifrado: string;
  ciExpedido: string | null;
  fechaNacimiento: Date | null;
  esExtranjero: boolean;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  areaId: string;
  cargoId: string;
  remuneracionCifrada: string;
  fechaIngreso: Date;
  diasPrueba: number;
  estado: string;
  fechaRatificacion: Date | null;
  firmaPublicId: string;
  creadoEn: Date;
  actualizadoEn: Date;
  area: { id: string; nombre: string; jefeId: string | null };
  cargo: { id: string; nombre: string };
  inamovilidades: {
    id: string;
    tipo: string;
    fechaInicio: Date;
    fechaFin: Date | null;
    estadoActivo: boolean;
  }[];
}

export const INCLUDE_EMPLEADO = {
  area: { select: { id: true, nombre: true, jefeId: true } },
  cargo: { select: { id: true, nombre: true } },
  inamovilidades: {
    where: { estadoActivo: true },
    select: { id: true, tipo: true, fechaInicio: true, fechaFin: true, estadoActivo: true },
    orderBy: { fechaInicio: 'desc' as const },
  },
};

const f = (d: Date | null) => (d ? formatFecha(d) : null);

/**
 * Serializa un empleado. La remuneración solo se incluye con `personal:read_salary`;
 * la CI va enmascarada en listados.
 */
export function mapEmpleado(
  e: EmpleadoConRelaciones,
  opts: { verSueldo: boolean; ciCompleta: boolean; hoy: Date },
  crypto: PersonalCryptoService,
) {
  const inamovilidadesVigentes = e.inamovilidades.filter(
    (i) => i.estadoActivo && i.fechaInicio <= opts.hoy && (i.fechaFin === null || i.fechaFin >= opts.hoy),
  );
  return {
    id: e.id,
    nombres: e.nombres,
    apellidos: e.apellidos,
    nombreCompleto: `${e.nombres} ${e.apellidos}`,
    ci: opts.ciCompleta ? crypto.descifrar(e.ciCifrado) : crypto.enmascararCi(e.ciCifrado),
    ciExpedido: e.ciExpedido,
    fechaNacimiento: f(e.fechaNacimiento),
    esExtranjero: e.esExtranjero,
    email: e.email,
    telefono: e.telefono,
    direccion: e.direccion,
    areaId: e.areaId,
    area: { id: e.area.id, nombre: e.area.nombre },
    cargoId: e.cargoId,
    cargo: e.cargo,
    fechaIngreso: f(e.fechaIngreso),
    diasPrueba: e.diasPrueba,
    ratificableDesde: f(ratificableDesde(e.fechaIngreso, e.diasPrueba)),
    estado: e.estado,
    fechaRatificacion: f(e.fechaRatificacion),
    inamovilidadActiva: inamovilidadesVigentes.length > 0,
    inamovilidades: inamovilidadesVigentes.map((i) => ({
      id: i.id,
      tipo: i.tipo,
      fechaInicio: f(i.fechaInicio),
      fechaFin: f(i.fechaFin),
    })),
    firmaDisponible: Boolean(e.firmaPublicId),
    creadoEn: e.creadoEn.toISOString(),
    actualizadoEn: e.actualizadoEn.toISOString(),
    ...(opts.verSueldo ? { remuneracion: crypto.descifrarMonto(e.remuneracionCifrada) } : {}),
  };
}

export function puedeVerSueldo(permisos: string[] | undefined): boolean {
  return (permisos ?? []).includes('personal:read_salary');
}
