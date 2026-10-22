import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module.js';
import { DraftAssignmentsController } from './draft-assignments.controller.js';
import { DraftAssignmentsService } from './draft-assignments.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [DraftAssignmentsController],
  providers: [DraftAssignmentsService],
  exports: [DraftAssignmentsService],
})
export class DraftAssignmentsModule {}
