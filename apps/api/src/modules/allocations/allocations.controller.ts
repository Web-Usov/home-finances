import { Controller, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { MonthSummaryResponseSchema, SaveAllocationsRequestSchema } from '@family-budget/types';
import { ApiIfMatch, IfMatch } from '../../common/if-match';
import type { ExpectedVersion } from '../../common/if-match';
import { MONTH_ETAG_HEADERS, MonthETag } from '../../common/month-etag';
import { PeriodParamPipe, ZodValidationPipe } from '../../common/pipes';
import { zodOpenApiSchema } from '../../common/swagger-zod';
import { AllocationsService } from './allocations.service';
import type { SaveAllocationsRequest } from './allocations.service';

@ApiTags('Allocations')
@Controller('months/:period/allocations')
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Put()
  @MonthETag()
  @ApiIfMatch()
  @ApiOperation({
    summary: 'Save full allocation table for a month, optionally together with the month income',
  })
  @ApiBody({ schema: zodOpenApiSchema(SaveAllocationsRequestSchema) })
  @ApiResponse({
    status: 200,
    headers: MONTH_ETAG_HEADERS,
    description: 'data.summary (short month summary, API-22) and warnings',
    schema: zodOpenApiSchema(MonthSummaryResponseSchema),
  })
  @ApiResponse({
    status: 404,
    description: 'MONTH_NOT_FOUND or ENVELOPE_NOT_FOUND (unknown or archived envelope)',
  })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or MONTH_LOCKED' })
  @ApiResponse({ status: 422, description: 'ALLOCATION_EXCEEDS_INCOME' })
  save(
    @Param('period', PeriodParamPipe) period: string,
    @Body(new ZodValidationPipe(SaveAllocationsRequestSchema)) dto: SaveAllocationsRequest,
    @IfMatch() expectedVersion: ExpectedVersion,
  ) {
    return this.allocationsService.save(period, dto, expectedVersion);
  }
}
