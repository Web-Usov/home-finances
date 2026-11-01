import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test/render';
import { customAxiosInstance } from '../../api/axios-instance';
import { getMonthsControllerListV1QueryKey } from '../../api/months/months';
import { getReportingControllerMonthlyDashboardV1QueryKey } from '../../api/reporting/reporting';
import { EnvelopeCreateForm } from './EnvelopeCreateForm';

jest.mock('../../api/axios-instance', () => ({
  __esModule: true,
  customAxiosInstance: jest.fn(),
  default: jest.fn(),
}));

const mockRequest = customAxiosInstance as jest.MockedFunction<typeof customAxiosInstance>;

describe('EnvelopeCreateForm', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('SCOPE-24 / AC-01: creating an envelope invalidates the month dashboard and months queries', async () => {
    mockRequest.mockResolvedValue(undefined as never);
    const onCreated = jest.fn();
    const { queryClient } = renderWithProviders(<EnvelopeCreateForm onCreated={onCreated} onCancel={jest.fn()} />);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    fireEvent.changeText(screen.getByPlaceholderText('Напр. Продукты'), 'Продукты');
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '100');
    fireEvent.press(screen.getByText('Создать'));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(getReportingControllerMonthlyDashboardV1QueryKey());
    expect(keys).toContainEqual(getMonthsControllerListV1QueryKey());
  });
});
