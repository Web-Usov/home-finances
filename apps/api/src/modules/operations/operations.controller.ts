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
  DeleteOperationQuerySchema,
  DeleteOperationResponseSchema,
  OperationListQuerySchema,
  OperationListResponseSchema,
  OperationMutationResponseSchema,
} from '@family-budget/types';
import { z } from 'zod';
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
  @ApiQuery({ name: 'period', required: false, description: 'YYYY-MM' })
  @ApiQuery({ name: 'envelopeId', required: false, description: 'Source or destination envelope' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['expense', 'transfer', 'adjustment', 'initial_balance'],
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
  @ApiOperation({ summary: 'Create an operation in the current working month' })
  @ApiBody({ schema: zodOpenApiSchema(CreateOperationRequestSchema) })
  @ApiCreatedResponse({
    description: 'Operation, its result, the new month summary and warnings',
    schema: zodOpenApiSchema(OperationMutationResponseSchema),
  })
  @ApiResponse({ status: 404, description: 'MONTH_NOT_FOUND or ENVELOPE_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'VERSION_CONFLICT, MONTH_LOCKED, TRANSFER_EXCEEDS_BALANCE or archived envelope',
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  create(@Body(new ZodValidationPipe(CreateOperationRequestSchema)) dto: CreateOperationRequest) {
    return this.operationsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an operation; sequence_no is kept, the cascade is recalculated' })
  @ApiParam({ name: 'id', description: 'Operation id (UUID)' })
  @ApiBody({ schema: zodOpenApiSchema(UpdateOperationRequestSchema) })
  @ApiOkResponse({
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
  ) {
    return this.operationsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an operation; the sequence_no gap stays, the cascade is recalculated' })
  @ApiParam({ name: 'id', description: 'Operation id (UUID)' })
  @ApiQuery({ name: 'version', required: true, description: 'Month version (ADR 0005)' })
  @ApiOkResponse({
    description: 'The recalculated month summary and warnings',
    schema: zodOpenApiSchema(DeleteOperationResponseSchema),
  })
  @ApiResponse({ status: 404, description: 'OPERATION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or MONTH_LOCKED' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  remove(
    @Param('id', OperationIdPipe) id: string,
    @Query(new ZodValidationPipe(DeleteOperationQuerySchema)) query: { version: number },
  ) {
    return this.operationsService.remove(id, query.version);
  }
}
