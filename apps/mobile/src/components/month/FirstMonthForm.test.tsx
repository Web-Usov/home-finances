import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test/render';
import { customAxiosInstance } from '../../api/axios-instance';
import { makeMonth } from '../../../test/monthFixtures';
import { FirstMonthForm } from './FirstMonthForm';

jest.mock('../../api/axios-instance', () => ({
  __esModule: true,
  customAxiosInstance: jest.fn(),
  default: jest.fn(),
}));

const mockRequest = customAxiosInstance as jest.MockedFunction<typeof customAxiosInstance>;

describe('FirstMonthForm', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('AC-01 / SCOPE-23: creates the first month from a month and an income', async () => {
    mockRequest.mockResolvedValue({ month: makeMonth('2026-01', 'open') } as never);
    const onCreated = jest.fn();
    renderWithProviders(<FirstMonthForm onCreated={onCreated} />);

    fireEvent.changeText(screen.getByLabelText('Первый месяц'), '2026-01');
    fireEvent.changeText(screen.getByLabelText('Доход месяца'), '100000');
    fireEvent.press(screen.getByRole('button', { name: 'Создать месяц' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('2026-01'));
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({
      url: '/api/v1/months',
      method: 'POST',
      data: { period: '2026-01', income: '100000' },
    });
  });

  it('AC-21: rejects a date with a day or a non-existent month and sends nothing', async () => {
    renderWithProviders(<FirstMonthForm onCreated={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('Первый месяц'), '2026-01-15');
    fireEvent.press(screen.getByRole('button', { name: 'Создать месяц' }));

    expect(await screen.findByText('Месяц в формате ГГГГ-ММ, например 2026-01')).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
