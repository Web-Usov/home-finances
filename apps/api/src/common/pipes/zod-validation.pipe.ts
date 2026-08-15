import { BadRequestException } from '@nestjs/common';
import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

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
   * Throws BadRequestException with detailed error messages on validation failure.
   */
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw this.createException(result.error);
    }

    return result.data;
  }

  private createException(error: ZodError): BadRequestException {
    const messages = error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
      return `${path}${issue.message}`;
    });

    return new BadRequestException({
      message: 'Validation failed',
      errors: messages,
    });
  }

  /**
   * Returns a factory function suitable for use with useGlobalPipes().
   * Usage: app.useGlobalPipes(ZodValidationPipe.registerGlobally());
   */
  static registerGlobally(): (schema: ZodSchema) => ZodValidationPipe {
    return (schema: ZodSchema) => new ZodValidationPipe(schema);
  }
}
