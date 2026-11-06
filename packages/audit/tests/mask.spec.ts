import { maskSensitive } from '../src/mask';

describe('maskSensitive', () => {
  it('enmascara objetos anidados, arrays y claves en mayúsculas', () => {
    const masked = maskSensitive({
      usuario: {
        CI: '12345678',
        PasswordHash: 'hash-secreto',
        perfil: [{ tokenAcceso: 'abc', nombre: 'Laura' }],
      },
      remuneracionBasica: 1234,
      SUELDO: 999,
    });

    expect(masked).toEqual({
      usuario: {
        CI: '***5678',
        PasswordHash: '***',
        perfil: [{ tokenAcceso: '***', nombre: 'Laura' }],
      },
      remuneracionBasica: '***',
      SUELDO: '***',
    });
  });

  it('soporta referencias circulares sin fallar', () => {
    const value: Record<string, unknown> = { nombre: 'area' };
    value.padre = value;

    expect(maskSensitive(value)).toEqual({ nombre: 'area', padre: '[Circular]' });
  });

  it('soporta fechas y buffers sin exponer bytes', () => {
    expect(
      maskSensitive({
        fecha: new Date('2026-01-02T03:04:05.000Z'),
        firma: Buffer.from([1, 2, 3]),
      }),
    ).toEqual({ fecha: '2026-01-02T03:04:05.000Z', firma: '***' });
  });

  it('conserva solo los últimos cuatro caracteres del CI', () => {
    expect(maskSensitive({ ci: '7654321' })).toEqual({ ci: '***4321' });
    expect(maskSensitive({ CI: 12345678 })).toEqual({ CI: '***5678' });
  });

  it('trunca payloads mayores al límite y marca truncated', () => {
    const masked = maskSensitive(
      { texto: 'x'.repeat(200), anidado: { valor: 'y'.repeat(200) } },
      { maxBytes: 64 },
    );

    expect(masked).toMatchObject({ truncated: true });
    expect(typeof (masked as { preview: unknown }).preview).toBe('string');
  });

  it('acota la profundidad máxima', () => {
    const masked = maskSensitive(
      { a: { b: { c: { d: 'valor' } } } },
      { maxDepth: 2 },
    );

    expect(masked).toEqual({ a: { b: '[Profundidad máxima]' } });
  });
});
