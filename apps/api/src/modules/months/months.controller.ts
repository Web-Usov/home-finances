import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MonthsService } from './months.service';
import type { CreateMonthRequest } from './months.service';

@ApiTags('Months')
@Controller('months')
export class MonthsController {
  constructor(private readonly monthsService: MonthsService) {}

  @Get()
  @ApiOperation({ summary: 'List months and statuses' })
  @ApiResponse({ status: 200, description: 'List of budget months' })
  list() {
    return this.monthsService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create first or next month' })
  @ApiResponse({ status: 201, description: 'Created month' })
  create(@Body() dto: CreateMonthRequest) {
    return this.monthsService.create(dto);
  }

  @Patch(':period')
  @ApiOperation({ summary: 'Change income for a month' })
  @ApiResponse({ status: 200, description: 'Updated month summary' })
  updateIncome(@Param('period') period: string, @Body() dto: unknown) {
    return this.monthsService.updateIncome(period, dto);
  }

  @Post(':period/close')
  @ApiOperation({ summary: 'Close an open month' })
  @ApiResponse({ status: 200, description: 'New statuses of current and draft months' })
  close(@Param('period') period: string) {
    return this.monthsService.close(period);
  }

  @Post(':period/reopen')
  @ApiOperation({ summary: 'Reopen a closed month' })
  @ApiResponse({ status: 200, description: 'Recalculation range and status' })
  reopen(@Param('period') period: string, @Body() dto: unknown) {
    return this.monthsService.reopen(period, dto);
  }
}
