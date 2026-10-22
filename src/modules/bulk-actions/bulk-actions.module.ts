import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module.js';
import { BulkActionsController } from './bulk-actions.controller.js';
import { BulkActionsService } from './bulk-actions.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [BulkActionsController],
  providers: [BulkActionsService],
  exports: [BulkActionsService],
})
export class BulkActionsModule {}
