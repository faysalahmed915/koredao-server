import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'Enterprise NestJS Starter',
      version: '1.0.0',
      status: 'online',
      documentation: '/api/docs',
      health: '/health',
    };
  }
}
