import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { PrismaModule } from '../../core/database/prisma.module.js';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module.js';

@Module({
  imports: [PrismaModule, PlatformSettingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
