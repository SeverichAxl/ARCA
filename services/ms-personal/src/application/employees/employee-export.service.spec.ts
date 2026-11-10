import { EmployeeExportService } from './employee-export.service';

describe('EmployeeExportService', () => {
  const principal = {
    userId: '11111111-1111-4111-8111-111111111111',
    empleadoId: null,
    rol: 'ENCARGADO_NOMINA',
    permisos: ['export:data'],
  };

  it('genera CSV filtrado sin remuneración cuando falta el permiso sensible', async () => {
    const employees = {
      list: jest.fn().mockResolvedValue({
        data: [{ id: 'e1', nombres: '=Ana', apellidos: 'Rojas', remuneracion: '5000.00' }],
        meta: { totalPages: 1 },
      }),
    };
    const result = await new EmployeeExportService(employees as any).exportar(
      { page: 1, pageSize: 20 },
      'csv',
      principal,
    );
    const csv = result.bytes.toString();
    expect(csv).toContain("'=Ana");
    expect(csv).not.toContain('Remuneración');
    expect(employees.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 100 }),
      principal,
    );
  });

  it('incluye remuneración solo con personal:read_salary y genera XLSX', async () => {
    const employees = {
      list: jest.fn().mockResolvedValue({
        data: [{ id: 'e1', nombres: 'Ana', apellidos: 'Rojas', remuneracion: '5000.00' }],
        meta: { totalPages: 1 },
      }),
    };
    const result = await new EmployeeExportService(employees as any).exportar(
      { page: 1, pageSize: 20 },
      'xlsx',
      { ...principal, permisos: ['export:data', 'personal:read_salary'] },
    );
    expect(result.bytes.subarray(0, 2).toString()).toBe('PK');
  });
});
