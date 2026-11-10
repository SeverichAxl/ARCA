import { Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type ExportFormat = 'csv' | 'xlsx';
export interface ExportFile {
  bytes: Buffer;
  contentType: string;
  fileName: string;
}

const columns = [
  ['periodo', 'Periodo'],
  ['empleadoId', 'ID funcionario'],
  ['nombreCompleto', 'Funcionario'],
  ['ciEnmascarado', 'CI'],
  ['diasTrabajados', 'Días trabajados'],
  ['haberBasico', 'Haber básico'],
  ['haberGanado', 'Haber ganado'],
  ['bonoAntiguedad', 'Bono antigüedad'],
  ['otrosIngresos', 'Otros ingresos'],
  ['totalGanado', 'Total ganado'],
  ['aporteLaboral', 'Aporte laboral'],
  ['ans', 'ANS'],
  ['rcIva', 'RC-IVA'],
  ['otrosDescuentos', 'Otros descuentos'],
  ['totalDescuentos', 'Total descuentos'],
  ['liquidoPagable', 'Líquido pagable'],
  ['aportePatronal', 'Aporte patronal'],
] as const;

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

@Injectable()
export class PlanillaExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportar(planillaId: string, format: ExportFormat, areaId?: string): Promise<ExportFile> {
    const planilla = await this.prisma.planilla.findUnique({ where: { id: planillaId } });
    if (!planilla) throw new NotFoundException('Planilla no encontrada.');
    const rows = await this.prisma.planillaDetalleNomina.findMany({
      where: { planillaId, ...(areaId ? { areaId } : {}) },
      orderBy: [{ nombreCompleto: 'asc' }, { empleadoId: 'asc' }],
    });
    const data = rows.map((row) => ({
      ...row,
      periodo: planilla.periodo,
      haberBasico: row.haberBasico.toFixed(2),
      haberGanado: row.haberGanado.toFixed(2),
      bonoAntiguedad: row.bonoAntiguedad.toFixed(2),
      otrosIngresos: row.otrosIngresos.toFixed(2),
      totalGanado: row.totalGanado.toFixed(2),
      aporteLaboral: row.aporteLaboral.toFixed(2),
      ans: row.ans.toFixed(2),
      rcIva: row.rcIva.toFixed(2),
      otrosDescuentos: row.otrosDescuentos.toFixed(2),
      totalDescuentos: row.totalDescuentos.toFixed(2),
      liquidoPagable: row.liquidoPagable.toFixed(2),
      aportePatronal: row.aportePatronal.toFixed(2),
    })) as Array<Record<string, unknown>>;
    const base = `planilla-${planilla.periodo}`;
    if (format === 'csv') {
      const text = [
        columns.map(([, label]) => csvCell(label)).join(','),
        ...data.map((row) => columns.map(([key]) => csvCell(row[key])).join(',')),
      ].join('\r\n');
      return {
        bytes: Buffer.from(`\uFEFF${text}`, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        fileName: `${base}.csv`,
      };
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ARCA';
    const sheet = workbook.addWorksheet('Planilla');
    sheet.columns = columns.map(([key, header]) => ({ key, header, width: 22 }));
    sheet.addRows(data);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(columns.length).letter}1` };
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      bytes,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `${base}.xlsx`,
    };
  }
}
