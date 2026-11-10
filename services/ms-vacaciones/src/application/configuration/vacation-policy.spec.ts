import { HttpException } from '@nestjs/common';
import { assertManagementAvailable, vacationDaysForSeniority } from './vacation-policy';
const policy = {
  maxGestionesAcumuladas: 2,
  diasEscalaInicial: 15,
  diasEscalaMedia: 20,
  diasEscalaMayor: 30,
};
describe('política de vacaciones', () => {
  it.each([
    [0, 15],
    [4, 15],
    [5, 20],
    [9, 20],
    [10, 30],
    [25, 30],
  ])('aplica la escala a %i años', (years, days) =>
    expect(vacationDaysForSeniority(years, policy)).toBe(days),
  );
  it('devuelve GESTION_BLOQUEADA al alcanzar dos gestiones', () => {
    try {
      assertManagementAvailable(2, policy);
      throw new Error('debía fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'GESTION_BLOQUEADA' });
    }
  });
  it('permite acumular menos del límite', () =>
    expect(() => assertManagementAvailable(1, policy)).not.toThrow());
});
