import React from 'react';
import { ifMatchOf } from '../../../test/ifMatch';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders } from 'axios';
import { renderWithProviders } from '../../../test/render';
import { customAxiosInstance } from '../../api/axios-instance';
import { MONTH_LOCKED_MESSAGE } from '../../lib/apiErrors';
import { makeDashboard } from '../../../test/monthFixtures';
import { OperationForm } from './OperationForm';
import type { QuickActionKind } from './QuickActions';
import type { Dashboard } from './types';

jest.mock('../../api/axios-instance', () => ({
  __esModule: true,
  customAxiosInstance: jest.fn(),
  default: jest.fn(),
}));

const mockRequest = customAxiosInstance as jest.MockedFunction<typeof customAxiosInstance>;

const NBSP = ' ';

function apiError(status: number, error: string, message: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error, message },
  });
}

/** Продукты (balance 10 000), Дом (balance 6 000), Старый (archived). */
function makeDashboardWithEnvelopes(overrides: Partial<Dashboard['month']> = {}): Dashboard {
  const dashboard = makeDashboard(overrides);
  const [food] = dashboard.envelopes;
  if (!food) throw new Error('fixture has no envelope');
  dashboard.envelopes = [
    { ...food, envelopeId: 'e-food', name: 'Продукты', closing: '10000.00' },
    { ...food, envelopeId: 'e-home', name: 'Дом', closing: '6000.00' },
    { ...food, envelopeId: 'e-old', name: 'Старый', status: 'archived', closing: '0.00' },
  ];
  return dashboard;
}

function renderForm(kind: QuickActionKind, overrides: Partial<Dashboard['month']> = {}) {
  const onSaved = jest.fn();
  const onCancel = jest.fn();
  const { queryClient } = renderWithProviders(
    <OperationForm kind={kind} dashboard={makeDashboardWithEnvelopes(overrides)} onSaved={onSaved} onCancel={onCancel} />,
  );
  return { onSaved, onCancel, queryClient };
}

const created = (warnings: { code: string; message: string }[] = []) => ({ data: { operation: {}, result: {}, summary: {} }, warnings });

function press(name: string) {
  fireEvent.press(screen.getByRole('button', { name }));
}

function pick(group: string, envelope: string) {
  fireEvent.press(screen.getByRole('radio', { name: `${group}: ${envelope}` }));
}

function lastBody(): Record<string, unknown> {
  const call = mockRequest.mock.calls[mockRequest.mock.calls.length - 1];
  return (call?.[0] as { data: Record<string, unknown> }).data;
}

function lastIfMatch(): string | undefined {
  return ifMatchOf(mockRequest.mock.calls[mockRequest.mock.calls.length - 1]);
}

function postCalls() {
  return mockRequest.mock.calls.filter(([config]) => (config as { method?: string }).method === 'POST');
}

jest.setTimeout(20000); // first render compiles NativeWind/RN modules; slow on a loaded machine

describe('OperationForm', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('AC-05 / UI-16 / API-21 / API-25: an expense within the balance sends the displayed month, its version in If-Match and the amount', async () => {
    mockRequest.mockResolvedValue(created());
    const { onSaved } = renderForm('expense', { period: '2026-03', version: 7 });

    pick('Конверт', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '3000');
    expect(screen.queryByText(/будет отмечена как непокрытая/)).toBeNull();
    press('Сохранить списание');

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ kind: 'expense', warnings: [] }));
    expect(postCalls()).toHaveLength(1);
    expect(lastBody()).toEqual({
      type: 'expense',
      sourceEnvelopeId: 'e-food',
      amount: '3000.00',
      period: '2026-03',
    });
    expect(lastIfMatch()).toBe('"7"');
  });

  it('API-21 / UI-16: a reopened month is addressed by period and its own version', async () => {
    mockRequest.mockResolvedValue(created());
    renderForm('expense', { period: '2025-12', status: 'reopened', version: 11 });

    pick('Конверт', 'Дом');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '1');
    press('Сохранить списание');

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(lastBody()).toMatchObject({ period: '2025-12' });
    expect(lastIfMatch()).toBe('"11"');
  });

  it('MSG-02 / OP-06 / AC-06: an expense above the balance warns with the available amount and is saved in full after confirmation', async () => {
    mockRequest.mockResolvedValue(
      created([{ code: 'EXPENSE_EXCEEDS_BALANCE', message: `В конверте доступно 10${NBSP}000,00${NBSP}₽. 5${NBSP}000,00${NBSP}₽ будут отмечены как непокрытые.` }]),
    );
    const { onSaved } = renderForm('expense');

    pick('Конверт', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '15000');

    expect(screen.getByText(`В конверте доступно 10${NBSP}000,00${NBSP}₽. Остальная часть будет отмечена как непокрытая.`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Сохранить списание' })).toBeNull();
    press('Всё равно сохранить');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({ type: 'expense', amount: '15000.00' });
    // The uncovered part Y comes from the API warning, not from client arithmetic.
    expect(onSaved.mock.calls[0]?.[0].warnings).toEqual([
      `В конверте доступно 10${NBSP}000,00${NBSP}₽. 5${NBSP}000,00${NBSP}₽ будут отмечены как непокрытые.`,
    ]);
  });

  it('AC-21 / OP-13 / HIST-05: month-only form with an optional comment and no day field; amount accepts both separators', async () => {
    mockRequest.mockResolvedValue(created());
    renderForm('expense', { period: '2026-01' });

    expect(screen.getByText('Месяц: Январь 2026')).toBeTruthy();
    expect(screen.queryByLabelText(/день|дата|число/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/ДД|дд\.мм|гггг/i)).toBeNull();
    expect(screen.getByLabelText('Комментарий').props.maxLength).toBe(500);

    pick('Конверт', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '1 500,5');
    fireEvent.changeText(screen.getByLabelText('Комментарий'), '  Молоко  ');
    press('Сохранить списание');
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(lastBody()).toMatchObject({ amount: '1500.50', comment: 'Молоко' });
  });

  it('AC-21: the transfer and adjustment forms have no day field either', () => {
    for (const kind of ['transfer', 'adjustment'] as const) {
      const { unmount } = renderWithProviders(
        <OperationForm kind={kind} dashboard={makeDashboardWithEnvelopes()} onSaved={jest.fn()} onCancel={jest.fn()} />,
      );
      expect(screen.queryByLabelText(/день|дата|число/i)).toBeNull();
      expect(screen.getByText('Месяц: Январь 2026')).toBeTruthy();
      unmount();
    }
  });

  it('OP-13: the comment is optional and omitted from the request when empty', async () => {
    mockRequest.mockResolvedValue(created());
    renderForm('expense');

    pick('Конверт', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '10.5');
    press('Сохранить списание');
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(lastBody()).not.toHaveProperty('comment');
    expect(lastBody()).toMatchObject({ amount: '10.50' });
  });

  it('ENV-12: archived envelopes are not offered in the pickers', () => {
    renderForm('transfer');

    expect(screen.getByRole('radio', { name: 'Откуда: Продукты' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Старый/ })).toBeNull();
  });

  it('validation: no envelope, an empty or zero amount and an invalid amount block the request', async () => {
    renderForm('expense');

    press('Сохранить списание');
    expect(await screen.findByText('Выберите конверт')).toBeTruthy();
    expect(await screen.findByText('Сумма в рублях, до 2 знаков после запятой')).toBeTruthy();

    pick('Конверт', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '0');
    press('Сохранить списание');
    await waitFor(() => expect(screen.getByText('Сумма в рублях, до 2 знаков после запятой')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Сумма'), '12,345');
    press('Сохранить списание');
    await waitFor(() => expect(screen.getByText('Сумма в рублях, до 2 знаков после запятой')).toBeTruthy());
    expect(postCalls()).toHaveLength(0);
  });

  it('OP-02: a transfer needs a destination different from the source', async () => {
    renderForm('transfer');

    pick('Откуда', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '100');
    press('Сохранить перевод');
    expect(await screen.findByText('Выберите конверт-получатель')).toBeTruthy();
    // The source is not offered as a destination.
    expect(screen.queryByRole('radio', { name: 'Куда: Продукты' })).toBeNull();
    expect(postCalls()).toHaveLength(0);
  });

  it('MSG-03 / OP-07 / AC-07: a transfer above the available amount is refused; one click transfers only the available amount', async () => {
    const message = `Доступно 6${NBSP}000,00${NBSP}₽. Перевести только 6${NBSP}000,00${NBSP}₽?`;
    mockRequest.mockRejectedValueOnce(apiError(409, 'TRANSFER_EXCEEDS_BALANCE', message)).mockResolvedValue(created());
    const { onSaved } = renderForm('transfer', { period: '2026-02', version: 4 });

    pick('Откуда', 'Дом');
    pick('Куда', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '10000');
    press('Сохранить перевод');

    expect(await screen.findByText(message)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(lastBody()).toMatchObject({ type: 'transfer', sourceEnvelopeId: 'e-home', destinationEnvelopeId: 'e-food', amount: '10000.00' });

    press(`Перевести только 6${NBSP}000,00${NBSP}₽`);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ kind: 'transfer', warnings: [] }));
    expect(postCalls()).toHaveLength(2);
    expect(lastBody()).toEqual({
      type: 'transfer',
      sourceEnvelopeId: 'e-home',
      destinationEnvelopeId: 'e-food',
      amount: '6000.00',
      period: '2026-02',
    });
    expect(lastIfMatch()).toBe('"4"');
  });

  it('MSG-03: with nothing available the transfer refusal offers no replacement button', async () => {
    mockRequest.mockRejectedValue(apiError(409, 'TRANSFER_EXCEEDS_BALANCE', 'Доступно 0,00 ₽. Перевести только 0,00 ₽?'));
    const dashboard = makeDashboardWithEnvelopes();
    dashboard.envelopes = dashboard.envelopes.map((e) => (e.envelopeId === 'e-home' ? { ...e, closing: '0.00' } : e));
    renderWithProviders(<OperationForm kind="transfer" dashboard={dashboard} onSaved={jest.fn()} onCancel={jest.fn()} />);

    pick('Откуда', 'Дом');
    pick('Куда', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '1');
    press('Сохранить перевод');

    expect(await screen.findByText(/Доступно 0,00 ₽/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Перевести только/ })).toBeNull();
  });

  it('AC-09 / OP-13: a positive adjustment needs no confirmation and sends the sign', async () => {
    mockRequest.mockResolvedValue(created());
    renderForm('adjustment');

    pick('Конверт', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '5000');
    expect(screen.queryByText(/Баланс станет/)).toBeNull();
    press('Сохранить корректировку');

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(lastBody()).toMatchObject({ type: 'adjustment', sign: '+', amount: '5000.00', sourceEnvelopeId: 'e-food' });
  });

  it('MSG-04 / OP-12 / AC-10: a negative adjustment above the balance asks confirmation and is then saved in full', async () => {
    mockRequest.mockResolvedValue(
      created([{ code: 'ADJUSTMENT_EXCEEDS_BALANCE', message: `Баланс станет 0${NBSP}₽, 5${NBSP}000,00${NBSP}₽ будут отмечены как непокрытые.` }]),
    );
    const { onSaved } = renderForm('adjustment');

    pick('Конверт', 'Продукты');
    fireEvent.press(screen.getByRole('radio', { name: 'Уменьшить' }));
    fireEvent.changeText(screen.getByLabelText('Сумма'), '15000');

    expect(screen.getByText(`Баланс станет 0,00${NBSP}₽, остальная часть будет отмечена как непокрытая.`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Сохранить корректировку' })).toBeNull();
    press('Всё равно сохранить');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({ type: 'adjustment', sign: '-', amount: '15000.00' });
    expect(onSaved.mock.calls[0]?.[0].warnings).toHaveLength(1);
  });

  it('MSG-06: a closed month disables the form and explains why', () => {
    renderForm('expense', { status: 'closed' });

    expect(screen.getByText(MONTH_LOCKED_MESSAGE)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить списание' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('radio', { name: 'Конверт: Продукты' }).props.accessibilityState.disabled).toBe(true);
    expect(postCalls()).toHaveLength(0);
  });

  it('MSG-06: MONTH_LOCKED from the API shows the verbatim message', async () => {
    mockRequest.mockRejectedValue(apiError(409, 'MONTH_LOCKED', 'whatever'));
    renderForm('expense');

    pick('Конверт', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '1');
    press('Сохранить списание');

    expect(await screen.findByText(MONTH_LOCKED_MESSAGE)).toBeTruthy();
  });

  it('ADR 0005: VERSION_CONFLICT shows the API message and refetches the month data', async () => {
    mockRequest.mockRejectedValue(apiError(409, 'VERSION_CONFLICT', 'Месяц изменился. Обновите данные и повторите.'));
    const { onSaved, queryClient } = renderForm('expense');
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    pick('Конверт', 'Продукты');
    fireEvent.changeText(screen.getByLabelText('Сумма'), '1');
    press('Сохранить списание');

    expect(await screen.findByText('Месяц изменился. Обновите данные и повторите.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    // dashboard, month list, envelopes (month data) and operation history
    await waitFor(() => expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(4));
  });
});
