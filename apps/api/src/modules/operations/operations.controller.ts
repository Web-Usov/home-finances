import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OperationsService } from './operations.service';

@ApiTags('Operations')
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get operation history' })
  @ApiResponse({ status: 200, description: 'List of operations with results' })
  list() {
    return this.operationsService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create an operation' })
  @ApiResponse({ status: 201, description: 'Operation, result and new summary' })
  create(@Body() dto: unknown) {
    return this.operationsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an operation' })
  @ApiResponse({ status: 200, description: 'Cascade recalculated results' })
  update(@Param('id') id: string, @Body() dto: unknown) {
    return this.operationsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an operation' })
  @ApiResponse({ status: 200, description: 'Cascade recalculated results' })
  remove(@Param('id') id: string) {
    return this.operationsService.remove(id);
  }
}
