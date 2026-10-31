import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
} from '@nestjs/swagger';
import {
  CreateOperationRequestSchema,
  OperationListQuerySchema,
  OperationListResponseSchema,
  OperationMutationResponseSchema,
} from '@family-budget/types';
import { ZodValidationPipe } from '../../common/pipes';
import { zodOpenApiSchema } from '../../common/swagger-zod';
import { OperationsService } from './operations.service';
import type { CreateOperationRequest, OperationListQuery } from './operations.service';

// PATCH/DELETE /operations/:id are added by T-005.
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
}
