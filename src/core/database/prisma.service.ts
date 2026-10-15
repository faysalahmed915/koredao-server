import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { normalizePostgresSslMode } from './connection-string.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Make TLS verification explicit: `sslmode=require` is currently aliased to
    // `verify-full` by pg 8 but adopts weaker libpq semantics in pg 9.
    // See connection-string.ts for the full rationale.
    const { connectionString, upgradedFrom } = normalizePostgresSslMode(
      process.env.DATABASE_URL,
    );

    if (upgradedFrom) {
      // Logged once, at construction, so the behaviour change is never silent.
      new Logger('DatabaseTls').log(
        `DATABASE_URL used sslmode=${upgradedFrom}; upgraded to sslmode=verify-full so certificate verification is explicit.`,
      );
    }

    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database via Prisma');
    } catch (error) {
      const err = error as Error;
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          `Fatal: Failed to connect to database in production: ${err.message}`,
          err.stack,
        );
        throw err;
      }
      this.logger.warn(
        `Database connection postponed (development mode): ${err.message}. Ensure PostgreSQL is running.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }
}