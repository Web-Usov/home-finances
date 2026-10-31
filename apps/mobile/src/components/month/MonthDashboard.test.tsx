import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders } from 'axios';
import { renderWithProviders } from '../../../test/render';
import { customAxiosInstance } from '../../api/axios-instance';
import { MONTH_LOCKED_MESSAGE } from '../../lib/apiErrors';
import { makeDashboard, makeMonth } from '../../../test/monthFixtures';
import { MonthDashboard } from './MonthDashboard';
import type { MonthSummary } from './types';

jest.mock('../../api/axios-instance', () => ({
  __esModule: true,
  customAxiosInstance: jest.fn(),
  default: jest.fn(),
}));

const mockRequest = customAxiosInstance as jest.MockedFunction<typeof customAxiosInstance>;

const NBSP = ' ';

function apiError(status: number, error: string, message: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error, message },
  });
}

function renderDashboard(
  status: MonthSummary['status'],
  months: MonthSummary[] = [makeMonth('2026-01', status)],
  period = '2026-01',
) {
  const onPeriodChange = jest.fn();
  const { queryClient } = renderWithProviders(
    <MonthDashboard dashboard={makeDashboard({ status, period })} months={months} onPeriodChange={onPeriodChange} />,
  );
  return { onPeriodChange, queryClient };
}

function button(name: string) {
  return screen.getByRole('button', { name });
}

jest.setTimeout(20000); // first render compiles NativeWind/RN modules; slow on a loaded machine

describe('MonthDashboard', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('UI-07: shows income, allocated and free from the dashboard response', () => {
    renderDashboard('open');

    expect(screen.getByLabelText(`Доход: 100${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    expect(screen.getByLabelText(`Распределено: 60${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    expect(screen.getByLabelText(`Свободно: 40${NBSP}000,00${NBSP}₽`)).toBeTruthy();
  });

  it('FIN-11 / UI-07: negative free funds of a draft are shown signed and in red, not clamped to zero', () => {
    const dashboard = makeDashboard({ status: 'draft' });
    dashboard.summary = { ...dashboard.summary, income: '0.00', allocated: '75000.00', free: '-75000.00' };
    renderWithProviders(<MonthDashboard dashboard={dashboard} months={[makeMonth('2026-01', 'draft')]} onPeriodChange={jest.fn()} />);

    const free = screen.getByLabelText(`Свободно: −75${NBSP}000,00${NBSP}₽`);
    expect(free.props.className).toContain('text-danger');
  });

  it('UI-07 / UI-09: shows the net adjustment separately and uncovered amounts with a type breakdown', () => {
    renderDashboard('open');

    expect(screen.getByText('Корректировки (чистые)')).toBeTruthy();
    expect(screen.getByText(`−200,00${NBSP}₽`)).toBeTruthy();
    expect(screen.getByText('Не покрыто')).toBeTruthy();
    expect(screen.getByText('Списания')).toBeTruthy();
    expect(screen.getByText('Переводы')).toBeTruthy();
  });

  it('UI-08: lists every envelope with its closing balance, replenishment, spending and uncovered part', () => {
    renderDashboard('open');

    expect(screen.getByText('Продукты')).toBeTruthy();
    expect(screen.getByLabelText(`Остаток: 54${NBSP}999,50${NBSP}₽`)).toBeTruthy();
    expect(screen.getByText('Пополнено распределением')).toBeTruthy();
    expect(screen.getByText('Списано')).toBeTruthy();
    expect(screen.getByText(`Не покрыто: 300,00${NBSP}₽`)).toBeTruthy();
  });

  it('UI-06: shows the month, the status and a month/year switcher', () => {
    const { onPeriodChange } = renderDashboard('open', [makeMonth('2025-12', 'closed'), makeMonth('2026-01', 'open')]);

    expect(screen.getByText('Январь 2026')).toBeTruthy();
    expect(screen.getByLabelText('Статус месяца: Открыт')).toBeTruthy();
    fireEvent.press(button('Предыдущий месяц'));
    expect(onPeriodChange).toHaveBeenCalledWith('2025-12');
    expect(button('Следующий месяц').props.accessibilityState.disabled).toBe(true);
  });

  it('MSG-06 / AC-14: quick actions are disabled in a closed month', () => {
    renderDashboard('closed');

    for (const name of ['Списать', 'Перевести', 'Скорректировать', 'Изменить доход']) {
      expect(button(name).props.accessibilityState.disabled).toBe(true);
    }
    expect(screen.getByText(MONTH_LOCKED_MESSAGE)).toBeTruthy();
    expect(MONTH_LOCKED_MESSAGE).toBe('Месяц закрыт. Откройте его повторно, чтобы внести изменения.');
  });

  it('UI-10: quick actions are enabled in an open month', () => {
    renderDashboard('open');

    for (const name of ['Списать', 'Перевести', 'Скорректировать']) {
      expect(button(name).props.accessibilityState.disabled).toBe(false);
    }
    expect(screen.queryByText(MONTH_LOCKED_MESSAGE)).toBeNull();
  });

  it('AC-16 / MON-01: a draft allows edits but cannot be closed', () => {
    renderDashboard('draft', [makeMonth('2025-12', 'open'), makeMonth('2026-01', 'draft')]);

    expect(button('Закрыть').props.accessibilityState.disabled).toBe(true);
    expect(button('Открыть повторно').props.accessibilityState.disabled).toBe(true);
    expect(button('Списать').props.accessibilityState.disabled).toBe(false);
  });

  it('MON-07: creating the next month is disabled while a draft exists', () => {
    renderDashboard('open', [makeMonth('2026-01', 'open'), makeMonth('2026-02', 'draft')]);

    expect(button('Создать следующий').props.accessibilityState.disabled).toBe(true);
  });

  it('MON-06: "Создать следующий" is disabled on a past month, with a hint pointing to the latest month', () => {
    renderDashboard('closed', [makeMonth('2026-01', 'closed'), makeMonth('2026-02', 'open')]);

    expect(button('Создать следующий').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Следующий месяц создаётся на экране последнего месяца: февраль 2026.')).toBeTruthy();
  });

  it('MON-06: "Создать следующий" is enabled on the latest month when there is no draft', () => {
    renderDashboard('open', [makeMonth('2026-01', 'closed'), makeMonth('2026-02', 'open')], '2026-02');

    expect(button('Создать следующий').props.accessibilityState.disabled).toBe(false);
  });

  it('MON-13: reopening is disabled while another month is reopened', () => {
    renderDashboard('closed', [makeMonth('2026-01', 'closed'), makeMonth('2026-02', 'reopened')]);

    expect(button('Открыть повторно').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Одновременно можно исправлять только один закрытый месяц.')).toBeTruthy();
  });

  it('MON-06 / MON-07: "Создать следующий" posts the immediately following period and reports the draft', async () => {
    mockRequest.mockResolvedValue({ month: makeMonth('2026-02', 'draft') } as never);
    renderDashboard('open', [makeMonth('2025-12', 'closed'), makeMonth('2026-01', 'open')]);

    fireEvent.press(button('Создать следующий'));

    await waitFor(() => expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({ url: '/api/v1/months', method: 'POST', data: { period: '2026-02' } }));
    expect(await screen.findByText('Черновик февраля 2026 создан.')).toBeTruthy();
  });

  it('MON-08: closing sends the month version and reports the promoted draft', async () => {
    mockRequest.mockResolvedValue({
      data: { month: makeMonth('2026-01', 'closed', 4), promotedDraft: makeMonth('2026-02', 'open') },
      warnings: [],
    } as never);
    renderDashboard('open', [makeMonth('2026-01', 'open'), makeMonth('2026-02', 'draft')]);

    fireEvent.press(button('Закрыть'));

    await waitFor(() =>
      expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({
        url: '/api/v1/months/2026-01/close',
        method: 'POST',
        data: { version: 3 },
      }),
    );
    expect(await screen.findByText('Январь 2026 закрыт. Февраль 2026 теперь открыт.')).toBeTruthy();
  });

  it('NFR-18 / ADR 0005: a 409 VERSION_CONFLICT shows the API message and refetches the month data', async () => {
    const message = 'Месяц 2026-01 был изменён (version 4). Обновите данные и повторите.';
    mockRequest.mockImplementation(((config: { url?: string }) =>
      config.url?.endsWith('/close')
        ? Promise.reject(apiError(409, 'VERSION_CONFLICT', message))
        : Promise.resolve(undefined)) as never);
    const { queryClient } = renderDashboard('open');
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    fireEvent.press(button('Закрыть'));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({ url: '/api/v1/months/2026-01/close' });
    // The month data is refetched so the retry uses the current version.
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([['/api/v1/dashboard/monthly'], ['/api/v1/months']]),
    );
  });

  it('MON-12 / AC-15: reopen shows the recalculation range from the preview before confirming', async () => {
    mockRequest.mockImplementation((async (config: { url?: string }) => {
      if (config.url === '/api/v1/months/2026-01/reopen-preview') {
        return { month: makeMonth('2026-01', 'closed'), recalcRange: { from: '2026-01', to: '2026-03' } };
      }
      return {
        data: { month: makeMonth('2026-01', 'reopened', 4), recalcRange: { from: '2026-01', to: '2026-02' } },
        warnings: [],
      };
    }) as never);
    renderDashboard('closed', [makeMonth('2026-01', 'closed'), makeMonth('2026-03', 'open')]);

    fireEvent.press(button('Открыть повторно'));
    expect(screen.getByText('Открыть январь 2026 повторно?')).toBeTruthy();
    expect(await screen.findByText('Будут пересчитаны месяцы с января 2026 по март 2026.')).toBeTruthy();
    // Only the read-only preview was requested so far.
    expect(mockRequest.mock.calls.map(([config]) => `${config.method} ${config.url}`)).toEqual([
      'GET /api/v1/months/2026-01/reopen-preview',
    ]);

    fireEvent.press(button('Подтвердить повторное открытие'));

    await waitFor(() =>
      expect(mockRequest.mock.calls[1]?.[0]).toMatchObject({
        url: '/api/v1/months/2026-01/reopen',
        method: 'POST',
        data: { version: 3 },
      }),
    );
    // The reopen response stays authoritative: its range is reported afterwards.
    expect(await screen.findByText('Январь 2026 открыт повторно. Пересчитаны месяцы с января 2026 по февраль 2026.')).toBeTruthy();
  });

  it('MON-12: a refused preview shows the API message and nothing can be confirmed', async () => {
    mockRequest.mockRejectedValue(apiError(409, 'INVALID_STATUS_TRANSITION', 'Месяц нельзя открыть повторно.'));
    renderDashboard('closed');

    fireEvent.press(button('Открыть повторно'));

    expect(await screen.findByText('Месяц нельзя открыть повторно.')).toBeTruthy();
    expect(button('Подтвердить повторное открытие').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(button('Подтвердить повторное открытие'));
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('cancelling the reopen confirmation sends nothing', () => {
    mockRequest.mockResolvedValue({
      month: makeMonth('2026-01', 'closed'),
      recalcRange: { from: '2026-01', to: '2026-01' },
    } as never);
    renderDashboard('closed');

    fireEvent.press(button('Открыть повторно'));
    fireEvent.press(within(screen.getByText('Открыть январь 2026 повторно?').parent!.parent!).getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByText('Открыть январь 2026 повторно?')).toBeNull();
    // Only the read-only preview may have been requested; nothing is written.
    expect(mockRequest.mock.calls.filter(([config]) => config.method !== 'GET')).toEqual([]);
  });

  it('MSG-06: a MONTH_LOCKED refusal while saving income shows the verbatim closed-month text', async () => {
    mockRequest.mockRejectedValue(apiError(409, 'MONTH_LOCKED', 'какой-то другой текст сервера'));
    renderDashboard('open');

    fireEvent.press(button('Изменить доход'));
    fireEvent.changeText(screen.getByLabelText('Доход месяца'), '120000');
    fireEvent.press(button('Сохранить доход'));

    expect(await screen.findByText(MONTH_LOCKED_MESSAGE)).toBeTruthy();
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({
      url: '/api/v1/months/2026-01',
      method: 'PATCH',
      data: { income: '120000', version: 3 },
    });
  });

  it('MSG-01: a rejected income shows the API message', async () => {
    const message = 'Распределено на 10.00 ₽ больше дохода. Уменьшите суммы по конвертам.';
    mockRequest.mockRejectedValue(apiError(422, 'ALLOCATION_EXCEEDS_INCOME', message));
    renderDashboard('open');

    fireEvent.press(button('Изменить доход'));
    fireEvent.changeText(screen.getByLabelText('Доход месяца'), '1,5');
    fireEvent.press(button('Сохранить доход'));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({ data: { income: '1.5' } });
  });

  it('shows dashboard warnings', () => {
    const dashboard = makeDashboard();
    dashboard.warnings = [{ code: 'ARCHIVED_ENVELOPE_HAS_BALANCE', message: 'Архивный конверт «Отпуск» имеет остаток.' }];
    renderWithProviders(<MonthDashboard dashboard={dashboard} months={[makeMonth('2026-01', 'open')]} onPeriodChange={jest.fn()} />);

    expect(screen.getByText('Архивный конверт «Отпуск» имеет остаток.')).toBeTruthy();
  });
});
