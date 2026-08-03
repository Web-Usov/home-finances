import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';

@ApiTags('Reporting')
@Controller()
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('dashboard/monthly')
  @ApiOperation({ summary: 'Monthly dashboard' })
  @ApiResponse({ status: 200, description: 'Summary, envelopes, warnings' })
  monthlyDashboard() {
    return this.reportingService.monthlyDashboard();
  }

  @Get('analytics/yearly')
  @ApiOperation({ summary: 'Yearly analytics' })
  @ApiResponse({ status: 200, description: 'Three required reports' })
  yearlyAnalytics() {
    return this.reportingService.yearlyAnalytics();
  }
}
