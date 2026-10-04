import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  // SINGLE SOURCE OF TRUTH:
  // Prisma uses DATABASE_URL from the Prisma datasource.
  //
  // Do not provide fallback credentials here.
  // Missing DATABASE_URL should be caught by env validation.
  url: process.env.DATABASE_URL,
}));