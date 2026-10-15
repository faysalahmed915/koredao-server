import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';

import { authConfig } from '../../config/auth.config.js';
import { securityConfig } from '../../config/security.config.js';
import { PrismaModule } from '../../core/database/prisma.module.js';
import { PrismaService } from '../../core/database/prisma.service.js';

import { BETTER_AUTH } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { createBetterAuth } from './better-auth.js';

export { BETTER_AUTH } from './auth.constants.js';

@Module({
  imports: [ConfigModule, PrismaModule],

  controllers: [AuthController],

  providers: [
    {
      provide: BETTER_AUTH,
      inject: [PrismaService, authConfig.KEY, securityConfig.KEY],
      useFactory: (
        prisma: PrismaService,
        config: ConfigType<typeof authConfig>,
        security: ConfigType<typeof securityConfig>,
      ) => {
        return createBetterAuth(prisma, config, {
          ipAddressHeaders: security.ip.ipAddressHeaders,
          trustedProxies: security.ip.trustedProxies,
        });
      },
    },

    AuthService,
    AuthGuard,
  ],

  exports: [BETTER_AUTH, AuthService, AuthGuard],
})
export class AuthModule {}