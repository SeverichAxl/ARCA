import { maskAuditPayload } from './audit-event.handler';

describe('maskAuditPayload', () => {
  it('enmascara secretos y conserva solo los últimos cuatro caracteres del CI', () => {
    expect(
      maskAuditPayload({
        ci: '12345678',
        passwordHash: 'hash',
        refreshToken: 'token',
        remuneracionCifrada: 'cipher',
        perfil: { nombre: 'Laura' },
      }),
    ).toEqual({
      ci: '***5678',
      passwordHash: '***',
      refreshToken: '***',
      remuneracionCifrada: '***',
      perfil: { nombre: 'Laura' },
    });
  });
});
