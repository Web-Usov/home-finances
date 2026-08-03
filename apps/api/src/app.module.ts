import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { MonthsModule } from './modules/months/months.module';
import { EnvelopesModule } from './modules/envelopes/envelopes.module';
import { AllocationsModule } from './modules/allocations/allocations.module';
import { OperationsModule } from './modules/operations/operations.module';
import { CalculationEngineModule } from './modules/calculation-engine/calculation-engine.module';
import { ReportingModule } from './modules/reporting/reporting.module';

@Module({
  imports: [
    HealthModule,
    MonthsModule,
    EnvelopesModule,
    AllocationsModule,
    OperationsModule,
    CalculationEngineModule,
    ReportingModule,
  ],
})
export class AppModule {}
