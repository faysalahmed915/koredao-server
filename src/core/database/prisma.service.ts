import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

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