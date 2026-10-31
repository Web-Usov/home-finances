import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders } from 'axios';
import { renderWithProviders } from '../../../test/render';
import { customAxiosInstance } from '../../api/axios-instance';
import { MONTH_LOCKED_MESSAGE } from '../../lib/apiErrors';
import { makeDashboard } from '../../../test/monthFixtures';
import { AllocationEditor } from './AllocationEditor';
import type { Dashboard } from './types';

jest.mock('../../api/axios-instance', () => ({
  __esModule: true,
  customAxiosInstance: jest.fn(),
  default: jest.fn(),
}));

const mockRequest = customAxiosInstance as jest.MockedFunction<typeof customAxiosInstance>;

const NBSP = '\u00A0';

jest.setTimeout(20000); // first render compiles NativeWind/RN modules; slow on a loaded machine

function apiError(status: number, error: string, message: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error, message },
  });
}

function envelope(id: string, name: string, replenished: string, status: 'active' | 'archived' = 'active'): Dashboard['envelopes'][number] {
  const base = makeDashboard().envelopes[0]!;
  return { ...base, envelopeId: id, name, status, replenished };
}

function makeEditorDashboard(status: Dashboard['month']['status'] = 'open', income = '100000.00'): Dashboard {
  const dashboard = makeDashboard({ status });
  return {
    ...dashboard,
    summary: { ...dashboard.summary, income, allocated: '75000.00', free: '25000.00' },
    envelopes: [
      envelope('e-food', 'Продукты', '50000.00'),
      envelope('e-home', 'Дом', '25000.00'),
      envelope('e-old', 'Старый', '999.00', 'archived'),
    ],
  };
}

function renderEditor(dashboard: Dashboard = makeEditorDashboard()) {
  const onDone = jest.fn();
  const { queryClient } = renderWithProviders(<AllocationEditor dashboard={dashboard} onDone={onDone} />);
  return { onDone, queryClient };
}

const allocated = () => screen.getByLabelText(/^Распределено в редакторе:/).props.accessibilityLabel as string;
const free = () => screen.getByLabelText(/^Свободно в редакторе:/).props.accessibilityLabel as string;
const field = (name: string) => screen.getByLabelText(`Распределение: ${name}`);
const save = () => screen.getByRole('button', { name: 'Сохранить распределение' });

describe('AllocationEditor', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('UI-11 / ENV-12: one field for income and one per active envelope; archived envelopes are excluded', () => {
    renderEditor();

    expect(screen.getByLabelText('Доход для распределения')).toBeTruthy();
    expect(field('Продукты')).toBeTruthy();
    expect(field('Дом')).toBeTruthy();
    expect(screen.queryByLabelText('Распределение: Старый')).toBeNull();
  });

  it('UI-12 / AC-04: copied allocation is shown as editable values', () => {
    renderEditor();

    expect(field('Продукты').props.value).toBe('50000,00');
    expect(field('Дом').props.value).toBe('25000,00');
    expect(field('Дом').props.editable).toBe(true);
    fireEvent.changeText(field('Дом'), '30000');
    expect(field('Дом').props.value).toBe('30000');
  });

  it('UI-13 / AC-02: totals and free funds update while typing (75 000 of 100 000 leaves 25 000)', () => {
    renderEditor();

    expect(allocated()).toBe(`Распределено в редакторе: 75${NBSP}000,00${NBSP}₽`);
    expect(free()).toBe(`Свободно в редакторе: 25${NBSP}000,00${NBSP}₽`);

    fireEvent.changeText(field('Дом'), '10000,5');
    expect(allocated()).toBe(`Распределено в редакторе: 60${NBSP}000,50${NBSP}₽`);
    expect(free()).toBe(`Свободно в редакторе: 39${NBSP}999,50${NBSP}₽`);
  });

  it('UI-13 / FIN-08: kopeck sums are exact (0.10 + 0.20 gives 0,30)', () => {
    renderEditor();

    fireEvent.changeText(field('Продукты'), '0.10');
    fireEvent.changeText(field('Дом'), '0.20');
    expect(allocated()).toBe(`Распределено в редакторе: 0,30${NBSP}₽`);
    expect(free()).toBe(`Свободно в редакторе: 99${NBSP}999,70${NBSP}₽`);
  });

  it('UI-14 / MSG-01 / AC-03: 100000.01 on income 100000 blocks save and shows 0,01 overflow', async () => {
    renderEditor(makeEditorDashboard('open', '100000.00'));

    fireEvent.changeText(field('Продукты'), '75000.01');
    fireEvent.changeText(field('Дом'), '25000');

    expect(screen.getByText(`Распределено на 0,01${NBSP}₽ больше дохода. Уменьшите суммы по конвертам.`)).toBeTruthy();
    expect(free()).toBe(`Свободно в редакторе: −0,01${NBSP}₽`);
    expect(save().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(save());
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 20);
    });
    expect(mockRequest).not.toHaveBeenCalled();

    fireEvent.changeText(field('Продукты'), '75000');
    expect(screen.queryByText(/больше дохода/)).toBeNull();
    expect(save().props.accessibilityState.disabled).toBe(false);
  });

  it('FIN-02: lowering the income below the typed allocation shows the overflow too', () => {
    renderEditor();

    fireEvent.changeText(screen.getByLabelText('Доход для распределения'), '74999,99');
    expect(screen.getByText(`Распределено на 0,01${NBSP}₽ больше дохода. Уменьшите суммы по конвертам.`)).toBeTruthy();
    expect(save().props.accessibilityState.disabled).toBe(true);
  });

  it('API-04: saves the whole table of active envelopes with the month version, then refetches month data', async () => {
    mockRequest.mockResolvedValue(undefined as never);
    const { onDone, queryClient } = renderEditor();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    fireEvent.changeText(field('Дом'), '20 000,5');
    fireEvent.press(save());

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({
      url: '/api/v1/months/2026-01/allocations',
      method: 'PUT',
      data: { allocations: { 'e-food': '50000.00', 'e-home': '20000.50' }, version: 3 },
    });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([['/api/v1/dashboard/monthly'], ['/api/v1/months']]));
  });

  it('API-04 / FIN-02: a changed income travels in the same single PUT request as the allocations', async () => {
    mockRequest.mockResolvedValue(undefined as never);
    const { onDone } = renderEditor();

    fireEvent.changeText(screen.getByLabelText('Доход для распределения'), '120 000,5');
    fireEvent.changeText(field('Дом'), '10000');
    fireEvent.press(save());

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({
      url: '/api/v1/months/2026-01/allocations',
      method: 'PUT',
      data: { allocations: { 'e-food': '50000.00', 'e-home': '10000.00' }, income: '120000.50', version: 3 },
    });
  });

  it('API-04: an unchanged income is not sent', async () => {
    mockRequest.mockResolvedValue(undefined as never);
    const { onDone } = renderEditor();

    fireEvent.press(save());

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({ method: 'PUT' });
    expect((mockRequest.mock.calls[0]?.[0] as { data: object }).data).not.toHaveProperty('income');
  });

  it('UI-12: values are prefilled in ru-RU input form and both separators are accepted when typing', () => {
    renderEditor();

    expect(screen.getByLabelText('Доход для распределения').props.value).toBe('100000,00');
    fireEvent.changeText(field('Дом'), '1.5');
    expect(allocated()).toBe(`Распределено в редакторе: 50${NBSP}001,50${NBSP}₽`);
    fireEvent.changeText(field('Дом'), '1,5');
    expect(allocated()).toBe(`Распределено в редакторе: 50${NBSP}001,50${NBSP}₽`);
  });

  it('FIN-11 / UI-13: negative free funds are shown signed and highlighted in red', () => {
    renderEditor(makeEditorDashboard('draft', '0.00'));

    const node = screen.getByLabelText(`Свободно в редакторе: −75${NBSP}000,00${NBSP}₽`);
    expect(node.props.className).toContain('text-danger');
  });

  it('NFR-18 / ADR 0005: 409 VERSION_CONFLICT shows the API message, keeps the editor open and refetches', async () => {
    const message = 'Данные месяца 2026-01 изменились. Обновите страницу и повторите сохранение.';
    mockRequest.mockRejectedValue(apiError(409, 'VERSION_CONFLICT', message));
    const { onDone, queryClient } = renderEditor();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    fireEvent.press(save());

    expect(await screen.findByText(message)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it('MSG-06: 409 MONTH_LOCKED from the API shows the verbatim closed-month text', async () => {
    mockRequest.mockRejectedValue(apiError(409, 'MONTH_LOCKED', 'whatever'));
    renderEditor();

    fireEvent.press(save());

    expect(await screen.findByText(MONTH_LOCKED_MESSAGE)).toBeTruthy();
  });

  it('MSG-01: a server-side 422 ALLOCATION_EXCEEDS_INCOME is still shown', async () => {
    const message = 'Распределено на 1.00 ₽ больше дохода. Уменьшите суммы по конвертам.';
    mockRequest.mockRejectedValue(apiError(422, 'ALLOCATION_EXCEEDS_INCOME', message));
    renderEditor();

    fireEvent.press(save());

    expect(await screen.findByText(message)).toBeTruthy();
  });

  it('MSG-06: editor is read-only in a closed month', () => {
    renderEditor(makeEditorDashboard('closed'));

    expect(screen.getByText(MONTH_LOCKED_MESSAGE)).toBeTruthy();
    expect(field('Продукты').props.editable).toBe(false);
    expect(screen.getByLabelText('Доход для распределения').props.editable).toBe(false);
    expect(save().props.accessibilityState.disabled).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
