import axios, { type InternalAxiosRequestConfig } from 'axios';

// The adapter replaces the network: it records the final request config and answers with an ETag (API-26).
const sent: InternalAxiosRequestConfig[] = [];
axios.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
  sent.push(config);
  return { data: { month: { period: '2026-01', version: 8 } }, status: 200, statusText: 'OK', headers: { etag: '"8"' }, config };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { customAxiosInstance } = require('./axios-instance') as typeof import('./axios-instance');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { syncMonthVersionFromETag } = require('../lib/monthVersion') as typeof import('../lib/monthVersion');

describe('customAxiosInstance', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('API-25: per-call options add If-Match and keep the generated Content-Type', async () => {
    await customAxiosInstance(
      { url: '/api/v1/months/2026-01', method: 'PATCH', headers: { 'Content-Type': 'application/json' }, data: { income: '1.00' } },
      { headers: { 'If-Match': '"7"' } },
    );

    expect(sent[0]?.headers.get('If-Match')).toBe('"7"');
    expect(sent[0]?.headers.get('Content-Type')).toBe('application/json');
  });

  it('API-26: the ETag of a response refreshes the cached dashboard version', async () => {
    const { QueryClient } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
    const queryClient = new QueryClient();
    const key = ['/api/v1/dashboard/monthly', { period: '2026-01' }];
    queryClient.setQueryData(key, { month: { period: '2026-01', version: 3 } });
    const unsubscribe = syncMonthVersionFromETag(queryClient);

    await customAxiosInstance({ url: '/api/v1/dashboard/monthly', method: 'GET' });

    expect((queryClient.getQueryData(key) as { month: { version: number } }).month.version).toBe(8);
    unsubscribe();
  });
});
