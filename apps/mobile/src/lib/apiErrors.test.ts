import { AxiosError, AxiosHeaders } from 'axios';
import { MONTH_LOCKED_MESSAGE, PRECONDITION_REQUIRED_MESSAGE, describeMonthError } from './apiErrors';

function apiError(status: number, error: string, message: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error, message },
  });
}

describe('describeMonthError', () => {
  it('API-27: 428 PRECONDITION_REQUIRED (a client bug) shows a generic hint, not the technical server text', () => {
    expect(describeMonthError(apiError(428, 'PRECONDITION_REQUIRED', 'Не передан заголовок If-Match'), 'fallback')).toEqual({
      code: 'PRECONDITION_REQUIRED',
      message: PRECONDITION_REQUIRED_MESSAGE,
    });
  });

  it('MSG-06: MONTH_LOCKED shows the verbatim closed-month text', () => {
    expect(describeMonthError(apiError(409, 'MONTH_LOCKED', 'other'), 'fallback').message).toBe(MONTH_LOCKED_MESSAGE);
  });

  it('API-27: 409 VERSION_CONFLICT shows the server message', () => {
    expect(describeMonthError(apiError(409, 'VERSION_CONFLICT', 'Данные изменились'), 'fallback')).toEqual({
      code: 'VERSION_CONFLICT',
      message: 'Данные изменились',
    });
  });

  it('a non-HTTP error falls back', () => {
    expect(describeMonthError(new Error('network'), 'fallback')).toEqual({ code: null, message: 'fallback' });
  });
});
