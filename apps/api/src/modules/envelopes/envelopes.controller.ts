import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { CreateEnvelopeRequestSchema, UpdateEnvelopeRequestSchema } from '@family-budget/types';
import { ZodValidationPipe } from '../../common/pipes';
import { zodOpenApiSchema } from '../../common/swagger-zod';
import { EnvelopesService } from './envelopes.service';
import type { CreateEnvelopeRequest, UpdateEnvelopeRequest } from './envelopes.service';

@ApiTags('Envelopes')
@Controller('envelopes')
export class EnvelopesController {
  constructor(private readonly envelopesService: EnvelopesService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of envelopes' })
  @ApiResponse({ status: 200, description: 'List of envelopes with balances' })
  list() {
    return this.envelopesService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new envelope' })
  @ApiBody({ schema: zodOpenApiSchema(CreateEnvelopeRequestSchema) })
  @ApiResponse({ status: 201, description: 'Created envelope with calculated balance' })
  @ApiResponse({ status: 409, description: 'ENVELOPE_NAME_DUPLICATE or MONTH_LOCKED' })
  create(@Body(new ZodValidationPipe(CreateEnvelopeRequestSchema)) dto: CreateEnvelopeRequest) {
    return this.envelopesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or change display order' })
  @ApiBody({ schema: zodOpenApiSchema(UpdateEnvelopeRequestSchema) })
  @ApiResponse({ status: 200, description: 'Updated envelope' })
  @ApiResponse({ status: 404, description: 'ENVELOPE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'ENVELOPE_NAME_DUPLICATE' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEnvelopeRequestSchema)) dto: UpdateEnvelopeRequest,
  ) {
    return this.envelopesService.update(id, dto);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive envelope with zero balance' })
  @ApiResponse({ status: 200, description: 'Archived status or ENVELOPE_NOT_EMPTY error' })
  archive(@Param('id') id: string) {
    return this.envelopesService.archive(id);
  }
}
