import { Module } from '@nestjs/common';
import { PlatformSettingsController } from './platform-settings.controller.js';
import { PlatformSettingsService } from './platform-settings.service.js';
import { PrismaModule } from '../../core/database/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}