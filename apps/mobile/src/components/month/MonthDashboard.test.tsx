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

function renderDashboard(status: MonthSummary['status'], months: MonthSummary[] = [makeMonth('2026-01', status)]) {
  const onPeriodChange = jest.fn();
  renderWithProviders(
    <MonthDashboard dashboard={makeDashboard({ status })} months={months} onPeriodChange={onPeriodChange} />,
  );
  return { onPeriodChange };
}

function button(name: string) {
  return screen.getByRole('button', { name });
}

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
    expect(await screen.findByText('Создан черновик: Февраль 2026.')).toBeTruthy();
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
    expect(await screen.findByText('Месяц Январь 2026 закрыт. Месяц Февраль 2026 теперь открыт.')).toBeTruthy();
  });

  it('NFR-18 / ADR 0005: a 409 VERSION_CONFLICT shows the API message and refetches the month data', async () => {
    const message = 'Месяц 2026-01 был изменён (version 4). Обновите данные и повторите.';
    mockRequest.mockImplementation(((config: { url?: string }) =>
      config.url?.endsWith('/close')
        ? Promise.reject(apiError(409, 'VERSION_CONFLICT', message))
        : Promise.resolve(undefined)) as never);
    renderDashboard('open');

    fireEvent.press(button('Закрыть'));

    expect(await screen.findByText(message)).toBeTruthy();
    // Active queries are refetched through invalidation; in this isolated render only the mutation call is made.
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({ url: '/api/v1/months/2026-01/close' });
  });

  it('AC-15: reopening asks for confirmation first and sends the version only after it', async () => {
    mockRequest.mockResolvedValue({
      data: { month: makeMonth('2026-01', 'reopened', 4), recalcRange: { from: '2026-01', to: '2026-03' } },
      warnings: [],
    } as never);
    renderDashboard('closed', [makeMonth('2026-01', 'closed'), makeMonth('2026-03', 'open')]);

    fireEvent.press(button('Открыть повторно'));
    expect(screen.getByText('Открыть Январь 2026 повторно?')).toBeTruthy();
    expect(screen.getByText('Все последующие месяцы будут пересчитаны.')).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();

    fireEvent.press(button('Подтвердить повторное открытие'));

    await waitFor(() =>
      expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({
        url: '/api/v1/months/2026-01/reopen',
        method: 'POST',
        data: { version: 3 },
      }),
    );
    // MON-12 (range after the fact, until the preview endpoint T-024 exists): taken from the reopen response.
    expect(await screen.findByText('Месяц открыт повторно. Пересчитаны месяцы с Январь 2026 по Март 2026.')).toBeTruthy();
  });

  it('cancelling the reopen confirmation sends nothing', () => {
    renderDashboard('closed');

    fireEvent.press(button('Открыть повторно'));
    fireEvent.press(within(screen.getByText('Открыть Январь 2026 повторно?').parent!.parent!).getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByText('Открыть Январь 2026 повторно?')).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
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
