import { Module } from '@nestjs/common';
import { CalculationEngineModule } from '../calculation-engine/calculation-engine.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [CalculationEngineModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
