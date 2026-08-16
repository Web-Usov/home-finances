import axios, { type AxiosRequestConfig } from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Orval custom mutator: must be a FUNCTION (not an axios instance) —
 * orval generates calls `customAxiosInstance<T>(config)` and expects
 * the unwrapped response body back.
 */
export const customAxiosInstance = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const { data } = await axiosInstance.request<T>(config);
  return data;
};

export default customAxiosInstance;
