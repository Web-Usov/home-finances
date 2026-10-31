import { DEFAULT_API_URL, resolveApiBaseUrl } from './apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('falls back to the local dev API when unset or blank', () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(resolveApiBaseUrl('')).toBe(DEFAULT_API_URL);
    expect(resolveApiBaseUrl('   ')).toBe(DEFAULT_API_URL);
  });

  it('uses an explicit API origin as is (e2e/dev)', () => {
    expect(resolveApiBaseUrl('http://127.0.0.1:4123')).toBe('http://127.0.0.1:4123');
  });

  it('drops trailing slashes of an explicit origin', () => {
    expect(resolveApiBaseUrl('http://api.local:3000/')).toBe('http://api.local:3000');
  });

  it('same-origin mode yields an empty base URL so requests stay on the page origin', () => {
    expect(resolveApiBaseUrl('same-origin')).toBe('');
    expect(resolveApiBaseUrl('/')).toBe('');
    expect(resolveApiBaseUrl(' same-origin ')).toBe('');
  });
});
