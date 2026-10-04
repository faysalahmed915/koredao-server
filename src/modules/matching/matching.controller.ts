import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MatchingService } from './matching.service.js';
import { MatchHelpersDto } from './dto/match-helpers.dto.js';
import { BANGLADESH_CAMPUSES } from './bangladesh-campuses.js';

@ApiTags('Smart Matching & Handwriting Showcase')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('helpers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Find matching academic helpers ranked by campus proximity and handwriting style',
  })
  @ApiResponse({ status: 200, description: 'Ranked list of matching helpers returned.' })
  matchHelpers(@Body() dto: MatchHelpersDto) {
    return this.matchingService.matchHelpers(dto);
  }

  @Get('campuses')
  @ApiOperation({
    summary: 'Get list of major Bangladesh universities and campus GPS locations for zero-latency autocomplete',
  })
  @ApiResponse({ status: 200, description: 'Campus locations returned.' })
  getCampuses() {
    return Object.values(BANGLADESH_CAMPUSES);
  }
}
