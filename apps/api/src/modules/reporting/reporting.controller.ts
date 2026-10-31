import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  DashboardMonthlyQuerySchema,
  DashboardMonthlyResponseSchema,
  YearlyAnalyticsQuerySchema,
  YearlyAnalyticsResponseSchema,
} from '@family-budget/types';
import { ZodValidationPipe } from '../../common/pipes';
import { zodOpenApiSchema } from '../../common/swagger-zod';
import { ReportingService } from './reporting.service';
import type { DashboardMonthlyQuery, YearlyAnalyticsQuery } from './reporting.service';

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
  @ApiQuery({ name: 'year', required: true, description: 'YYYY, calendar year' })
  @ApiResponse({
    status: 200,
    description: 'Three required reports: income/allocation/free, envelope balances, uncovered operations',
    schema: zodOpenApiSchema(YearlyAnalyticsResponseSchema),
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR (missing or invalid year)' })
  yearlyAnalytics(@Query(new ZodValidationPipe(YearlyAnalyticsQuerySchema)) query: YearlyAnalyticsQuery) {
    return this.reportingService.yearlyAnalytics(query);
  }
}
