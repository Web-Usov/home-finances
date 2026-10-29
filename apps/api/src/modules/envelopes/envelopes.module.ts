import { Module } from '@nestjs/common';
import { CalculationEngineModule } from '../calculation-engine/calculation-engine.module';
import { EnvelopesController } from './envelopes.controller';
import { EnvelopesService } from './envelopes.service';

@Module({
  imports: [CalculationEngineModule],
  controllers: [EnvelopesController],
  providers: [EnvelopesService],
  exports: [EnvelopesService],
})
export class EnvelopesModule {}
