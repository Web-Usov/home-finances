import React from 'react';
import { ifMatchOf } from '../../../test/ifMatch';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { renderWithProviders } from '../../../test/render';
import { makeDashboard, makeMonth } from '../../../test/monthFixtures';
import { customAxiosInstance } from '../../api/axios-instance';
import { MONTH_LOCKED_MESSAGE } from '../../lib/apiErrors';
import type { Dashboard } from '../month/types';
import { HistoryView } from './HistoryView';
import type { HistoryTypeFilter } from './HistoryView';
import type { HistoryOperation } from './types';

jest.mock('../../api/axios-instance', () => ({
  __esModule: true,
  customAxiosInstance: jest.fn(),
  default: jest.fn(),
}));

const mockRequest = customAxiosInstance as jest.MockedFunction<typeof customAxiosInstance>;

jest.setTimeout(20000);

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

function makeDashboardWithEnvelopes(overrides: Partial<Dashboard['month']> = {}): Dashboard {
  const dashboard = makeDashboard(overrides);
  const [food] = dashboard.envelopes;
  if (!food) throw new Error('fixture has no envelope');
  dashboard.envelopes = [
    { ...food, envelopeId: 'e-food', name: 'Продукты', closing: '10000.00' },
    { ...food, envelopeId: 'e-home', name: 'Дом', closing: '6000.00' },
  ];
  return dashboard;
}

function makeOperation(overrides: Partial<HistoryOperation> & { id: string; sequenceNo: number }): HistoryOperation {
  return {
    monthId: 'm-2026-01',
    type: 'expense',
    sourceEnvelopeId: 'e-food',
    destinationEnvelopeId: null,
    requestedMinor: 300_000,
    sign: null,
    isInitial: false,
    comment: null,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    period: '2026-01',
    result: {
      id: `r-${overrides.id}`,
      operationId: overrides.id,
      coveredMinor: 300_000,
      uncoveredMinor: 0,
      sourceBalanceBefore: 1_000_000,
      sourceBalanceAfter: 700_000,
      destinationBalanceBefore: null,
      destinationBalanceAfter: null,
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    },
    ...overrides,
  } as HistoryOperation;
}

const OPERATIONS: HistoryOperation[] = [
  makeOperation({ id: 'op-1', sequenceNo: 1, comment: 'Продукты на неделю' }),
  makeOperation({
    id: 'op-2',
    sequenceNo: 2,
    type: 'transfer',
    sourceEnvelopeId: 'e-home',
    destinationEnvelopeId: 'e-food',
    requestedMinor: 1_000_000,
    result: {
      ...(makeOperation({ id: 'op-2', sequenceNo: 2 }).result as NonNullable<HistoryOperation['result']>),
      coveredMinor: 600_000,
      uncoveredMinor: 400_000,
      sourceBalanceBefore: 600_000,
      sourceBalanceAfter: 0,
    },
  }),
  makeOperation({
    id: 'op-0',
    sequenceNo: 0,
    type: 'initial_balance',
    isInitial: true,
    requestedMinor: 777_700,
    result: null,
  }),
];

interface Calls {
  list: Record<string, unknown>[];
  patch: { url?: string; data?: Record<string, unknown>; ifMatch?: string }[];
  del: { url?: string; params?: Record<string, unknown>; ifMatch?: string }[];
}

/** Routes the mocked axios instance: the list honours the `type`/`envelopeId` params like the API would. */
function mockApi(operations: HistoryOperation[] = OPERATIONS): Calls {
  const calls: Calls = { list: [], patch: [], del: [] };
  mockRequest.mockImplementation((async (
    config: { url?: string; method?: string; params?: Record<string, unknown>; data?: Record<string, unknown> },
    options?: unknown,
  ) => {
    if (config.method === 'GET') {
      calls.list.push(config.params ?? {});
      const { type, envelopeId } = config.params ?? {};
      return {
        operations: operations.filter(
          (op) =>
            (type === undefined || op.type === type) &&
            (envelopeId === undefined || op.sourceEnvelopeId === envelopeId || op.destinationEnvelopeId === envelopeId),
        ),
      };
    }
    if (config.method === 'PATCH') {
      calls.patch.push({ ...config, ifMatch: ifMatchOf([config, options]) });
      return { data: { operation: {}, result: {}, summary: {} }, warnings: [] };
    }
    calls.del.push({ ...config, ifMatch: ifMatchOf([config, options]) });
    return { data: { summary: {} }, warnings: [] };
  }) as never);
  return calls;
}

function renderHistory(overrides: Partial<Dashboard['month']> = {}, filters: { envelopeId?: string; type?: HistoryTypeFilter } = {}) {
  const onEnvelopeChange = jest.fn();
  const onTypeChange = jest.fn();
  const utils = renderWithProviders(
    <HistoryView
      dashboard={makeDashboardWithEnvelopes(overrides)}
      months={[makeMonth('2025-12', 'closed'), makeMonth('2026-01', 'open')]}
      envelopeId={filters.envelopeId ?? null}
      type={filters.type ?? null}
      onPeriodChange={jest.fn()}
      onEnvelopeChange={onEnvelopeChange}
      onTypeChange={onTypeChange}
    />,
  );
  return { ...utils, onEnvelopeChange, onTypeChange };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('HistoryView', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('HIST-11: default view shows the selected month in insertion order, with the month filter only', async () => {
    const calls = mockApi();
    renderHistory();

    expect(await screen.findByLabelText('Операция 1: Списание')).toBeTruthy();
    expect(calls.list[0]).toEqual({ period: '2026-01' });
    // Order is the API order (sequence_no); the view does not re-sort it.
    const labels = screen.getAllByLabelText(/^Операция \d+:/).map((node) => node.props.accessibilityLabel as string);
    expect(labels).toEqual(['Операция 1: Списание', 'Операция 2: Перевод', 'Операция 0: Стартовый остаток']);
    expect(screen.getByText('Продукты на неделю')).toBeTruthy();
    expect(screen.getByText(`3${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    // Month-only (AC-21): the heading is a month label, there is no day.
    expect(screen.getByRole('header', { name: 'Январь 2026' })).toBeTruthy();
  });

  it('HIST-11 / AC-08: an uncovered transfer shows the full, covered and uncovered amounts with a text marker', async () => {
    mockApi();
    renderHistory();

    await screen.findByLabelText('Операция 2: Перевод');
    expect(screen.getByText('Дом → Продукты')).toBeTruthy();
    expect(screen.getByText(`10${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    expect(screen.getByText(`Покрыто: 6${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    expect(screen.getByText(`⚠ Не покрыто: 4${NBSP}000,00${NBSP}₽`)).toBeTruthy();
    // A fully covered row has no uncovered line.
    expect(screen.getAllByText(/Не покрыто/)).toHaveLength(1);
  });

  it('UI-03: filters by envelope and type narrow the list', async () => {
    const calls = mockApi();
    const { onEnvelopeChange, onTypeChange, rerender, queryClient } = renderHistory();
    await screen.findByLabelText('Операция 1: Списание');

    fireEvent.press(screen.getByRole('radio', { name: 'Конверт: Дом' }));
    expect(onEnvelopeChange).toHaveBeenCalledWith('e-home');
    fireEvent.press(screen.getByRole('radio', { name: 'Тип: Переводы' }));
    expect(onTypeChange).toHaveBeenCalledWith('transfer');

    rerender(
      <QueryClientProvider client={queryClient}>
      <HistoryView
        dashboard={makeDashboardWithEnvelopes()}
        months={[makeMonth('2026-01', 'open')]}
        envelopeId="e-home"
        type="transfer"
        onPeriodChange={jest.fn()}
        onEnvelopeChange={onEnvelopeChange}
        onTypeChange={onTypeChange}
      />
      </QueryClientProvider>,
    );
    expect(await screen.findByLabelText('Операция 2: Перевод')).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText('Операция 1: Списание')).toBeNull());
    expect(calls.list[calls.list.length - 1]).toEqual({ period: '2026-01', envelopeId: 'e-home', type: 'transfer' });
  });

  it('HIST-08 / OP-17 / API-25: editing sends PATCH with the month version in If-Match and the new values, the type stays fixed', async () => {
    const calls = mockApi();
    renderHistory({ version: 7 });
    await screen.findByLabelText('Операция 1: Списание');

    press('Изменить операцию 1');
    expect(screen.getByRole('header', { name: 'Изменить: списание' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Знак корректировки' })).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Сумма'), '2500,50');
    fireEvent.changeText(screen.getByLabelText('Комментарий'), 'Исправлено');
    press('Сохранить изменения');

    await waitFor(() => expect(calls.patch).toHaveLength(1));
    expect(calls.patch[0]?.url).toBe('/api/v1/operations/op-1');
    expect(calls.patch[0]?.data).toEqual({
      amount: '2500.50',
      sourceEnvelopeId: 'e-food',
      comment: 'Исправлено',
    });
    expect(calls.patch[0]?.ifMatch).toBe('"7"');
    expect(await screen.findByText('Операция изменена.')).toBeTruthy();
  });

  it('OP-07 / HIST-09 / MSG-03: a transfer edit above the available amount offers a one-click replacement', async () => {
    const calls = mockApi();
    mockRequest.mockImplementationOnce((async () => ({ operations: OPERATIONS })) as never);
    renderHistory({ version: 7 });
    await screen.findByLabelText('Операция 2: Перевод');

    press('Изменить операцию 2');
    mockRequest.mockImplementationOnce((async () => {
      throw apiError(409, 'TRANSFER_EXCEEDS_BALANCE', `Доступно 6${NBSP}000,00 ₽. Перевести только 6${NBSP}000,00 ₽?`);
    }) as never);
    fireEvent.changeText(screen.getByLabelText('Сумма'), '20000');
    press('Сохранить изменения');

    const offer = await screen.findByRole('button', { name: `Перевести только 6${NBSP}000,00${NBSP}₽` });
    expect(calls.patch).toHaveLength(0);
    fireEvent.press(offer);
    await waitFor(() => expect(calls.patch).toHaveLength(1));
    expect(calls.patch[0]?.data).toMatchObject({ amount: '6000.00' });
    expect(calls.patch[0]?.ifMatch).toBe('"7"');
  });

  it('HIST-07 / OP-18 / API-25: delete asks for confirmation and sends DELETE with the month version in If-Match', async () => {
    const calls = mockApi();
    renderHistory({ version: 5 });
    await screen.findByLabelText('Операция 1: Списание');

    press('Удалить операцию 1');
    expect(screen.getByText(/Удалить операцию № 1\?/)).toBeTruthy();
    expect(calls.del).toHaveLength(0);

    press('Отменить удаление');
    expect(screen.queryByText(/Удалить операцию № 1\?/)).toBeNull();

    press('Удалить операцию 1');
    press('Подтвердить удаление');
    await waitFor(() => expect(calls.del).toHaveLength(1));
    expect(calls.del[0]?.url).toBe('/api/v1/operations/op-1');
    expect(calls.del[0]?.params).toBeUndefined();
    expect(calls.del[0]?.ifMatch).toBe('"5"');
    expect(await screen.findByText('Операция удалена.')).toBeTruthy();
  });

  it('HIST-07: after delete and edit the operation, dashboard, month and envelope queries are refetched', async () => {
    mockApi();
    const { queryClient } = renderHistory();
    await screen.findByLabelText('Операция 1: Списание');
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    press('Удалить операцию 1');
    press('Подтвердить удаление');
    await screen.findByText('Операция удалена.');
    const keys = invalidate.mock.calls.map(([filters]) => String((filters?.queryKey as string[])[0]));
    expect(keys).toEqual(
      expect.arrayContaining(['/api/v1/operations', '/api/v1/months', '/api/v1/envelopes']),
    );
    expect(keys.some((key) => key.includes('dashboard'))).toBe(true);
  });

  it('OP-10: the initial balance row is read-only', async () => {
    mockApi();
    renderHistory();

    await screen.findByLabelText('Операция 0: Стартовый остаток');
    expect(screen.getByRole('button', { name: 'Изменить операцию 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Изменить операцию 0' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Удалить операцию 0' })).toBeNull();
  });

  it('HIST-10 / MSG-06 / AC-14: edit and delete are hidden in a closed month', async () => {
    mockApi();
    renderHistory({ status: 'closed' });

    await screen.findByLabelText('Операция 1: Списание');
    expect(screen.getByText(MONTH_LOCKED_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Изменить операцию/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Удалить операцию/ })).toBeNull();
  });
});
