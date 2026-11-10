import { Injectable } from '@nestjs/common';
import type { InternalPrincipal } from '@arca/internal-auth';
import ExcelJS from 'exceljs';
import type { ListEmployeesQueryDto } from './employee.dto';
import { EmployeeService } from './employee.service';

export interface PersonalExportFile {
  bytes: Buffer;
  contentType: string;
  fileName: string;
}

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

@Injectable()
export class EmployeeExportService {
  constructor(private readonly employees: EmployeeService) {}

  async exportar(
    query: ListEmployeesQueryDto,
    format: 'csv' | 'xlsx',
    principal: InternalPrincipal,
  ): Promise<PersonalExportFile> {
    const rows: Array<Record<string, unknown>> = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await this.employees.list({ ...query, page, pageSize: 100 }, principal);
      rows.push(...(result.data as Array<Record<string, unknown>>));
      totalPages = result.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    const mayReadSalary = principal.permisos.includes('personal:read_salary');
    const columns: Array<[string, string]> = [
      ['id', 'ID'],
      ['nombres', 'Nombres'],
      ['apellidos', 'Apellidos'],
      ['ci', 'CI'],
      ['areaId', 'Área'],
      ['cargoId', 'Cargo'],
      ['estado', 'Estado'],
      ['fechaIngreso', 'Fecha de ingreso'],
      ['email', 'Correo'],
      ['telefono', 'Teléfono'],
      ...(mayReadSalary ? ([['remuneracion', 'Remuneración']] as Array<[string, string]>) : []),
    ];
    if (format === 'csv') {
      const text = [
        columns.map(([, label]) => csvCell(label)).join(','),
        ...rows.map((row) => columns.map(([key]) => csvCell(row[key])).join(',')),
      ].join('\r\n');
      return {
        bytes: Buffer.from(`\uFEFF${text}`, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        fileName: 'personal.csv',
      };
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ARCA';
    const sheet = workbook.addWorksheet('Personal');
    sheet.columns = columns.map(([key, header]) => ({ key, header, width: 22 }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(columns.length).letter}1` };
    return {
      bytes: Buffer.from(await workbook.xlsx.writeBuffer()),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: 'personal.xlsx',
    };
  }
}
