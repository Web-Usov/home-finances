import { Module } from '@nestjs/common';
import { CalculationEngineModule } from '../calculation-engine/calculation-engine.module';
import { MonthsController } from './months.controller';
import { MonthsService } from './months.service';

@Module({
  imports: [CalculationEngineModule],
  controllers: [MonthsController],
  providers: [MonthsService],
  exports: [MonthsService],
})
export class MonthsModule {}
