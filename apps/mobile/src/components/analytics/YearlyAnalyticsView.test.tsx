import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FOOD_ID, OLD_ID, makeYearly } from '../../../test/analyticsFixtures';
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
    expect(buildHistoryLink(onDrillDown.mock.calls[0][0])).toEqual({ pathname: '/history', params: { period: '2026-02', type: 'expense', uncoveredOnly: 'true' } });
    fireEvent.press(screen.getByLabelText(new RegExp('^Февраль 2026, всего')));
    expect(onDrillDown).toHaveBeenLastCalledWith({ period: '2026-02' });
  });

  it('REP-10 / REP-11: zero uncovered values and totals are not links', () => {
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={jest.fn()} />);
    expect(screen.queryByLabelText(/^Январь 2026, списания/)).toBeNull();
    expect(screen.queryByLabelText(/^Итого, всего/)).toBeNull();
  });

  describe('REP-07: balance line chart', () => {
    function renderChart(data = makeYearly()) {
      render(<YearlyAnalyticsView data={data} onDrillDown={jest.fn()} />);
      act(() => {
        fireEvent(screen.getByTestId('balance-chart', { hidden: true }).children[0] as never, 'layout', { nativeEvent: { layout: { width: 340, height: 160 } } });
      });
    }
    const series = (id: string) => screen.queryByTestId(`balance-series-${id}`, { hidden: true });

    it('REP-07: the picker selects which envelopes are drawn', () => {
      renderChart();
      expect(series(FOOD_ID)).toBeTruthy();
      expect(series(OLD_ID)).toBeTruthy();
      fireEvent.press(screen.getByLabelText('График: Старый конверт'));
      expect(series(OLD_ID)).toBeNull();
      expect(series(FOOD_ID)).toBeTruthy();
      expect(within(screen.getByTestId('balance-legend', { hidden: true })).queryByText(/Старый конверт/)).toBeNull();
      fireEvent.press(screen.getByLabelText('График: Продукты'));
      expect(screen.getByText('Выберите конверты, чтобы построить график', { hidden: true })).toBeTruthy();
      expect(screen.getByLabelText('График: Продукты').props.accessibilityState).toEqual({ checked: false });
    });

    it('REP-07: null months are gaps — no point and no segment across them', () => {
      const data = makeYearly();
      const food = data.envelopeBalances.envelopes[0];
      if (!food) throw new Error('fixture');
      food.months = food.months.map((m, i) => ({ ...m, closing: i === 0 ? '10000.00' : i === 2 ? '8000.00' : null }));
      renderChart(data);
      const foodSeries = series(FOOD_ID);
      if (!foodSeries) throw new Error('no series');
      expect(within(foodSeries).getAllByTestId('balance-point', { hidden: true })).toHaveLength(2);
      expect(within(foodSeries).queryAllByTestId('balance-segment', { hidden: true })).toHaveLength(0);
    });

    it('REP-07: consecutive months are joined by segments', () => {
      renderChart();
      const foodSeries = series(FOOD_ID);
      if (!foodSeries) throw new Error('no series');
      expect(within(foodSeries).getAllByTestId('balance-point', { hidden: true })).toHaveLength(2);
      expect(within(foodSeries).getAllByTestId('balance-segment', { hidden: true })).toHaveLength(1);
    });
  });

  it('REP-10: per-envelope uncovered values drill down with envelopeId and type', () => {
    const onDrillDown = jest.fn();
    render(<YearlyAnalyticsView data={makeYearly()} onDrillDown={onDrillDown} />);
    fireEvent.press(screen.getByLabelText(/^Февраль 2026, Продукты, списания/));
    expect(onDrillDown).toHaveBeenLastCalledWith({ period: '2026-02', envelopeId: FOOD_ID, type: 'expense' });
    fireEvent.press(screen.getByLabelText(/^Февраль 2026, Продукты, всего/));
    expect(onDrillDown).toHaveBeenLastCalledWith({ period: '2026-02', envelopeId: FOOD_ID });
  });
});
