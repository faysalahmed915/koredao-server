import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

/**
 * Global so that `RolesGuard` can resolve `SubscriptionsService` from any module
 * context (guards are applied at module, controller and route level across the
 * whole application).
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
