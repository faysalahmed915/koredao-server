import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

// Configuration
import {
  appConfig,
  databaseConfig,
  securityConfig,
  authConfig,
  paymentConfig,
  validateEnv,
} from './config/index.js';

// Common Layer
import {
  CorrelationIdMiddleware,
  HttpExceptionFilter,
  LoggingInterceptor,
  TransformInterceptor,
  TimeoutInterceptor,
} from './common/index.js';

// Core Infrastructure
import { PrismaModule } from './core/database/prisma.module.js';
import { HealthModule } from './core/health/health.module.js';

// Domain Modules
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { GigsModule } from './modules/gigs/gigs.module.js';
import { AssignmentsModule } from './modules/assignments/assignments.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { MilestonesModule } from './modules/milestones/milestones.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { MatchingModule } from './modules/matching/matching.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { AuthGuard } from './modules/auth/auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    // Strict, validated environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, securityConfig, authConfig, paymentConfig],
      validate: validateEnv,
    }),

    // Multi-tier Rate Limiting & DoS Protection
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.get<number>('security.throttle.ttl', 60000),
          limit: config.get<number>('security.throttle.limit', 100),
        },
      ],
    }),

    // Core Singletons
    PrismaModule,
    HealthModule,

    // Domain Features
    AuthModule,
    UsersModule,
    ProfilesModule,
    GigsModule,
    AssignmentsModule,
    OrdersModule,
    PaymentsModule,
    MilestonesModule,
    ChatModule,
    MatchingModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate limiter guard active across all endpoints
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Authentication guard active across all endpoints (opt-out with @Public())
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    // Role-based access control guard evaluating @Roles, @MinRole, and @AllowSelf
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global exception filter suppressing internal leakages
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Structured audit logging with correlation tracking
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Standard response format envelope
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Timeout interceptor to mitigate slow-loris attacks
    {
      provide: APP_INTERCEPTOR,
      useValue: new TimeoutInterceptor(15000),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Attach Correlation ID to every incoming request
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*path}');
  }
}
