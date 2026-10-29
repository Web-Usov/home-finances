import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { ValidationException } from '../exceptions';

/**
 * NestJS pipe that validates incoming request data against a Zod schema.
 *
 * Usage:
 * ```
 * // As a parameter-level pipe
 * @Post()
 * create(@Body(new ZodValidationPipe(CreateMonthRequestSchema)) dto: CreateMonthDto) {}
 *
 * // As a global pipe (see ZodValidationPipe.registerGlobally())
 * app.useGlobalPipes(ZodValidationPipe.registerGlobally());
 * ```
 */
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema: ZodSchema) {}

  /**
   * Transform and validate a value against the Zod schema.
   * Throws ValidationException (HTTP 422, API-17) listing the failing field paths on validation failure.
   */
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw this.createException(result.error);
    }

    return result.data;
  }

  private createException(error: ZodError): ValidationException {
    const messages = error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
      return `${path}${issue.message}`;
    });

    return new ValidationException('VALIDATION_ERROR', messages.join('; '));
  }

  /**
   * Returns a factory function suitable for use with useGlobalPipes().
   * Usage: app.useGlobalPipes(ZodValidationPipe.registerGlobally());
   */
  static registerGlobally(): (schema: ZodSchema) => ZodValidationPipe {
    return (schema: ZodSchema) => new ZodValidationPipe(schema);
  }
}
