import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { formatEtag } from './if-match';

const MONTH_ETAG_KEY = 'monthETag';

/**
 * Marks a handler whose response is scoped to one month (API-26): the interceptor adds
 * `ETag: "<version>"` of that month. For mutations it is the TARGET month after the cascade.
 */
export const MonthETag = () => SetMetadata(MONTH_ETAG_KEY, true);

/** OpenAPI `headers` of a month-scoped response, for `@ApiResponse({ headers: MONTH_ETAG_HEADERS })`. */
export const MONTH_ETAG_HEADERS = {
  ETag: {
    description: 'Current version of the month as a quoted ETag, e.g. `"7"` (API-26)',
    schema: { type: 'string' },
  },
};

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null;
}

/**
 * Month version of a month-scoped response body. Every month-scoped response carries it in one of
 * the shapes defined by the spec: mutations `{ data: { summary | month } }` (API-22), dashboard and
 * reopen preview `{ month }` (API-12, API-20).
 */
export function monthVersionOf(body: unknown): number | undefined {
  if (!isObject(body)) {
    return undefined;
  }
  const data = isObject(body.data) ? body.data : undefined;
  const holder = [data?.summary, data?.month, body.month].find(isObject);
  return typeof holder?.version === 'number' ? holder.version : undefined;
}

@Injectable()
export class MonthETagInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.reflector.get<boolean | undefined>(MONTH_ETAG_KEY, context.getHandler()) !== true) {
      return next.handle();
    }
    const reply = context.switchToHttp().getResponse<{ header: (name: string, value: string) => unknown }>();
    return next.handle().pipe(
      map((body) => {
        const version = monthVersionOf(body);
        if (version !== undefined) {
          reply.header('ETag', formatEtag(version));
        }
        return body;
      }),
    );
  }
}
