import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders } from 'axios';
import { renderWithProviders } from '../../../test/render';
import { customAxiosInstance } from '../../api/axios-instance';
import { EnvelopeCard } from './EnvelopeCard';
import type { EnvelopeWithBalance } from './types';

jest.mock('../../api/axios-instance', () => ({
  __esModule: true,
  customAxiosInstance: jest.fn(),
  default: jest.fn(),
}));

const mockRequest = customAxiosInstance as jest.MockedFunction<typeof customAxiosInstance>;

const envelope: EnvelopeWithBalance = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Еда',
  status: 'active',
  createdPeriod: '2026-08',
  archivedPeriod: null,
  displayOrder: 0,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  balanceMinor: 150_000,
};

describe('EnvelopeCard', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('renders the envelope name, balance and actions', () => {
    renderWithProviders(<EnvelopeCard envelope={envelope} />);

    expect(screen.getByText('Еда')).toBeTruthy();
    expect(screen.getByText(/₽/)).toBeTruthy();
    expect(screen.getByText('Переименовать')).toBeTruthy();
    expect(screen.getByText('Архивировать')).toBeTruthy();
  });

  it('archives the envelope via the API when "Архивировать" is pressed', async () => {
    mockRequest.mockResolvedValue(undefined as never);
    renderWithProviders(<EnvelopeCard envelope={envelope} />);

    fireEvent.press(screen.getByText('Архивировать'));

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
    expect(mockRequest.mock.calls[0]?.[0]).toMatchObject({
      url: `/api/v1/envelopes/${envelope.id}/archive`,
      method: 'POST',
    });
  });

  it('shows the backend error message when archiving fails', async () => {
    const error = new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: 'ENVELOPE_NOT_EMPTY', message: 'Баланс конверта не нулевой' },
    });
    mockRequest.mockRejectedValue(error);
    renderWithProviders(<EnvelopeCard envelope={envelope} />);

    fireEvent.press(screen.getByText('Архивировать'));

    expect(await screen.findByText('Баланс конверта не нулевой')).toBeTruthy();
  });
});
