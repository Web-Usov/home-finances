import { AxiosError, AxiosHeaders } from 'axios';
import { MONTH_LOCKED_MESSAGE, PRECONDITION_REQUIRED_MESSAGE, describeMonthError } from './apiErrors';

function apiError(status: number, error: string, message: string, available?: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error, message, ...(available !== undefined ? { available } : {}) },
  });
}

describe('describeMonthError', () => {
  it('API-27: 428 PRECONDITION_REQUIRED (a client bug) shows a generic hint, not the technical server text', () => {
    expect(describeMonthError(apiError(428, 'PRECONDITION_REQUIRED', 'Не передан заголовок If-Match'), 'fallback')).toEqual({
      code: 'PRECONDITION_REQUIRED',
      message: PRECONDITION_REQUIRED_MESSAGE,
      available: null,
    });
  });

  it('MSG-06: MONTH_LOCKED shows the verbatim closed-month text', () => {
    expect(describeMonthError(apiError(409, 'MONTH_LOCKED', 'other'), 'fallback').message).toBe(MONTH_LOCKED_MESSAGE);
  });

  it('API-27: 409 VERSION_CONFLICT shows the server message', () => {
    expect(describeMonthError(apiError(409, 'VERSION_CONFLICT', 'Данные изменились'), 'fallback')).toEqual({
      code: 'VERSION_CONFLICT',
      message: 'Данные изменились',
      available: null,
    });
  });

  it('OP-07: TRANSFER_EXCEEDS_BALANCE exposes the structured available amount', () => {
    expect(describeMonthError(apiError(409, 'TRANSFER_EXCEEDS_BALANCE', 'Доступно', '6000.00'), 'fallback')).toEqual({
      code: 'TRANSFER_EXCEEDS_BALANCE',
      message: 'Доступно',
      available: '6000.00',
    });
  });

  it('a non-HTTP error falls back', () => {
    expect(describeMonthError(new Error('network'), 'fallback')).toEqual({ code: null, message: 'fallback', available: null });
  });
});
