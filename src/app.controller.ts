import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';

@ApiTags('Root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'API welcome information (redirects browser requests to /api/docs automatically)',
  })
  getRoot(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // If accessed from a web browser, redirect to interactive Swagger documentation
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html') && !req.query.format) {
      res.redirect('/api/docs');
      return;
    }

    return this.appService.getInfo();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'API v1 root welcome information' })
  getApiV1Root() {
    return this.appService.getInfo();
  }
}
