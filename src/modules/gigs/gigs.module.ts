import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module.js';
import { GigsController } from './gigs.controller.js';
import { GigsService } from './gigs.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [GigsController],
  providers: [GigsService],
  exports: [GigsService],
})
export class GigsModule {}
