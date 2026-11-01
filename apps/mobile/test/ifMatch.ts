/**
 * `If-Match` a component test's mocked `customAxiosInstance` call was made with: the generated client passes the
 * per-call options as the second argument (API-25, `lib/monthVersion.ts`).
 */
export function ifMatchOf(call: readonly unknown[] | undefined): string | undefined {
  const options = call?.[1] as { headers?: Record<string, string> } | undefined;
  return options?.headers?.['If-Match'];
}
