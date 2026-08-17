import { Module } from '@nestjs/common';
import { CalculationEngineModule } from '../calculation-engine/calculation-engine.module';
import { AllocationsController } from './allocations.controller';
import { AllocationsService } from './allocations.service';

@Module({
  imports: [CalculationEngineModule],
  controllers: [AllocationsController],
  providers: [AllocationsService],
  exports: [AllocationsService],
})
export class AllocationsModule {}
