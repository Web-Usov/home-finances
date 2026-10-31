import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { DashboardMonthlyQuerySchema, DashboardMonthlyResponseSchema } from '@family-budget/types';
import { ZodValidationPipe } from '../../common/pipes';
import { zodOpenApiSchema } from '../../common/swagger-zod';
import { ReportingService } from './reporting.service';
import type { DashboardMonthlyQuery } from './reporting.service';

@ApiTags('Reporting')
@Controller()
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('dashboard/monthly')
  @ApiOperation({ summary: 'Monthly dashboard' })
  @ApiQuery({ name: 'period', required: false, description: 'YYYY-MM; defaults to the working month' })
  @ApiResponse({
    status: 200,
    description: 'Summary, envelopes, warnings',
    schema: zodOpenApiSchema(DashboardMonthlyResponseSchema),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR (invalid period)' })
  monthlyDashboard(@Query(new ZodValidationPipe(DashboardMonthlyQuerySchema)) query: DashboardMonthlyQuery) {
    return this.reportingService.monthlyDashboard(query);
  }

  @Get('analytics/yearly')
  @ApiOperation({ summary: 'Yearly analytics' })
  @ApiResponse({ status: 200, description: 'Three required reports' })
  yearlyAnalytics() {
    return this.reportingService.yearlyAnalytics();
  }
}
