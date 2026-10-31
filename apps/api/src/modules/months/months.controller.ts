import { Controller, Get, HttpCode, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import {
  CloseMonthRequestSchema,
  CloseMonthResultSchema,
  MonthSummaryResponseSchema,
  ReopenMonthRequestSchema,
  ReopenMonthResultSchema,
  ReopenPreviewSchema,
  UpdateIncomeRequestSchema,
  mutationResponseSchema,
} from '@family-budget/types';
import { ZodValidationPipe } from '../../common/pipes';
import { zodOpenApiSchema } from '../../common/swagger-zod';
import { MonthsService } from './months.service';
import type {
  CloseMonthRequest,
  CreateMonthRequest,
  ReopenMonthRequest,
  UpdateIncomeRequest,
} from './months.service';

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
  @ApiBody({ schema: zodOpenApiSchema(UpdateIncomeRequestSchema) })
  @ApiResponse({
    status: 200,
    description: 'data.summary (short month summary, API-22) and warnings',
    schema: zodOpenApiSchema(MonthSummaryResponseSchema),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or MONTH_LOCKED' })
  @ApiResponse({ status: 422, description: 'ALLOCATION_EXCEEDS_INCOME or VALIDATION_ERROR' })
  updateIncome(
    @Param('period') period: string,
    @Body(new ZodValidationPipe(UpdateIncomeRequestSchema)) dto: UpdateIncomeRequest,
  ) {
    return this.monthsService.updateIncome(period, dto);
  }

  @Post(':period/close')
  @HttpCode(200)
  @ApiOperation({ summary: 'Close an open or reopened month; promotes the draft when closing an open month' })
  @ApiBody({ schema: zodOpenApiSchema(CloseMonthRequestSchema) })
  @ApiResponse({
    status: 200,
    description: 'Closed month and the draft promoted to open (null if none)',
    schema: zodOpenApiSchema(mutationResponseSchema(CloseMonthResultSchema)),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or INVALID_STATUS_TRANSITION' })
  @ApiResponse({ status: 422, description: 'ALLOCATION_EXCEEDS_INCOME or VALIDATION_ERROR' })
  close(
    @Param('period') period: string,
    @Body(new ZodValidationPipe(CloseMonthRequestSchema)) dto: CloseMonthRequest,
  ) {
    return this.monthsService.close(period, dto);
  }

  @Get(':period/reopen-preview')
  @ApiOperation({
    summary: 'Preview the recalculation range of reopening a closed month (read-only)',
    description:
      'MON-12 / API-20. Same checks and same range function as POST reopen, but writes nothing, ' +
      'takes no version and no locks. Advisory: the state may change before the reopen request.',
  })
  @ApiResponse({
    status: 200,
    description: 'The month and the inclusive range of months a reopen would recalculate',
    schema: zodOpenApiSchema(ReopenPreviewSchema),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'INVALID_STATUS_TRANSITION (month is not closed or another month is reopened, MON-13)',
  })
  reopenPreview(@Param('period') period: string) {
    return this.monthsService.reopenPreview(period);
  }

  @Post(':period/reopen')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reopen a closed month and recalculate later months' })
  @ApiBody({ schema: zodOpenApiSchema(ReopenMonthRequestSchema) })
  @ApiResponse({
    status: 200,
    description: 'Reopened month and the recalculated period range',
    schema: zodOpenApiSchema(mutationResponseSchema(ReopenMonthResultSchema)),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or INVALID_STATUS_TRANSITION' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  reopen(
    @Param('period') period: string,
    @Body(new ZodValidationPipe(ReopenMonthRequestSchema)) dto: ReopenMonthRequest,
  ) {
    return this.monthsService.reopen(period, dto);
  }
}
