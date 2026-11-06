import { matchGatewayRoute, permissionsSatisfy } from '../src/rbac/route-table';

describe('rutas RBAC de personal', () => {
  it('declara la simulación de baja solo para personal:baja', () => {
    const route = matchGatewayRoute(
      'POST',
      '/api/personal/employees/7b1f3658-60e1-4f4f-b30e-4404aa5bbfd8/baja/simular',
    );

    expect(route?.access).toEqual({ anyOf: ['personal:baja'] });
    expect(permissionsSatisfy(route?.access ?? 'authenticated', ['personal:baja'])).toBe(true);
    expect(permissionsSatisfy(route?.access ?? 'authenticated', [])).toBe(false);
  });
});
