import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API metadata', () => {
      const mockReq = { headers: {}, query: {} } as any;
      const mockRes = { redirect: () => {} } as any;
      expect(appController.getRoot(mockReq, mockRes)).toEqual(
        expect.objectContaining({
          name: 'Enterprise NestJS Starter',
          status: 'online',
        }),
      );
    });
  });
});
