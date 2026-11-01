import { Controller, Get, HttpCode, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import {
  CloseMonthResultSchema,
  MonthSummaryResponseSchema,
  ReopenMonthResultSchema,
  ReopenPreviewSchema,
  UpdateIncomeRequestSchema,
  mutationResponseSchema,
} from '@family-budget/types';
import { ApiIfMatch, IfMatch } from '../../common/if-match';
import type { ExpectedVersion } from '../../common/if-match';
import { MONTH_ETAG_HEADERS, MonthETag } from '../../common/month-etag';
import { ZodValidationPipe } from '../../common/pipes';
import { zodOpenApiSchema } from '../../common/swagger-zod';
import { MonthsService } from './months.service';
import type { CreateMonthRequest, UpdateIncomeRequest } from './months.service';

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
  @MonthETag()
  @ApiIfMatch()
  @ApiOperation({ summary: 'Change income for a month' })
  @ApiBody({ schema: zodOpenApiSchema(UpdateIncomeRequestSchema) })
  @ApiResponse({
    status: 200,
    headers: MONTH_ETAG_HEADERS,
    description: 'data.summary (short month summary, API-22) and warnings',
    schema: zodOpenApiSchema(MonthSummaryResponseSchema),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or MONTH_LOCKED' })
  @ApiResponse({ status: 422, description: 'ALLOCATION_EXCEEDS_INCOME or VALIDATION_ERROR' })
  updateIncome(
    @Param('period') period: string,
    @Body(new ZodValidationPipe(UpdateIncomeRequestSchema)) dto: UpdateIncomeRequest,
    @IfMatch() expectedVersion: ExpectedVersion,
  ) {
    return this.monthsService.updateIncome(period, dto, expectedVersion);
  }

  @Post(':period/close')
  @MonthETag()
  @ApiIfMatch()
  @HttpCode(200)
  @ApiOperation({ summary: 'Close an open or reopened month; promotes the draft when closing an open month' })
  @ApiResponse({
    status: 200,
    headers: MONTH_ETAG_HEADERS,
    description: 'Closed month and the draft promoted to open (null if none)',
    schema: zodOpenApiSchema(mutationResponseSchema(CloseMonthResultSchema)),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or INVALID_STATUS_TRANSITION' })
  @ApiResponse({ status: 422, description: 'ALLOCATION_EXCEEDS_INCOME or VALIDATION_ERROR' })
  close(@Param('period') period: string, @IfMatch() expectedVersion: ExpectedVersion) {
    return this.monthsService.close(period, expectedVersion);
  }

  @Get(':period/reopen-preview')
  @MonthETag()
  @ApiOperation({
    summary: 'Preview the recalculation range of reopening a closed month (read-only)',
    description:
      'MON-12 / API-20. Same checks and same range function as POST reopen, but writes nothing, ' +
      'takes no If-Match and no locks. Advisory: the state may change before the reopen request.',
  })
  @ApiResponse({
    status: 200,
    headers: MONTH_ETAG_HEADERS,
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
  @MonthETag()
  @ApiIfMatch()
  @HttpCode(200)
  @ApiOperation({ summary: 'Reopen a closed month and recalculate later months' })
  @ApiResponse({
    status: 200,
    headers: MONTH_ETAG_HEADERS,
    description: 'Reopened month and the recalculated period range',
    schema: zodOpenApiSchema(mutationResponseSchema(ReopenMonthResultSchema)),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or INVALID_STATUS_TRANSITION' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  reopen(@Param('period') period: string, @IfMatch() expectedVersion: ExpectedVersion) {
    return this.monthsService.reopen(period, expectedVersion);
  }
}
