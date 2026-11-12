export interface VacationCalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
}

function parseMonth(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new RangeError(`Mes de calendario inválido: ${month}`);
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getVacationMonthBounds(month: string) {
  const { year, monthIndex } = parseMonth(month);
  return {
    desde: `${month}-01`,
    hasta: dateKey(new Date(Date.UTC(year, monthIndex + 1, 0))),
  };
}

export function shiftVacationMonth(month: string, offset: number) {
  const { year, monthIndex } = parseMonth(month);
  const shifted = new Date(Date.UTC(year, monthIndex + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildVacationCalendarDays(month: string): VacationCalendarDay[] {
  const { year, monthIndex } = parseMonth(month);
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const offset = firstDay.getUTCDay();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(Date.UTC(year, monthIndex, index - offset + 1));
    return {
      date: dateKey(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex,
    };
  });
}

export function formatVacationMonth(month: string) {
  const { year, monthIndex } = parseMonth(month);
  return new Intl.DateTimeFormat('es-BO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
}
