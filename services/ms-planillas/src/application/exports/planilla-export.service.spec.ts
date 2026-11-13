import { PlanillaExportService } from './planilla-export.service';

describe('PlanillaExportService', () => {
  const decimal = (value: string) => ({ toFixed: () => value });
  const prisma = {
    planilla: { findUnique: jest.fn().mockResolvedValue({ periodo: '2026-10' }) },
    planillaDetalleNomina: {
      findMany: jest.fn().mockResolvedValue([
        {
          periodo: '2026-10',
          empleadoId: 'e1',
          nombreCompleto: '=RIESGO',
          ciEnmascarado: '***1234',
          diasTrabajados: 30,
          haberBasico: decimal('5000.00'),
          haberGanado: decimal('5000.00'),
          bonoAntiguedad: decimal('0.00'),
          otrosIngresos: decimal('0.00'),
          totalGanado: decimal('5000.00'),
          aporteLaboral: decimal('635.50'),
          ans: decimal('0.00'),
          rcIva: decimal('0.00'),
          otrosDescuentos: decimal('0.00'),
          totalDescuentos: decimal('635.50'),
          liquidoPagable: decimal('4364.50'),
          aportePatronal: decimal('835.50'),
        },
      ]),
    },
  };

  it('genera CSV y neutraliza fórmulas', async () => {
    const result = await new PlanillaExportService(prisma as any).exportar('p1', 'csv');
    expect(result.bytes.toString()).toContain("'=RIESGO");
  });

  it('genera un XLSX válido', async () => {
    const result = await new PlanillaExportService(prisma as any).exportar('p1', 'xlsx');
    expect(result.bytes.subarray(0, 2).toString()).toBe('PK');
  });
});
