import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
} from '@nestjs/swagger';
import {
  CreateOperationRequestSchema,
  UpdateOperationRequestSchema,
  DeleteOperationResponseSchema,
  OperationListQuerySchema,
  OperationListResponseSchema,
  OperationMutationResponseSchema,
  PeriodSchema,
} from '@family-budget/types';
import { z } from 'zod';
import { ApiIfMatch, IfMatch } from '../../common/if-match';
import type { ExpectedVersion } from '../../common/if-match';
import { MONTH_ETAG_HEADERS, MonthETag } from '../../common/month-etag';
import { ZodValidationPipe } from '../../common/pipes';
import { zodOpenApiSchema } from '../../common/swagger-zod';
import { OperationsService } from './operations.service';
import type {
  CreateOperationRequest,
  OperationListQuery,
  UpdateOperationRequest,
} from './operations.service';

/** A malformed id is a 422 VALIDATION_ERROR, not a database error (API-17). */
const OperationIdPipe = new ZodValidationPipe(z.string().uuid());

@ApiTags('Operations')
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get operation history' })
  @ApiQuery({ name: 'period', required: false, description: 'YYYY-MM', schema: zodOpenApiSchema(PeriodSchema) })
  @ApiQuery({
    name: 'envelopeId',
    required: false,
    description: 'Source or destination envelope',
    schema: zodOpenApiSchema(z.string().uuid()),
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['expense', 'transfer', 'adjustment', 'initial_balance'],
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['source'],
    description: 'HIST-15: with envelopeId, match only operations whose source is that envelope',
  })
  @ApiQuery({
    name: 'uncoveredOnly',
    required: false,
    enum: ['true', 'false'],
    description: 'HIST-15: only operations with an uncovered part greater than zero',
  })
  @ApiOkResponse({
    description: 'Operations with results, ordered by period and sequence_no',
    schema: zodOpenApiSchema(OperationListResponseSchema),
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  list(@Query(new ZodValidationPipe(OperationListQuerySchema)) query: OperationListQuery) {
    return this.operationsService.list(query);
  }

  @Post()
  @MonthETag()
  @ApiIfMatch()
  @ApiOperation({ summary: 'Create an operation in the given period (default: the working month)' })
  @ApiBody({ schema: zodOpenApiSchema(CreateOperationRequestSchema) })
  @ApiCreatedResponse({
    headers: MONTH_ETAG_HEADERS,
    description: 'Operation, its result, the new month summary and warnings',
    schema: zodOpenApiSchema(OperationMutationResponseSchema),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND or ENVELOPE_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'VERSION_CONFLICT, MONTH_LOCKED, TRANSFER_EXCEEDS_BALANCE or archived envelope',
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  create(
    @Body(new ZodValidationPipe(CreateOperationRequestSchema)) dto: CreateOperationRequest,
    @IfMatch() expectedVersion: ExpectedVersion,
  ) {
    return this.operationsService.create(dto, expectedVersion);
  }

  @Patch(':id')
  @MonthETag()
  @ApiIfMatch()
  @ApiOperation({ summary: 'Edit an operation; sequence_no is kept, the cascade is recalculated' })
  @ApiParam({ name: 'id', description: 'Operation id (UUID)' })
  @ApiBody({ schema: zodOpenApiSchema(UpdateOperationRequestSchema) })
  @ApiOkResponse({
    headers: MONTH_ETAG_HEADERS,
    description: 'Operation, its fresh result, the new month summary and warnings',
    schema: zodOpenApiSchema(OperationMutationResponseSchema),
  })
  @ApiResponse({ status: 404, description: 'OPERATION_NOT_FOUND or ENVELOPE_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'VERSION_CONFLICT, MONTH_LOCKED, TRANSFER_EXCEEDS_BALANCE or archived envelope',
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  update(
    @Param('id', OperationIdPipe) id: string,
    @Body(new ZodValidationPipe(UpdateOperationRequestSchema)) dto: UpdateOperationRequest,
    @IfMatch() expectedVersion: ExpectedVersion,
  ) {
    return this.operationsService.update(id, dto, expectedVersion);
  }

  @Delete(':id')
  @MonthETag()
  @ApiIfMatch()
  @ApiOperation({ summary: 'Delete an operation; the sequence_no gap stays, the cascade is recalculated' })
  @ApiParam({ name: 'id', description: 'Operation id (UUID)' })
  @ApiOkResponse({
    headers: MONTH_ETAG_HEADERS,
    description: 'The recalculated month summary and warnings',
    schema: zodOpenApiSchema(DeleteOperationResponseSchema),
  })
  @ApiResponse({ status: 404, description: 'OPERATION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or MONTH_LOCKED' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  remove(@Param('id', OperationIdPipe) id: string, @IfMatch() expectedVersion: ExpectedVersion) {
    return this.operationsService.remove(id, expectedVersion);
  }
}
