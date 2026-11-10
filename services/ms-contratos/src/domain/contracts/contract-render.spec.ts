import {
  renderContratoTemplate,
  toContratoVariables,
} from './contract-render';
import type { DatosEmpleadoContrato } from './personal-data.port';

const datos: DatosEmpleadoContrato = {
  empleadoId: '22222222-2222-4222-8222-222222222222',
  nombreEmpleado: 'Ana <Rojas>',
  ci: '12345678',
  cargo: 'Analista',
  remuneracion: '6000.00',
  fechaIngreso: '2026-01-01',
  duracionPrueba: '90 días',
};

const html =
  '<p>{{nombre_empleado}}|{{ci}}|{{cargo}}|{{remuneracion}}|{{fecha_ingreso}}|{{duracion_prueba}}</p>';

describe('renderContratoTemplate', () => {
  it('sustituye todas las variables del catálogo y escapa los valores', () => {
    const result = renderContratoTemplate(html, toContratoVariables(datos));

    expect(result.html).toBe(
      '<p>Ana &lt;Rojas&gt;|12345678|Analista|6000.00|2026-01-01|90 días</p>',
    );
    expect(result.variablesResueltas).toEqual([
      'nombre_empleado',
      'ci',
      'cargo',
      'remuneracion',
      'fecha_ingreso',
      'duracion_prueba',
    ]);
    expect(result.camposFaltantes).toEqual([]);
    expect(result.advertencias).toEqual([]);
  });

  it('conserva el placeholder y reporta la variable faltante', () => {
    const sinSalario: DatosEmpleadoContrato = { ...datos };
    delete sinSalario.remuneracion;
    const result = renderContratoTemplate(
      html,
      toContratoVariables(sinSalario),
    );

    expect(result.html).toContain('{{remuneracion}}');
    expect(result.camposFaltantes).toEqual(['remuneracion']);
    expect(result.advertencias[0]).toContain('personal:read_salary');
  });

  it('advierte sobre placeholders fuera del catálogo sin romper la vista previa', () => {
    const result = renderContratoTemplate(
      '<p>{{nombre_empleado}} {{desconocida}}</p>',
      toContratoVariables(datos),
    );

    expect(result.html).toBe('<p>Ana &lt;Rojas&gt; {{desconocida}}</p>');
    expect(result.advertencias).toEqual([
      'La plantilla conserva variables no reconocidas: desconocida.',
    ]);
  });
});
