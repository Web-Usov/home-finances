import { Module, Global } from '@nestjs/common';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';

@Global()
@Module({
  providers: [ZodValidationPipe],
  exports: [ZodValidationPipe],
})
export class CommonModule {}
