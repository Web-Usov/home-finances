import { applyDecorators, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';
import { ConflictException, PreconditionRequiredException, ValidationException } from './exceptions';

/**
 * Optimistic locking through `If-Match` (API-25, API-27, ADR 0005 addendum).
 *
 * The header is read in ONE place (the `IfMatch` parameter decorator) and handed to the service as an
 * `ExpectedVersion`. It is deliberately not rejected in the controller: API-27 fixes the order
 * month existence → `If-Match` → month status → business rules, and "existence" and the version
 * comparison are only decidable under the month lock. So the decorator only classifies the header and
 * `assertExpectedVersion` (called by `month-lock.ts` right after the existence check) throws.
 */
export type ExpectedVersion =
  | { readonly kind: 'version'; readonly value: number }
  | { readonly kind: 'missing' }
  | { readonly kind: 'malformed'; readonly raw: string };

/** Header name as sent by clients (Node lower-cases it in `request.headers`). */
export const IF_MATCH_HEADER = 'If-Match';

/** A quoted non-negative integer, optionally weak (`W/"7"`): proxies may weaken a strong ETag. */
const ETAG_VERSION = /^(?:W\/)?"(0|[1-9]\d{0,14})"$/;

/**
 * Classify a raw `If-Match` header value. Accepts only the ETag form of a non-negative integer
 * (`"7"`, tolerated weak `W/"7"`); a bare `7`, `*`, a list, a negative or non-numeric value is malformed (API-27).
 */
export function parseIfMatch(raw: string | string[] | undefined): ExpectedVersion {
  if (raw === undefined) {
    return { kind: 'missing' };
  }
  const value = Array.isArray(raw) ? raw.join(', ') : raw;
  const match = ETAG_VERSION.exec(value.trim());
  if (match === null) {
    return { kind: 'malformed', raw: value };
  }
  return { kind: 'version', value: Number(match[1]) };
}

/** The expected-version value of tests and internal callers that already know the number. */
export function expectVersion(value: number): ExpectedVersion {
  return { kind: 'version', value };
}

/** `ETag` header value of a month version (API-26). */
export function formatEtag(version: number): string {
  return `"${version}"`;
}

/**
 * Check the expected version against the month read under the lock (API-27): missing → 428
 * `PRECONDITION_REQUIRED`, malformed → 422 `VALIDATION_ERROR`, different from the stored one → 409
 * `VERSION_CONFLICT`.
 */
export function assertExpectedVersion(
  expected: ExpectedVersion,
  month: { period: string; version: number },
): void {
  if (expected.kind === 'missing') {
    throw new PreconditionRequiredException(
      'PRECONDITION_REQUIRED',
      'Не передан заголовок If-Match с версией месяца. Обновите данные и повторите.',
    );
  }
  if (expected.kind === 'malformed') {
    throw new ValidationException(
      'VALIDATION_ERROR',
      'Заголовок If-Match должен содержать версию месяца в кавычках, например "7".',
    );
  }
  if (month.version !== expected.value) {
    throw new ConflictException(
      'VERSION_CONFLICT',
      `Данные месяца ${month.period} изменились. Обновите данные и повторите.`,
    );
  }
}

/** `@IfMatch() expectedVersion: ExpectedVersion` — the only place that reads the header. */
export const IfMatch = createParamDecorator((_data: unknown, ctx: ExecutionContext): ExpectedVersion => {
  const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
  return parseIfMatch(request.headers[IF_MATCH_HEADER.toLowerCase()]);
});

/** OpenAPI for a mutation that needs `If-Match`: the header parameter plus the 428 response. */
export function ApiIfMatch(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiHeader({
      name: IF_MATCH_HEADER,
      required: true,
      description:
        'Expected month version as a quoted ETag, e.g. `"7"` (API-25). Missing → 428 PRECONDITION_REQUIRED, ' +
        'malformed → 422 VALIDATION_ERROR, stale → 409 VERSION_CONFLICT.',
      schema: { type: 'string', example: '"7"' },
    }),
    ApiResponse({ status: 428, description: 'PRECONDITION_REQUIRED (no If-Match header, API-27)' }),
  );
}
