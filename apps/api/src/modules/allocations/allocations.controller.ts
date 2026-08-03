import { Controller, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllocationsService } from './allocations.service';

@ApiTags('Allocations')
@Controller('months/:period/allocations')
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Put()
  @ApiOperation({ summary: 'Save full allocation table for a month' })
  @ApiResponse({ status: 200, description: 'Summary and warnings' })
  save(@Param('period') period: string, @Body() dto: unknown) {
    return this.allocationsService.save(period, dto);
  }
}
