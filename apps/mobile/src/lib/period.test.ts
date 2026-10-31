import {
  adjacentYearPeriod,
  formatPeriodGenitive,
  formatPeriodLabel,
  formatPeriodLower,
  isValidPeriod,
  neighbourPeriod,
  nextPeriod,
} from './period';

describe('period helpers', () => {
  it('AC-21: labels are month-and-year only', () => {
    expect(formatPeriodLabel('2026-01')).toBe('Январь 2026');
    expect(formatPeriodLabel('2026-12')).toBe('Декабрь 2026');
  });

  it('ru-RU: month case forms for notices (nominative, lowercase, genitive)', () => {
    expect(formatPeriodLower('2026-02')).toBe('февраль 2026');
    expect(formatPeriodGenitive('2026-01')).toBe('января 2026');
    expect(formatPeriodGenitive('2026-03')).toBe('марта 2026');
    expect(formatPeriodGenitive('2026-05')).toBe('мая 2026');
    expect(formatPeriodGenitive('2026-08')).toBe('августа 2026');
    expect(formatPeriodGenitive('2026-12')).toBe('декабря 2026');
  });

  it('MON-06: next period rolls over the year', () => {
    expect(nextPeriod('2026-12')).toBe('2027-01');
    expect(nextPeriod('2026-02')).toBe('2026-03');
  });

  it('AC-21: accepts only YYYY-MM with a real month', () => {
    expect(isValidPeriod('2026-01')).toBe(true);
    expect(isValidPeriod('2026-13')).toBe(false);
    expect(isValidPeriod('2026-01-15')).toBe(false);
  });

  it('UI-06: month neighbours stay inside the existing periods', () => {
    const periods = ['2026-01', '2026-02', '2027-01'];
    expect(neighbourPeriod(periods, '2026-02', -1)).toBe('2026-01');
    expect(neighbourPeriod(periods, '2026-01', -1)).toBeNull();
    expect(neighbourPeriod(periods, '2027-01', 1)).toBeNull();
  });

  it('UI-06: year step lands on the closest existing month of that year', () => {
    const periods = ['2026-01', '2026-02', '2026-11', '2027-03'];
    expect(adjacentYearPeriod(periods, '2026-11', 1)).toBe('2027-03');
    expect(adjacentYearPeriod(periods, '2027-03', -1)).toBe('2026-02');
    expect(adjacentYearPeriod(periods, '2026-01', -1)).toBeNull();
  });
});
