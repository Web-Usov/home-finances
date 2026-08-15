import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { ApiErrorCode } from '@family-budget/types';
import { ValidationException, ConflictException, NotFoundException } from '../exceptions';

interface DomainErrorResponse {
  error: ApiErrorCode;
  message: string;
}

@Catch(ValidationException, ConflictException, NotFoundException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: ValidationException | ConflictException | NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    // Fastify reply: .code(n).send(body) — NOT Express .status(n).json(body).
    const response = ctx.getResponse() as { code: (statusCode: number) => { send: (body: DomainErrorResponse) => void } };

    const body: DomainErrorResponse = {
      error: exception.code,
      message: exception.message,
    };

    response.code(exception.statusCode).send(body);
  }
}
