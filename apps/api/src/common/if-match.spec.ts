import { assertExpectedVersion, expectVersion, formatEtag, parseIfMatch } from './if-match';
import { monthVersionOf } from './month-etag';

describe('parseIfMatch (API-25, API-27)', () => {
  it.each([
    ['"7"', 7],
    ['"0"', 0],
    ['  "12"  ', 12],
    ['W/"7"', 7],
  ])('API-25: %j is the ETag of version %d', (raw, value) => {
    expect(parseIfMatch(raw)).toEqual({ kind: 'version', value });
  });

  it('API-27: an absent header is "missing"', () => {
    expect(parseIfMatch(undefined)).toEqual({ kind: 'missing' });
  });

  it.each(['7', '"x"', '"-1"', '"1.5"', '"07"', '"1e3"', '*', '"1", "2"', '', '""', 'W/7', '"7', '"1234567890123456"'])(
    'API-27: %j is malformed',
    (raw) => {
      expect(parseIfMatch(raw)).toEqual({ kind: 'malformed', raw });
    },
  );

  it('API-27: a repeated header (array) is malformed', () => {
    expect(parseIfMatch(['"1"', '"2"']).kind).toBe('malformed');
  });

  it('formatEtag produces the form parseIfMatch accepts', () => {
    expect(parseIfMatch(formatEtag(41))).toEqual(expectVersion(41));
  });
});

describe('assertExpectedVersion (API-27)', () => {
  const month = { period: '2026-08', version: 3 };

  it('missing → 428 PRECONDITION_REQUIRED', () => {
    expect(() => assertExpectedVersion({ kind: 'missing' }, month)).toThrow(
      expect.objectContaining({ statusCode: 428, code: 'PRECONDITION_REQUIRED' }),
    );
  });

  it('malformed → 422 VALIDATION_ERROR', () => {
    expect(() => assertExpectedVersion({ kind: 'malformed', raw: 'x' }, month)).toThrow(
      expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }),
    );
  });

  it('stale → 409 VERSION_CONFLICT', () => {
    expect(() => assertExpectedVersion(expectVersion(2), month)).toThrow(
      expect.objectContaining({ statusCode: 409, code: 'VERSION_CONFLICT' }),
    );
  });

  it('current → passes', () => {
    expect(() => assertExpectedVersion(expectVersion(3), month)).not.toThrow();
  });
});

describe('monthVersionOf (API-26)', () => {
  it.each([
    ['mutation summary', { data: { summary: { version: 4 } }, warnings: [] }],
    ['close / reopen month', { data: { month: { version: 4 }, promotedDraft: null }, warnings: [] }],
    ['dashboard / preview month', { month: { version: 4 }, summary: {} }],
  ])('API-26: reads the version of the %s', (_name, body) => {
    expect(monthVersionOf(body)).toBe(4);
  });

  it.each([[null], [undefined], ['x'], [{}], [{ months: [{ version: 1 }] }], [{ data: {} }]])(
    'API-26: %j has no month version',
    (body) => {
      expect(monthVersionOf(body)).toBeUndefined();
    },
  );
});
