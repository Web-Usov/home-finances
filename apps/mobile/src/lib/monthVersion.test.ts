import { QueryClient } from '@tanstack/react-query';
import { getReportingControllerMonthlyDashboardV1QueryKey } from '../api/reporting/reporting';
import { ifMatch, notifyMonthETag, parseETag, syncMonthVersionFromETag } from './monthVersion';

describe('ifMatch (API-25)', () => {
  it('API-25: sends the month version as a quoted ETag', () => {
    expect(ifMatch(7)).toEqual({ headers: { 'If-Match': '"7"' } });
    expect(ifMatch(0)).toEqual({ headers: { 'If-Match': '"0"' } });
  });
});

describe('parseETag (API-26)', () => {
  it.each([
    ['"7"', 7],
    ['W/"12"', 12],
  ])('API-26: %s → %d', (etag, version) => {
    expect(parseETag(etag)).toBe(version);
  });

  it.each(['7', '"x"', '', '*'])('API-26: %j is not a month ETag', (etag) => {
    expect(parseETag(etag)).toBeNull();
  });
});

describe('syncMonthVersionFromETag (API-26)', () => {
  const key = (period: string) => getReportingControllerMonthlyDashboardV1QueryKey({ period });
  const dashboard = (period: string, version: number) => ({ month: { id: period, period, status: 'open', version }, envelopes: [] });

  function setup() {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key('2026-01'), dashboard('2026-01', 3));
    queryClient.setQueryData(key('2026-02'), dashboard('2026-02', 9));
    const unsubscribe = syncMonthVersionFromETag(queryClient);
    return { queryClient, unsubscribe };
  }

  const versionOf = (queryClient: QueryClient, period: string) =>
    (queryClient.getQueryData(key(period)) as ReturnType<typeof dashboard>).month.version;

  it('API-26: the ETag of a mutation response refreshes the cached version of that month only', () => {
    const { queryClient, unsubscribe } = setup();

    notifyMonthETag('"4"', { data: { summary: { period: '2026-01', version: 4 } }, warnings: [] });

    expect(versionOf(queryClient, '2026-01')).toBe(4);
    expect(versionOf(queryClient, '2026-02')).toBe(9);
    unsubscribe();
  });

  it('API-26: close / reopen (data.month) and dashboard (month) bodies are recognised too', () => {
    const { queryClient, unsubscribe } = setup();

    notifyMonthETag('"5"', { data: { month: { period: '2026-01', version: 5 }, promotedDraft: null } });
    expect(versionOf(queryClient, '2026-01')).toBe(5);
    notifyMonthETag('"10"', { month: { period: '2026-02', version: 10 } });
    expect(versionOf(queryClient, '2026-02')).toBe(10);
    unsubscribe();
  });

  it('API-26: an older ETag never lowers the cached version', () => {
    const { queryClient, unsubscribe } = setup();

    notifyMonthETag('"2"', { month: { period: '2026-01', version: 2 } });

    expect(versionOf(queryClient, '2026-01')).toBe(3);
    unsubscribe();
  });

  it('API-26: a malformed ETag or a body without a month is ignored', () => {
    const { queryClient, unsubscribe } = setup();

    notifyMonthETag('nope', { month: { period: '2026-01', version: 8 } });
    notifyMonthETag('"8"', { operations: [] });
    notifyMonthETag('"8"', null);

    expect(versionOf(queryClient, '2026-01')).toBe(3);
    unsubscribe();
  });

  it('stops after unsubscribe', () => {
    const { queryClient, unsubscribe } = setup();
    unsubscribe();

    notifyMonthETag('"4"', { month: { period: '2026-01', version: 4 } });

    expect(versionOf(queryClient, '2026-01')).toBe(3);
  });
});
