import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';
import { ValidationException } from '../exceptions';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string().min(1),
    nested: z.object({ amount: z.string() }).optional(),
  });
  const pipe = new ZodValidationPipe(schema);
  const metadata = { type: 'body' as const };

  it('returns the parsed value for a valid body', () => {
    expect(pipe.transform({ name: 'Еда' }, metadata)).toEqual({ name: 'Еда' });
  });

  it('API-17: invalid body yields 422 ValidationException', () => {
    let thrown: unknown;
    try {
      pipe.transform({ name: '', nested: { amount: 1 } }, metadata);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ValidationException);
    expect(thrown).toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
    const message = (thrown as ValidationException).message;
    expect(message).toContain('name');
    expect(message).toContain('nested.amount');
  });
});
