import axios, { type AxiosRequestConfig } from 'axios';
import { resolveApiBaseUrl } from '../lib/apiBaseUrl';
import { notifyMonthETag } from '../lib/monthVersion';

const axiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL),
  headers: {
    'Content-Type': 'application/json',
  },
});

// API-26: month-scoped responses carry `ETag: "<version>"`; listeners (QueryProvider) refresh the cached month version.
axiosInstance.interceptors.response.use((response) => {
  const etag: unknown = response.headers?.etag;
  if (typeof etag === 'string') notifyMonthETag(etag, response.data);
  return response;
});

/**
 * Orval custom mutator: must be a FUNCTION (not an axios instance) —
 * orval generates calls `customAxiosInstance<T>(config)` and expects
 * the unwrapped response body back.
 */
export const customAxiosInstance = async <T>(
  config: AxiosRequestConfig,
  /** Per-call overrides of the generated client (`If-Match` of month-scoped mutations, see `lib/monthVersion.ts`). */
  options?: AxiosRequestConfig,
): Promise<T> => {
  const { data } = await axiosInstance.request<T>({
    ...config,
    ...options,
    headers: { ...config.headers, ...options?.headers },
  });
  return data;
};

export default customAxiosInstance;
