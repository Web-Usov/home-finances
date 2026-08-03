import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EnvelopesService } from './envelopes.service';

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
  @ApiResponse({ status: 201, description: 'Created envelope with calculated balance' })
  create(@Body() dto: unknown) {
    return this.envelopesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or change display order' })
  @ApiResponse({ status: 200, description: 'Updated envelope' })
  update(@Param('id') id: string, @Body() dto: unknown) {
    return this.envelopesService.update(id, dto);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive envelope with zero balance' })
  @ApiResponse({ status: 200, description: 'Archived status or ENVELOPE_NOT_EMPTY error' })
  archive(@Param('id') id: string) {
    return this.envelopesService.archive(id);
  }
}
