import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { ModerationModule } from '../moderation/moderation.module.js';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
  imports: [ModerationModule],
})
export class DashboardModule {}
