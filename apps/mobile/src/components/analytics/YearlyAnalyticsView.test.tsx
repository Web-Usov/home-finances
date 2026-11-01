import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { makeYearly } from '../../../test/analyticsFixtures';
import { buildHistoryLink } from '../../lib/drillDown';
import { YearlyAnalyticsView } from './YearlyAnalyticsView';

const NBSP = ' ';

describe('yearly analytics reports', () => {
  it('REP-02: grouped chart data has 12 months', () => {
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={jest.fn()} />);
    expect(screen.getAllByTestId('income-chart-month', { hidden: true })).toHaveLength(12);
  });

  it('REP-03 / REP-04: income table shows exact values, totals, "—" for missing months and a highlighted negative free', () => {
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={jest.fn()} />);
    const feb = screen.getByLabelText('Доход, Февраль 2026');
    expect(within(feb).getByText(`−20${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    expect(within(feb).getByText(`−20${NBSP}000,00${NBSP}₽`).props.className).toContain('text-danger');
    const mar = screen.getByLabelText('Доход, Март 2026');
    expect(within(mar).getAllByText('—')).toHaveLength(3);
    const total = screen.getByLabelText('Доход, итого за год');
    expect(within(total).getByText(`150${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    expect(within(total).getByText(`20${NBSP}000,00${NBSP}₽`).props.className).not.toContain('text-danger');
  });

  it('REP-05: missing envelope months are "—", not 0', () => {
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={jest.fn()} />);
    const food = screen.getByLabelText('Продукты');
    expect(within(food).getAllByText('—')).toHaveLength(10);
    expect(within(food).getAllByText(`10${NBSP}000,00${NBSP}₽`)).toHaveLength(2);
  });

  it('REP-06: archived envelopes can be toggled in the balance table', () => {
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={jest.fn()} />);
    expect(screen.getByLabelText('Старый конверт, архивный')).toBeTruthy();
    expect(screen.getByText('В архиве')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Архивные конверты'));
    expect(screen.queryByLabelText('Старый конверт, архивный')).toBeNull();
    expect(screen.getByLabelText('Продукты')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Архивные конверты'));
    expect(screen.getByLabelText('Старый конверт, архивный')).toBeTruthy();
  });

  it('REP-08 / REP-09: uncovered table shows expense, transfer, adjustment and totals', () => {
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={jest.fn()} />);
    const feb = screen.getByLabelText('Непокрытые, Февраль 2026');
    expect(within(feb).getByText(`1${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    expect(within(feb).getByText(`500,00${NBSP}₽`)).toBeTruthy();
    expect(within(feb).getByText(`1${NBSP}500,00${NBSP}₽`)).toBeTruthy();
    const total = screen.getByLabelText('Непокрытые, итого за год');
    expect(within(total).getByText(`1${NBSP}500,00${NBSP}₽`)).toBeTruthy();
  });

  it('REP-10: clicking an uncovered value navigates to history with filters', () => {
    const onDrillDown = jest.fn();
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={onDrillDown} />);
    fireEvent.press(screen.getByLabelText(new RegExp(`^Февраль 2026, списания: 1${NBSP}000,00`)));
    expect(onDrillDown).toHaveBeenLastCalledWith({ period: '2026-02', type: 'expense' });
    expect(buildHistoryLink(onDrillDown.mock.calls[0][0])).toEqual({ pathname: '/history', params: { period: '2026-02', type: 'expense' } });
    fireEvent.press(screen.getByLabelText(new RegExp('^Февраль 2026, всего')));
    expect(onDrillDown).toHaveBeenLastCalledWith({ period: '2026-02' });
  });

  it('REP-10 / REP-11: zero uncovered values and totals are not links', () => {
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={jest.fn()} />);
    expect(screen.queryByLabelText(/^Январь 2026, списания/)).toBeNull();
    expect(screen.queryByLabelText(/^Итого, всего/)).toBeNull();
  });
});
